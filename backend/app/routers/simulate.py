from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import Any
import asyncio
import json

from app.core.auth import get_current_user, CurrentUser
from app.models.database import get_db, Profile, Plan, Log, AgentMemory
from app.models.schemas import (
    UserProfile, SimulationScenario,
    SimulationStreamRequest,
)
from app.agents.graph.nodes import orchestrator_node, AGENT_REGISTRY
from app.agents.coordinator import simulation_coordinator_node
from app.agents.graph.state import AgentState

router = APIRouter()


SCENARIOS = [
    SimulationScenario(
        id="miss-3-workouts",
        title="Miss 3 Workouts in a Week",
        description="What happens to my plan if I skip workouts for 3 days straight?",
        icon="Activity",
        palette="border-red-200 bg-red-50 text-red-700",
    ),
    SimulationScenario(
        id="weekend-overeat",
        title="Overeat on the Weekend",
        description="How would eating 1000 extra calories on Saturday and Sunday affect progress?",
        icon="Utensils",
        palette="border-orange-200 bg-orange-50 text-orange-700",
    ),
    SimulationScenario(
        id="switch-vegetarian",
        title="Switch to Vegetarian",
        description="What would my meal plan look like if I stopped eating meat?",
        icon="Leaf",
        palette="border-emerald-200 bg-emerald-50 text-emerald-700",
    ),
    SimulationScenario(
        id="goal-4-weeks-earlier",
        title="Reach Goal 4 Weeks Earlier",
        description="What would the agents recommend if I wanted to accelerate my timeline?",
        icon="Zap",
        palette="border-amber-200 bg-amber-50 text-amber-700",
    ),
]


@router.get("/scenarios")
def list_scenarios():
    return {"scenarios": SCENARIOS}


def _load_active_memories(db: Session, user_id: str) -> list[dict[str, Any]]:
    """Copy of recovery._load_active_memories — duplicate kept to avoid coupling
    routers across modules (ponytail: extract to app/services/memory.py when a
    third caller arrives)."""
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


def _format_recent_logs(db: Session, user_id: str, days: int = 14) -> str:
    """Render recent daily_log rows to text the coordinator can reason about.
    Mirror of planner's recent-logs formatting — compact, chronological."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(Log)
        .filter(
            Log.user_id == user_id,
            Log.type == "daily_log",
            Log.created_at >= since,
        )
        .order_by(Log.created_at.desc())
        .limit(14)
        .all()
    )
    if not rows:
        return "No recent daily log entries."
    lines = []
    for r in rows:
        c = r.content or {}
        ts = r.created_at.isoformat() if r.created_at else "unknown"
        summary = c.get("summary") or c.get("message") or ""
        kcal = c.get("total_calories_consumed") or c.get("calories_consumed")
        line = f"- [{ts}] {summary}".strip()
        if kcal is not None:
            line += f" ({kcal} kcal)"
        lines.append(line)
    return "\n".join(lines)


@router.post("/stream")
async def simulate_stream(
    body: SimulationStreamRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream a custom what-if simulation via SSE.

    Events:
      start       — agent_names being run
      agent       — per-specialist bubble (agent_name, role, rationale, confidence, recommendation, index, total)
      coordinator — SimulationSummary payload
      done        — final
      error       — terminal

    One-shot: no DB writes, no persistence — state discarded after run.
    """
    scenario_text = (body.prompt or "").strip()
    if not scenario_text:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    plan = db.query(Plan).filter(Plan.user_id == user.id, Plan.is_active == True).first()
    if not profile or not plan:
        raise HTTPException(
            status_code=404,
            detail="Profile or active plan not found. Complete onboarding first.",
        )

    user_profile = UserProfile(
        goals=profile.goals,
        primary_goal=profile.primary_goal,
        body=profile.body,
        medical=profile.medical,
        lifestyle=profile.lifestyle,
        psychology=profile.psychology,
    )

    memories = _load_active_memories(db, user.id)
    recent_logs_text = _format_recent_logs(db, user.id)

    initial_state: AgentState = {
        "event_type": "what_if",
        "profile": user_profile,
        "recent_logs": [],
        "context": {
            "scenario": scenario_text,
            "recent_logs": recent_logs_text,
        },
        "selected_agents": [],
        "agent_outputs": {},
        "conflicts": [],
        "coordinator_decision": None,
        "user_feedback": None,
        "approved": None,
        "iteration": 0,
        "memories": memories,
    }

    async def event_generator():
        loop = asyncio.get_event_loop()
        try:
            # 1) Orchestrator routing — surfaces memories_text + guidelines into context
            orch_result = await loop.run_in_executor(None, orchestrator_node, initial_state)
            initial_state["selected_agents"] = orch_result["selected_agents"]
            if "context" in orch_result:
                initial_state["context"].update(orch_result["context"])

            # 2) Specialist debate — concurrent, emit as each completes
            agent_names = initial_state["selected_agents"]
            total = len(agent_names)
            if total == 0:
                yield f"event: error\ndata: {json.dumps({'error': 'No agents selected for this scenario.'})}\n\n"
                return
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

            # 3) Simulation coordinator — lightweight SimulationSummary
            try:
                coord_result = await asyncio.wait_for(
                    loop.run_in_executor(None, simulation_coordinator_node, initial_state),
                    timeout=90,
                )
                summary = coord_result["coordinator_decision"]
                initial_state["coordinator_decision"] = summary
            except asyncio.TimeoutError:
                yield f"event: error\ndata: {json.dumps({'error': 'Coordinator took too long. Please try a shorter prompt.'})}\n\n"
                return

            yield f"event: coordinator\ndata: {json.dumps(summary.model_dump(mode='json'))}\n\n"
            yield f"event: done\ndata: {json.dumps({'status': 'complete'})}\n\n"

        except Exception as e:
            print("SIMULATE STREAM ERROR:", e)
            import traceback
            traceback.print_exc()
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
