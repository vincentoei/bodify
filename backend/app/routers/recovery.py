from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Any
import asyncio
import json
import re

from app.core.auth import get_current_user, CurrentUser
from app.models.database import (
    get_db, Profile, Plan, User, Log, AgentMemory, CalendarEvent,
)
from app.models.schemas import UserProfile, RecoverySubmission, ExtractedFact, PlanAdaptationEntry
from app.agents.graph.nodes import orchestrator_node, AGENT_REGISTRY
from app.agents.coordinator import recovery_coordinator_node
from app.agents.fact_extractor import extract_facts_node
from app.agents.graph.state import AgentState
from app.services.calendar import apply_calendar_mutations, generate_fallback_mutations_for_facts

router = APIRouter()


PAST_FOOD_RE = re.compile(
    r"\b(ate|had|consumed|drank|eat|eating|drinking|donuts?|pizza|burger|fries|cake|chocolate|snack)\b",
    re.IGNORECASE,
)


def _today_window_utc(plan: Plan | None) -> tuple[datetime, datetime]:
    tz_name = plan.timezone if plan and plan.timezone else "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")
    now_local = datetime.now(timezone.utc).astimezone(tz)
    today_local_start = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start = today_local_start.astimezone(timezone.utc)
    return today_start, today_start + timedelta(days=1)


def _today_local_iso(plan: Plan | None) -> str:
    """Return today's date + weekday in the user's timezone, e.g. 'Friday 2026-07-17'.

    Including the weekday gives the coordinator LLM calendar awareness so it can
    compute 'next Monday' correctly without guessing.
    """
    tz_name = plan.timezone if plan and plan.timezone else "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")
    now_local = datetime.now(timezone.utc).astimezone(tz)
    weekday = now_local.strftime("%A")
    return f"{weekday} {now_local.date().isoformat()}"


def _load_active_memories(db: Session, user_id: str) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    rows = (
        db.query(AgentMemory)
        .filter(
            AgentMemory.user_id == user_id,
            AgentMemory.active == True,
        )
        .filter(
            (AgentMemory.expires_at == None) | (AgentMemory.expires_at > now)
        )
        .order_by(AgentMemory.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": m.id,
            "category": m.category,
            "content": m.content,
            "source_agent": m.source_agent,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "expires_at": m.expires_at.isoformat() if m.expires_at else None,
        }
        for m in rows
    ]


def _load_upcoming_events(db: Session, user_id: str, plan: Plan | None, window_days: int = 30) -> list[CalendarEvent]:
    """Return the user's scheduled events for the next N days in UTC."""
    tz_name = plan.timezone if plan and plan.timezone else "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")

    now_local = datetime.now(timezone.utc).astimezone(tz)
    local_start = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    utc_start = local_start.astimezone(timezone.utc)
    utc_end = utc_start + timedelta(days=window_days)

    return (
        db.query(CalendarEvent)
        .filter(
            CalendarEvent.user_id == user_id,
            CalendarEvent.date >= utc_start,
            CalendarEvent.date < utc_end,
        )
        .order_by(CalendarEvent.date)
        .all()
    )


def _format_upcoming_events(events: list[CalendarEvent], plan: Plan | None) -> str:
    """Format upcoming events for the coordinator prompt."""
    if not events:
        return "No scheduled events in the next 30 days."

    tz_name = plan.timezone if plan and plan.timezone else "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")

    lines = []
    for ev in events:
        local_dt = ev.date.astimezone(tz)
        lines.append(
            f"- {local_dt.date().isoformat()} {local_dt.strftime('%H:%M')} "
            f"[{ev.type}] {ev.title} (status: {ev.status})"
        )
    return "\n".join(lines)


