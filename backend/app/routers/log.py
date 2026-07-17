from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core.auth import get_current_user, CurrentUser
from app.models.database import get_db, Log, CalendarEvent, Plan
from app.models.schemas import (
    LogEntry,
    DailyLogSubmission,
    DailyLogParseResult,
    ParsedLogEntry,
    DailyLogResponse,
)
from app.agents.llm import get_llm

router = APIRouter()


def _today_bounds(tz_offset_hours: int = 0):
    """Return start and end of the current day in UTC."""
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(hours=tz_offset_hours)
    end = start + timedelta(days=1) - timedelta(microseconds=1)
    return start, end


def _parse_daily_log(text: str, plan: Plan | None, events: list[CalendarEvent]) -> DailyLogParseResult:
    """Use the LLM to parse a natural-language daily log into structured entries."""
    if not text.strip():
        return DailyLogParseResult(entries=[], summary="No log provided.")

    event_summary = "\n".join([
        f"- {e.type} at {e.date.isoformat()}: {e.title}"
        for e in events
    ])

    target_info = ""
    if plan:
        target_info = f"""
User's daily targets:
- Calorie target: {plan.calorie_target} kcal
- Macros: protein {plan.macros.get('protein_g', 0)}g, carbs {plan.macros.get('carbs_g', 0)}g, fat {plan.macros.get('fat_g', 0)}g
- Weekly workouts: {plan.schedule.get('weekly_workouts', 3)}
"""

    system_message = f"""You are a nutrition and fitness log parser for Bodify, an AI health companion.

Parse the user's natural-language daily log into structured entries. For each entry, estimate calories consumed (for meals) or burned (for workouts) when possible.

Guidelines:
- If the user says they ate a meal or food, create a "meal" entry with estimated calories AND estimated grams of protein, carbs, fat, and fiber. Base estimates on typical portions of the described foods.
- If the user says they exercised, create a "workout" entry with estimated calories burned.
- If the user mentions water intake, create a "hydration" entry with liters_water set to the actual liters ingested.
- If the user mentions sleep, create a "sleep" entry with hours_sleep set to the actual hours slept or expected to sleep.
- Infer time_of_day from context (morning/afternoon/evening/night).
- Set matches_planned_event to true if the entry clearly corresponds to a planned meal or workout.
- Identify missed_event_types for planned events the user clearly skipped.
- Be conservative with calorie/macro estimates. Prefer reasonable ranges over exact precision.
- For hydration and sleep, report EXACTLY what the user said they consumed or slept — do not substitute with target values.
- The tone should be supportive and non-judgmental.

{target_info}

Planned events for today:
{event_summary}

Output JSON matching the DailyLogParseResult schema.
"""

    try:
        llm = get_llm().with_structured_output(DailyLogParseResult)
        result = llm.invoke([
            ("system", system_message),
            ("human", f"Daily log:\n{text}"),
        ])

        # Recompute totals server-side from parsed entries (don't trust LLM to summarize accurately)
        result.total_calories_consumed = sum(
            e.estimated_calories or 0 for e in result.entries if e.type == "meal"
        )
        result.total_calories_burned = sum(
            e.estimated_calories or 0 for e in result.entries if e.type == "workout"
        )
        result.total_grams_protein = sum(
            e.grams_protein or 0 for e in result.entries if e.type == "meal"
        )
        result.total_grams_carbs = sum(
            e.grams_carbs or 0 for e in result.entries if e.type == "meal"
        )
        result.total_grams_fat = sum(
            e.grams_fat or 0 for e in result.entries if e.type == "meal"
        )
        result.total_grams_fiber = sum(
            e.grams_fiber or 0 for e in result.entries if e.type == "meal"
        )
        result.total_liters_water = sum(
            e.liters_water or 0 for e in result.entries if e.type == "hydration"
        )
        result.total_hours_sleep = sum(
            e.hours_sleep or 0 for e in result.entries if e.type == "sleep"
        )

        return result
    except Exception as e:
        print("DAILY LOG PARSE ERROR:", e)
        # Fallback: treat the whole text as one other entry
        return DailyLogParseResult(
            entries=[ParsedLogEntry(type="other", description=text)],
            summary="Bodi had trouble parsing this log, but we've saved it for you.",
        )