def _persist_facts(
    db: Session, user_id: str, facts: list[ExtractedFact], now: datetime
) -> list[dict[str, Any]]:
    """Insert new durable facts, updating existing rows with identical category+content.

    Exact-match dedup (ponytail: upgrade to fuzzy/embedding similarity if users complain
    that paraphrased facts double up). Returns per-fact payload tagged as created/updated
    so the UI can distinguish "Memory saved" vs "Memory updated".
    """
    persisted: list[dict[str, Any]] = []
    for f in facts:
        expires_at: datetime | None = None
        if f.ttl_days is not None:
            expires_at = now + timedelta(days=f.ttl_days)

        existing = (
            db.query(AgentMemory)
            .filter(
                AgentMemory.user_id == user_id,
                AgentMemory.active == True,
                AgentMemory.category == f.category,
                AgentMemory.content == f.content,
            )
            .order_by(AgentMemory.created_at.desc())
            .first()
        )

        if existing is not None:
            existing.expires_at = expires_at
            existing.source_agent = f.source_agent or existing.source_agent
            db.flush()
            persisted.append(
                {
                    "category": f.category,
                    "content": f.content,
                    "ttl_days": f.ttl_days,
                    "expires_at": expires_at.isoformat() if expires_at else None,
                    "status": "updated",
                    "id": existing.id,
                }
            )
            continue

        mem = AgentMemory(
            id=str(uuid4()),
            user_id=user_id,
            content=f.content,
            category=f.category,
            source_agent=f.source_agent,
            active=True,
            expires_at=expires_at,
        )
        db.add(mem)
        db.flush()
        persisted.append(
            {
                "category": f.category,
                "content": f.content,
                "ttl_days": f.ttl_days,
                "expires_at": expires_at.isoformat() if expires_at else None,
                "status": "created",
                "id": mem.id,
            }
        )
    db.commit()
    return persisted


def _attach_recovery_note_to_today_log(
    db: Session, user_id: str, today_start: datetime, today_end: datetime, message: str
) -> None:
    """Fold a duplicate past-tense food mention into today's existing daily log.

    Non-destructive: just appends to content['recovery_followups']. Recomputation
    of calories/macros is intentionally skipped — the original log is final.
    """
    log = (
        db.query(Log)
        .filter(
            Log.user_id == user_id,
            Log.type == "daily_log",
            Log.created_at >= today_start,
            Log.created_at < today_end,
        )
        .order_by(Log.created_at.desc())
        .first()
    )
    if not log:
        return
    content = log.content or {}
    followups = content.get("recovery_followups", [])
    followups.append({"message": message, "at": datetime.now(timezone.utc).isoformat()})
    content["recovery_followups"] = followups
    log.content = content
    db.commit()