def _match_entry_to_event(entry: ParsedLogEntry, events: list[CalendarEvent]) -> CalendarEvent | None:
    """Find the best matching planned event for a parsed log entry.

    Note: hydration and sleep are NOT matched here — they are handled specially in
    submit_daily_log because hydration events form a single cumulative goal and
    sleep is an intent (not yet completed) at log time.
    """
    if entry.type == "meal":
        # Match by time of day
        time_map = {
            "morning": "breakfast",
            "afternoon": "lunch",
            "evening": "dinner",
            "night": "dinner",
        }
        target_meal = time_map.get(entry.time_of_day)
        if not target_meal:
            return None
        for e in events:
            if e.type == "meal" and e.event_metadata and e.event_metadata.get("meal") == target_meal:
                return e
        return None

    if entry.type == "workout":
        for e in events:
            if e.type == "workout":
                return e
        return None

    return None


def _build_status(consumed: int | None, target: int | None) -> str:
    if consumed is None or target is None or target == 0:
        return "on_target"
    ratio = consumed / target
    if ratio < 0.85:
        return "under"
    if ratio > 1.15:
        return "over"
    return "on_target"


def _build_message(status: str, consumed: int | None, target: int | None, has_obesity: bool) -> str:
    consumed_str = str(consumed) if consumed is not None else "unknown"
    target_str = str(target) if target is not None else "unknown"

    base = f"You logged about {consumed_str} kcal today (target: {target_str} kcal). "

    if status == "on_target":
        return base + "Great job — you're right on target for today. Consistency is what matters most."
    if status == "under":
        return base + "You're a bit under your target today. That's okay — we'll make sure tomorrow's meals are satisfying and nutrient-dense."

    # over
    message = base + "You're a bit over your target today. That's completely fine — one day doesn't define your journey. "
    if has_obesity:
        message += "Tomorrow we'll focus on filling, lower-calorie foods like vegetables, lean protein, and whole grains. If you find yourself consistently over target, consider checking in with your doctor or a dietitian for personalized guidance."
    else:
        message += "Tomorrow we'll keep portions moderate and prioritize protein and fiber to help you feel full."
    return message