@router.post("/stream")
async def recovery_stream(
    submission: RecoverySubmission,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run the recovery agent council and stream dialogue + mutations via SSE.

    Events:
      start          — agent_names being run
      fact           — extracted durable facts (post fact extractor)
      agent          — per-specialist chat bubble (agent_name, role, rationale, confidence)
      coordinator    — RecoveryDecision summary + mutations
      duplicate      — short-circuit ack when message is a past-tense recap of an already-locked day
      done           — final
      error          — terminal
    """
    text = submission.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Recovery message cannot be empty.")

    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    plan = db.query(Plan).filter(Plan.user_id == user.id, Plan.is_active == True).first()
    if not profile or not plan:
        raise HTTPException(status_code=404, detail="Profile or active plan not found. Complete onboarding first.")

    user_profile = UserProfile(
        goals=profile.goals,
        primary_goal=profile.primary_goal,
        body=profile.body,
        medical=profile.medical,
        lifestyle=profile.lifestyle,
        psychology=profile.psychology,
    )

    today_start, today_end = _today_window_utc(plan)
    has_today_log = (
        db.query(Log)
        .filter(
            Log.user_id == user.id,
            Log.type == "daily_log",
            Log.created_at >= today_start,
            Log.created_at < today_end,
        )
        .first()
        is not None
    )

    memories = _load_active_memories(db, user.id)
    upcoming_events = _load_upcoming_events(db, user.id, plan)
    today_local = _today_local_iso(plan)

    initial_state: AgentState = {
        "event_type": "recovery_chat",
        "profile": user_profile,
        "recent_logs": [],
        "context": {
            "today_local": today_local,
            "upcoming_events_text": _format_upcoming_events(upcoming_events, plan),
        },
        "selected_agents": [],
        "agent_outputs": {},
        "conflicts": [],
        "coordinator_decision": None,
        "user_feedback": None,
        "approved": None,
        "iteration": 0,
        "recovery_message": text,
        "memories": memories,
        "extracted_facts": [],
        "calendar_mutations": [],
        "recovery_decision": None,
    }

    async def event_generator():
        loop = asyncio.get_event_loop()
        try:
            # 1) Orchestrator routing
            orch_result = await loop.run_in_executor(None, orchestrator_node, initial_state)
            initial_state["selected_agents"] = orch_result["selected_agents"]
            if "context" in orch_result:
                initial_state["context"].update(orch_result["context"])

            # 2) Fact extraction (preliminary — informs duplicate-today shorthand)
            try:
                fact_result = await asyncio.wait_for(
                    loop.run_in_executor(None, extract_facts_node, initial_state),
                    timeout=45,
                )
                initial_state["extracted_facts"] = fact_result.get("extracted_facts", [])
            except asyncio.TimeoutError:
                yield f"event: system\ndata: {json.dumps({'message': 'Fact extractor took too long, proceeding without durable facts.'})}\n\n"
                initial_state["extracted_facts"] = []
            facts = initial_state["extracted_facts"]

            yield f"event: fact\ndata: {json.dumps({'facts': [f.model_dump(mode='json') for f in facts]})}\n\n"

            # 3) Duplicate-today short circuit:
            #    - no durable facts extracted
            #    - already logged today
            #    - message contains past-tense food verbs
            #    => acknowledge + fold note, no agent debate.
            if not facts and has_today_log and PAST_FOOD_RE.search(text):
                _attach_recovery_note_to_today_log(db, user.id, today_start, today_end, text)
                yield f"event: duplicate\ndata: {json.dumps({'message': 'Your day is already logged. I have noted the extra bites — your log stays final. Use Recovery for forward-looking context like travel or upcoming events.'})}\n\n"
                yield f"event: done\ndata: {json.dumps({'status': 'duplicate_today', 'calendar_changes': []})}\n\n"
                return

            # 4) Specialist debate — run concurrently, emit as each completes.
            agent_names = initial_state["selected_agents"]
            total = len(agent_names)
            yield f"event: start\ndata: {json.dumps({'total_agents': total, 'agent_names': agent_names})}\n\n"

            async def run_specialist(name: str):
                try:
                    result = await asyncio.wait_for(
                        loop.run_in_executor(None, AGENT_REGISTRY[name], initial_state),
                        timeout=45,
                    )
                    return name, result, None
                except asyncio.TimeoutError:
                    return name, None, "timeout"
                except Exception as e:
                    return name, None, str(e)

            tasks = [asyncio.create_task(run_specialist(n)) for n in agent_names]
            completion_idx = 0
            for coro in asyncio.as_completed(tasks):
                name, result, err = await coro
                if err == "timeout":
                    yield f"event: system\ndata: {json.dumps({'message': f'{name} specialist took too long, skipping.'})}\n\n"
                    continue
                if err:
                    yield f"event: system\ndata: {json.dumps({'message': f'{name} specialist error: {err}'})}\n\n"
                    continue
                initial_state["agent_outputs"].update(result["agent_outputs"])
                agent_output = result["agent_outputs"][name]
                completion_idx += 1

                yield f"event: agent\ndata: {json.dumps({
                    'agent_name': agent_output.agent_name,
                    'role': agent_output.role,
                    'confidence': agent_output.confidence,
                    'rationale': agent_output.rationale,
                    'recommendation': agent_output.recommendation,
                    'index': completion_idx,
                    'total': total,
                })}\n\n"

            # 5) Recovery coordinator
            try:
                coord_result = await asyncio.wait_for(
                    loop.run_in_executor(None, recovery_coordinator_node, initial_state),
                    timeout=90,
                )
                decision = coord_result["recovery_decision"]
                initial_state["recovery_decision"] = decision
            except asyncio.TimeoutError:
                yield f"event: error\ndata: {json.dumps({'error': 'Coordinator took too long. Please try a shorter message.'})}\n\n"
                return

            # Merge any newly-added facts the coordinator extracted
            merged_facts = list(facts)
            for f in decision.extracted_facts:
                if f not in merged_facts:
                    merged_facts.append(f)
            decision.extracted_facts = merged_facts

            # 6) Persist durable facts
            now = datetime.now(timezone.utc)
            persisted_facts = _persist_facts(db, user.id, decision.extracted_facts, now)

            # 7) Apply targeted calendar mutations
            # If the LLM coordinator did not emit concrete mutations, fall back to
            # deterministic rules based on durable facts (e.g. injury → skip leg workouts).
            mutations = list(decision.calendar_mutations)
            if not mutations:
                fallback = generate_fallback_mutations_for_facts(
                    decision.extracted_facts, upcoming_events, plan
                )
                if fallback:
                    mutations.extend(fallback)
                    yield f"event: system\ndata: {json.dumps({'message': f'Applying {len(fallback)} fallback calendar change(s) based on your message.'})}\n\n"

            changelog = apply_calendar_mutations(db, user.id, mutations, plan)

            # 8) Write a recovery log row
            recovery_log = Log(
                id=str(uuid4()),
                user_id=user.id,
                type="recovery_chat",
                content={
                    "message": text,
                    "resolution_summary": decision.resolution_summary,
                    "specialist_outputs": [o.model_dump(mode="json") for o in decision.specialist_outputs],
                    "conflicts": [c.model_dump(mode="json") for c in decision.conflicts],
                    "calendar_mutations": [m.model_dump(mode="json") for m in mutations],
                    "calendar_changes": changelog,
                    "persisted_facts": persisted_facts,
                    "memories_at_call": [m for m in memories],
                },
            )
            db.add(recovery_log)
            db.commit()

            # 9) Append an audit entry to the active plan's adaptation ledger.
            plan_adaptations = list(plan.plan_adaptations or [])
            plan_adaptations.append(PlanAdaptationEntry(
                at=now,
                message=text,
                changes=changelog,
                facts=persisted_facts,
            ).model_dump(mode="json"))
            # Cap to the last 50 to bound column growth.
            plan.plan_adaptations = plan_adaptations[-50:]
            db.commit()
            adaptation_count = len(plan.plan_adaptations)

            yield f"event: coordinator\ndata: {json.dumps({
                'resolution_summary': decision.resolution_summary,
                'specialist_outputs': [o.model_dump(mode='json') for o in decision.specialist_outputs],
                'calendar_mutations': [m.model_dump(mode='json') for m in decision.calendar_mutations],
                'calendar_changes': changelog,
                'persisted_facts': persisted_facts,
                'adaptation_count': adaptation_count,
            })}\n\n"

            yield f"event: done\ndata: {json.dumps({'status': 'complete', 'calendar_changes': changelog})}\n\n"

        except Exception as e:
            print("RECOVERY STREAM ERROR:", e)
            import traceback
            traceback.print_exc()
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )


@router.get("/history")
def get_recovery_history(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20,
):
    """Return prior recovery chat logs so the Recovery UI can restore on reload."""
    rows = (
        db.query(Log)
        .filter(
            Log.user_id == user.id,
            Log.type == "recovery_chat",
        )
        .order_by(Log.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "history": [
            {
                "id": r.id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "message": (r.content or {}).get("message", ""),
                "resolution_summary": (r.content or {}).get("resolution_summary", ""),
                "specialist_outputs": (r.content or {}).get("specialist_outputs", []),
                "calendar_changes": (r.content or {}).get("calendar_changes", []),
                "persisted_facts": (r.content or {}).get("persisted_facts", []),
            }
            for r in rows
        ]
    }


@router.get("/memories")
def list_memories(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    only_active: bool = True,
):
    """List the user's durable memories. Useful for a future settings panel."""
    q = db.query(AgentMemory).filter(AgentMemory.user_id == user.id)
    if only_active:
        q = q.filter(AgentMemory.active == True)
    rows = q.order_by(AgentMemory.created_at.desc()).all()
    return {
        "memories": [
            {
                "id": m.id,
                "content": m.content,
                "category": m.category,
                "source_agent": m.source_agent,
                "active": m.active,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "expires_at": m.expires_at.isoformat() if m.expires_at else None,
            }
            for m in rows
        ]
    }


@router.delete("/memories/{memory_id}")
def delete_memory(
    memory_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft-delete a durable memory (flip active=False).

    Calendar is intentionally untouched. Only future plan generations and future
    recovery chats will stop using this memory. Edit the Calendar page or
    regenerate the week to alter already-placed events.
    """
    mem = (
        db.query(AgentMemory)
        .filter(
            AgentMemory.id == memory_id,
            AgentMemory.user_id == user.id,
        )
        .first()
    )
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found.")
    if not mem.active:
        raise HTTPException(status_code=409, detail="Memory already deleted.")
    mem.active = False
    db.commit()
    return {"id": memory_id, "active": False}