@router.post("/")
def create_log(
    entry: LogEntry,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = Log(
        id=str(uuid4()),
        user_id=user.id,
        type=entry.type,
        content=entry.content,
    )
    db.add(log)
    db.commit()
    return {"status": "ok", "log_id": log.id}


@router.post("/daily", response_model=DailyLogResponse)
def submit_daily_log(
    submission: DailyLogSubmission,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a natural-language daily log. Bodify parses it, updates event statuses, and returns a summary."""
    if not submission.text.strip():
        raise HTTPException(status_code=400, detail="Log text cannot be empty.")

    # Get active plan
    plan = db.query(Plan).filter(Plan.user_id == user.id, Plan.is_active == True).first()
    if not plan:
        raise HTTPException(status_code=404, detail="No active plan found.")

    # Get today's events using the user's plan timezone (matches how events are generated)
    tz_name = plan.timezone or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")
    now_local = datetime.now(timezone.utc).astimezone(tz)
    today_local_start = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start = today_local_start.astimezone(timezone.utc)
    today_end = today_start + timedelta(days=1)

    events = (
        db.query(CalendarEvent)
        .filter(
            CalendarEvent.user_id == user.id,
            CalendarEvent.date >= today_start,
            CalendarEvent.date < today_end,
        )
        .order_by(CalendarEvent.date)
        .all()
    )

    # Parse the log with LLM
    parsed = _parse_daily_log(submission.text, plan, events)

    # Match meal + workout entries to events and update statuses
    matched_event_ids = set()
    for entry in parsed.entries:
        if entry.type not in ("meal", "workout"):
            continue
        event = _match_entry_to_event(entry, events)
        if event and event.id not in matched_event_ids:
            event.status = "completed"
            if event.event_metadata is None:
                event.event_metadata = {}
            event.event_metadata["logged_description"] = entry.description
            if entry.estimated_calories is not None:
                event.event_metadata["logged_calories"] = entry.estimated_calories
            matched_event_ids.add(event.id)

    # Hydration: mark ALL hydration events as completed if user logged any water intake today.
    # Hydration reminders form one cumulative daily goal — drink toward target liters — so
    # they are treated holistically rather than individually.
    total_water = parsed.total_liters_water or 0
    if total_water > 0:
        for event in events:
            if event.type == "hydration":
                event.status = "completed"
                if event.event_metadata is None:
                    event.event_metadata = {}
                event.event_metadata["logged_liters"] = total_water
                matched_event_ids.add(event.id)

    # Sleep: bedtime log is an INTENT to sleep, not actual sleep hours.
    # Leave the planned sleep event as "pending" — actual hours are confirmed tomorrow.
    # Do NOT mark as skipped.

    # Mark unmentioned planned meals + workouts as skipped.
    # Hydration handled above; sleep stays pending until confirmed.
    planned_skip_types = {"meal", "workout"}
    for event in events:
        if event.type in planned_skip_types and event.id not in matched_event_ids:
            event.status = "skipped"

    db.commit()

    # Refresh events after commit
    events = (
        db.query(CalendarEvent)
        .filter(
            CalendarEvent.user_id == user.id,
            CalendarEvent.date >= today_start,
            CalendarEvent.date < today_end,
        )
        .order_by(CalendarEvent.date)
        .all()
    )

# Determine calorie status (computed before persisting so the Log content stores everything needed to restore state on reload)
    consumed = parsed.total_calories_consumed
    target = plan.calorie_target
    status = _build_status(consumed, target)

    # Check for obesity-related conditions from profile
    # This is a simple heuristic; medical decisions should always involve a professional.
    profile = getattr(user, "profile", None)
    has_obesity = False
    if profile and isinstance(profile, dict):
        medical = profile.get("medical", {})
        conditions = [c.lower() for c in medical.get("conditions", [])]
        has_obesity = "obesity" in conditions

    message = _build_message(status, consumed, target, has_obesity)

    # Store the raw log with all response fields so /log/today-status can restore DailyLogResult on reload
    log = Log(
        id=str(uuid4()),
        user_id=user.id,
        type="daily_log",
        content={
            "text": submission.text,
            "parsed": parsed.model_dump(mode="json"),
            "date": today_start.isoformat(),
            "message": message,
            "status": status,
            "calorie_target": target,
            "calories_consumed": consumed,
        },
    )
    db.add(log)
    db.commit()

    return DailyLogResponse(
        parsed=parsed,
        updated_events=[
            {
                "id": e.id,
                "type": e.type,
                "title": e.title,
                "status": e.status,
                "date": e.date.isoformat(),
                "metadata": e.event_metadata,
            }
            for e in events
        ],
        calorie_target=target,
        calories_consumed=consumed,
        status=status,  # type: ignore[arg-type]
        message=message,
    )

@router.get("/today-status")
def get_today_status(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return today's daily log if one was already submitted, plus submitted flag.

    The frontend uses this on mount to restore Daily Progress after a reload and to lock the end-of-day log UI until tomorrow.
    """
    plan = db.query(Plan).filter(Plan.user_id == user.id, Plan.is_active == True).first()
    tz_name = plan.timezone if plan and plan.timezone else "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")
    now_local = datetime.now(timezone.utc).astimezone(tz)
    today_local_start = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start = today_local_start.astimezone(timezone.utc)
    today_end = today_start + timedelta(days=1)

    log = (
        db.query(Log)
        .filter(
            Log.user_id == user.id,
            Log.type == "daily_log",
            Log.created_at >= today_start,
            Log.created_at < today_end,
        )
        .order_by(Log.created_at.desc())
        .first()
    )

    events = (
        db.query(CalendarEvent)
        .filter(
            CalendarEvent.user_id == user.id,
            CalendarEvent.date >= today_start,
            CalendarEvent.date < today_end,
        )
        .order_by(CalendarEvent.date)
        .all()
    )

    updated_events = [
        {
            "id": e.id,
            "type": e.type,
            "title": e.title,
            "status": e.status,
            "date": e.date.isoformat(),
            "metadata": e.event_metadata,
        }
        for e in events
    ]

    if not log:
        return {
            "submitted": False,
            "parsed": None,
            "message": "",
            "status": None,
            "calorie_target": plan.calorie_target if plan else None,
            "calories_consumed": None,
            "updated_events": updated_events,
        }

    content = log.content or {}
    return {
        "submitted": True,
        "parsed": content.get("parsed"),
        "message": content.get("message", ""),
        "status": content.get("status", "on_target"),
        "calorie_target": content.get("calorie_target", plan.calorie_target if plan else None),
        "calories_consumed": content.get("calories_consumed"),
        "updated_events": updated_events,
    }

@router.get("/")
def get_logs(
    limit: int = 50,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(Log)
        .filter(Log.user_id == user.id)
        .order_by(Log.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "logs": [
            {
                "id": l.id,
                "type": l.type,
                "content": l.content,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ]
    }


@router.get("/recent")
def get_recent_logs(
    days: int = 14,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return recent daily logs for adaptive planning."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    logs = (
        db.query(Log)
        .filter(
            Log.user_id == user.id,
            Log.type == "daily_log",
            Log.created_at >= since,
        )
        .order_by(Log.created_at.desc())
        .all()
    )
    return {
        "logs": [
            {
                "id": l.id,
                "content": l.content,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ]
    }
