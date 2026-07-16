from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, available_timezones
from typing import Any
import time
import re
import asyncio
import json

from app.core.auth import get_current_user, CurrentUser
from app.models.database import get_db, Profile, Plan, User, CalendarEvent, Log
from app.models.schemas import (
    CoordinatorDecision,
    CalendarEventItem,
    UserProfile,
    PlanRecommendation,
    MacroTargets,
    SpecialistOutput,
    MealPlan,
    WorkoutPlan,
    MealOption,
    WorkoutOption,
)
from app.agents.graph.nodes import orchestrator_node, AGENT_REGISTRY
from app.agents.coordinator import coordinator_node
from app.agents.graph.state import AgentState

router = APIRouter()


def _call_agent_with_retry(agent_func, state: AgentState, max_retries: int = 3):
    """Call an agent node with automatic retry on rate-limit (429) errors."""
    for attempt in range(max_retries):
        try:
            return agent_func(state)
        except Exception as e:
            error_str = str(e)
            if "429" in error_str and "rate limit" in error_str.lower():
                match = re.search(r"try again in ([\d.]+)s", error_str)
                if match:
                    delay = float(match.group(1)) + 2  # 2 s buffer
                else:
                    delay = 10 * (attempt + 1)  # Fallback backoff
                if attempt < max_retries - 1:
                    print(
                        f"Rate limited on {agent_func.__name__}, "
                        f"waiting {delay:.1f}s (retry {attempt + 2}/{max_retries})..."
                    )
                    time.sleep(delay)
                    continue
            raise


def _naive(date: datetime) -> datetime:
    """Strip timezone info for consistent arithmetic."""
    return date.replace(tzinfo=None) if date.tzinfo else date


def _utc_start_of_day(date: datetime | None = None) -> datetime:
    """Return UTC midnight for the given date, or for now if no date is passed."""
    if date is None:
        date = datetime.now(timezone.utc)
    elif date.tzinfo is None:
        date = date.replace(tzinfo=timezone.utc)
    return date.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


def _local_start_of_day(utc_date: datetime, tz_name: str) -> datetime:
    """Convert a UTC date to local midnight in the given timezone."""
    tz = ZoneInfo(tz_name)
    if utc_date.tzinfo is None:
        utc_date = utc_date.replace(tzinfo=timezone.utc)
    return utc_date.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)


def _local_to_utc(local_dt: datetime) -> datetime:
    """Convert a timezone-aware local datetime to UTC."""
    return local_dt.astimezone(ZoneInfo("UTC"))


def _current_week_number(plan_start_date: datetime, reference_date: datetime) -> int:
    """Calculate which week of the plan a reference date falls into (1-based).

    Week 1 starts on the plan start date. Each subsequent week is a 7-day window.
    """
    start = _naive(_utc_start_of_day(plan_start_date))
    current = _naive(_utc_start_of_day(reference_date))
    days_diff = (current - start).days
    return max(1, (days_diff // 7) + 1)


def _get_phase_for_week(week: int, phases: list) -> str | None:
    """Return the phase name for a given week.

    Handles both Pydantic PlanPhase objects and plain dicts (from stored JSON).
    """
    for phase in phases:
        week_start = phase.week_start if hasattr(phase, "week_start") else phase["week_start"]
        week_end = phase.week_end if hasattr(phase, "week_end") else phase["week_end"]
        if week_start <= week <= week_end:
            return phase.name if hasattr(phase, "name") else phase["name"]
    if phases:
        last = phases[-1]
        return last.name if hasattr(last, "name") else last["name"]
    return None


def _phase_adjusted_workout_focus(phase_name: str | None, base_duration: int) -> tuple[str, str]:
    """Return a workout description and adjusted duration hint based on the current phase."""
    phase = (phase_name or "").lower()
    if "adaptation" in phase or "foundation" in phase:
        return (
            f"{base_duration} min full-body foundation session — focus on form and consistency",
            "low",
        )
    if "progress" in phase or "build" in phase:
        return (
            f"{base_duration} min progressive session — increase intensity or resistance",
            "moderate",
        )
    if "consolidation" in phase or "maintenance" in phase:
        return (
            f"{base_duration} min maintenance session — sustain your gains",
            "moderate",
        )
    return (
        f"{base_duration} min session designed for your goal",
        "moderate",
    )


def _validate_timezone(tz_name: str | None) -> str:
    """Return a valid IANA timezone name or fallback to UTC."""
    if tz_name and tz_name in available_timezones():
        return tz_name
    return "UTC"


def _format_recent_logs(logs: list[Log]) -> str:
    """Format recent daily logs for inclusion in the coordinator prompt."""
    if not logs:
        return "No recent logs available."

    lines = []
    for log in logs[:10]:
        content = log.content or {}
        text = content.get("text", "")
        parsed = content.get("parsed", {})
        summary = parsed.get("summary", "") if isinstance(parsed, dict) else ""
        lines.append(f"- {log.created_at.date()}: {text or summary}")

    return "\n".join(lines)


def _validate_meal_plan(meal_plan: Any | None, calorie_target: int) -> MealPlan:
    """Ensure a meal plan has exactly 7 options for each meal type.

    If the LLM output is missing or incomplete, return a safe default plan.
    """
    if meal_plan:
        try:
            validated = MealPlan.model_validate(meal_plan)
            if len(validated.breakfast_options) >= 7 and len(validated.lunch_options) >= 7 and len(validated.dinner_options) >= 7:
                return validated
        except Exception:
            pass

    default = MealOption(name="Balanced meal", cuisine="mixed", prep_time="15 min")
    return MealPlan(
        breakfast_options=[default.model_copy(update={"name": f"Breakfast option {i+1}"}) for i in range(7)],
        lunch_options=[default.model_copy(update={"name": f"Lunch option {i+1}"}) for i in range(7)],
        dinner_options=[default.model_copy(update={"name": f"Dinner option {i+1}"}) for i in range(7)],
    )


def _validate_workout_plan(workout_plan: Any | None, weekly_workouts: int) -> WorkoutPlan:
    """Ensure a workout plan has enough options.

    If the LLM output is missing or incomplete, return a safe default plan.
    """
    count = max(weekly_workouts, 4)
    if workout_plan:
        try:
            validated = WorkoutPlan.model_validate(workout_plan)
            if len(validated.options) >= count:
                return validated
        except Exception:
            pass

    return WorkoutPlan(
        options=[
            WorkoutOption(
                name=f"Workout {i+1}",
                focus="full body",
                duration_min=30,
                intensity="moderate",
            )
            for i in range(count)
        ]
    )


def _format_prep_time(prep_time: str | None) -> str:
    """Normalize prep_time to a readable format with units and 'prep'."""
    if not prep_time:
        return "15 min prep"

    value = str(prep_time).strip()

    # If it's just a number, add "min prep"
    if value.isdigit():
        return f"{value} min prep"

    # If it already ends with "prep", leave it as-is
    if value.lower().endswith("prep"):
        return value

    # If it ends with "min" or "hr" but no "prep", add " prep"
    if value.lower().endswith(("min", "hr", "hour", "hours")):
        return f"{value} prep"

    # Otherwise add "min prep" as a fallback
    return f"{value} min prep"


def _get_meal_option(meal_plan: MealPlan, meal_type: str, day_offset: int) -> dict[str, Any]:
    """Pick a meal option for a given day and meal type."""
    options = {
        "breakfast": meal_plan.breakfast_options,
        "lunch": meal_plan.lunch_options,
        "dinner": meal_plan.dinner_options,
    }.get(meal_type, [])

    if not options:
        return {}

    option = options[day_offset % len(options)]
    return {
        "name": option.name,
        "cuisine": option.cuisine,
        "prep_time": _format_prep_time(option.prep_time),
    }


def _get_workout_option(workout_plan: WorkoutPlan, day_offset: int) -> dict[str, Any]:
    """Pick a workout option for a given day."""
    if not workout_plan.options:
        return {}
    option = workout_plan.options[day_offset % len(workout_plan.options)]
    return {
        "name": option.name,
        "focus": option.focus,
        "duration_min": option.duration_min,
        "intensity": option.intensity,
    }


def generate_calendar_events(
    decision: CoordinatorDecision,
    local_day_start: datetime,
    timezone_name: str = "UTC",
    current_week: int = 1,
    window_days: int = 7,
    day_offset_start: int = 0,
) -> list[CalendarEventItem]:
    """Generate a rolling window of calendar events starting from a local day.

    The returned events are converted to UTC for storage. The frontend converts
    them back to local time for display, so 08:00 breakfast stays 08:00 local.

    day_offset_start is used to rotate meal and workout options across weeks.
    """
    events = []
    plan = decision.final_recommendation
    current_phase = _get_phase_for_week(current_week, plan.phases)

    meal_plan = _validate_meal_plan(plan.meal_plan, plan.calorie_target)
    workout_plan = _validate_workout_plan(plan.workout_plan, plan.weekly_workouts)

    for day_offset in range(window_days):
        global_day_offset = day_offset_start + day_offset

        # Meals
        for meal, hour in [
            ("Breakfast", 8),
            ("Lunch", 13),
            ("Dinner", 19),
        ]:
            local_dt = local_day_start + timedelta(days=day_offset, hours=hour)
            meal_option = _get_meal_option(meal_plan, meal.lower(), global_day_offset)
            events.append(CalendarEventItem(
                id=str(uuid4()),
                date=_local_to_utc(local_dt),
                type="meal",
                title=meal,
                description=f"{meal_option.get('name', 'Balanced meal')} ({meal_option.get('cuisine', 'mixed')}, {meal_option.get('prep_time', '15 min prep')})",
                event_metadata={
                    "meal": meal.lower(),
                    "target_calories": plan.calorie_target // 3,
                    "week": current_week,
                    "phase": current_phase,
                    **meal_option,
                },
            ))

        # Hydration reminders
        for hour in [9, 14, 17]:
            local_dt = local_day_start + timedelta(days=day_offset, hours=hour)
            events.append(CalendarEventItem(
                id=str(uuid4()),
                date=_local_to_utc(local_dt),
                type="hydration",
                title="Hydration",
                description=f"Drink water toward {plan.hydration_liters}L goal",
                event_metadata={"week": current_week, "phase": current_phase},
            ))

        # Workouts based on weekly frequency
        if plan.weekly_workouts >= 4:
            workout_days = [0, 2, 4, 6]
        elif plan.weekly_workouts >= 3:
            workout_days = [0, 2, 4]
        elif plan.weekly_workouts >= 2:
            workout_days = [1, 4]
        else:
            workout_days = [2]

        if day_offset in workout_days:
            local_dt = local_day_start + timedelta(days=day_offset, hours=18)
            workout_option = _get_workout_option(workout_plan, global_day_offset)
            events.append(CalendarEventItem(
                id=str(uuid4()),
                date=_local_to_utc(local_dt),
                type="workout",
                title=workout_option.get("name", "Workout"),
                description=f"{workout_option.get('focus', 'Full body')} — {workout_option.get('intensity', 'moderate')} intensity",
                event_metadata={
                    "duration_min": workout_option.get("duration_min", plan.workout_duration_min),
                    "intensity": workout_option.get("intensity", "moderate"),
                    "week": current_week,
                    "phase": current_phase,
                    **workout_option,
                },
            ))

        # Sleep goal
        local_dt = local_day_start + timedelta(days=day_offset, hours=22)
        events.append(CalendarEventItem(
            id=str(uuid4()),
            date=_local_to_utc(local_dt),
            type="sleep",
            title="Wind Down",
            description=f"Aim for {plan.sleep_hours_target} hours of sleep",
            event_metadata={
                "target_hours": plan.sleep_hours_target,
                "week": current_week,
                "phase": current_phase,
            },
        ))

    return events


def _build_plan_entity(
    user_id: str,
    decision: CoordinatorDecision,
    utc_start: datetime,
    timezone_name: str = "UTC",
) -> Plan:
    """Build a Plan ORM entity from a coordinator decision."""
    recommendation = decision.final_recommendation
    target_duration_weeks = recommendation.target_duration_weeks or 12

    # Target date is start date + duration weeks.
    target_date = _utc_start_of_day(utc_start) + timedelta(weeks=target_duration_weeks)

    current_phase = _get_phase_for_week(1, recommendation.phases)

    return Plan(
        id=str(uuid4()),
        user_id=user_id,
        is_active=True,
        calorie_target=recommendation.calorie_target,
        macros=recommendation.macros.model_dump(),
        schedule={"weekly_workouts": recommendation.weekly_workouts},
        reasoning=decision.model_dump(mode="json"),
        target_duration_weeks=target_duration_weeks,
        target_date=target_date,
        current_week=1,
        current_phase=current_phase,
        timezone=timezone_name,
        generation_window_days=7,
        last_generated_at=datetime.now(timezone.utc),
    )


def _save_plan_and_events(
    db: Session,
    user_id: str,
    decision: CoordinatorDecision,
    utc_start: datetime,
    timezone_name: str = "UTC",
    current_week: int = 1,
    window_days: int = 7,
    deactivate_old: bool = True,
):
    """Persist a plan and generate its rolling calendar window."""
    if deactivate_old:
        db.query(Plan).filter(Plan.user_id == user_id).update({"is_active": False})

    plan = _build_plan_entity(user_id, decision, utc_start, timezone_name)
    plan.current_week = current_week
    db.add(plan)

    # Generate events starting from the user's local midnight today.
    local_day_start = _local_start_of_day(utc_start, timezone_name)
    calendar_items = generate_calendar_events(
        decision,
        local_day_start,
        timezone_name=timezone_name,
        current_week=current_week,
        window_days=window_days,
        day_offset_start=0,
    )

    # Remove future events for this user and replace.
    utc_day_start = _utc_start_of_day(utc_start)
    db.query(CalendarEvent).filter(
        CalendarEvent.user_id == user_id,
        CalendarEvent.date >= utc_day_start,
    ).delete()

    for item in calendar_items:
        event = CalendarEvent(
            id=item.id or str(uuid4()),
            user_id=user_id,
            date=item.date,
            type=item.type,
            title=item.title,
            description=item.description,
            status=item.status,
            event_metadata=item.event_metadata,
        )
        db.add(event)

    db.commit()
    return plan


def _fallback_decision(error: Exception) -> CoordinatorDecision:
    """Return a safe default plan when AI services are unavailable."""
    macros = MacroTargets(protein_g=120, carbs_g=180, fat_g=60, fiber_g=30)
    return CoordinatorDecision(
        final_recommendation=PlanRecommendation(
            calorie_target=2000,
            macros=macros,
            weekly_workouts=3,
            workout_duration_min=30,
            daily_steps_goal=7000,
            sleep_hours_target=7.5,
            hydration_liters=2.5,
            notes="This is a safe default plan generated because the AI service was temporarily unavailable. Please try regenerating your plan later.",
        ),
        specialist_outputs=[
            SpecialistOutput(
                agent_name="Coordinator Agent",
                role="Final decision synthesis",
                recommendation={"status": "fallback"},
                evidence="Default safe values",
                confidence=0.5,
                rationale=f"AI service unavailable: {str(error)}",
            )
        ],
        conflicts=[],
        resolution_summary="A safe default plan was used because the AI service was unavailable.",
    )


@router.post("/generate")
def generate_plan(
    timezone_str: str = Query(
        "UTC",
        alias="timezone",
        description="User's IANA timezone (e.g., Asia/Singapore)",
    ),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Complete onboarding first.")

    user_profile = UserProfile(
        goals=profile.goals,
        primary_goal=profile.primary_goal,
        body=profile.body,
        medical=profile.medical,
        lifestyle=profile.lifestyle,
        psychology=profile.psychology,
    )

    # Fetch recent daily logs to adapt the plan to user preferences
    recent_logs = (
        db.query(Log)
        .filter(Log.user_id == user.id, Log.type == "daily_log")
        .order_by(Log.created_at.desc())
        .limit(10)
        .all()
    )
    recent_logs_text = _format_recent_logs(recent_logs)

    initial_state: AgentState = {
        "event_type": "onboarding",
        "profile": user_profile,
        "recent_logs": [],
        "context": {"recent_logs": recent_logs_text},
        "selected_agents": [],
        "agent_outputs": {},
        "conflicts": [],
        "coordinator_decision": None,
        "user_feedback": None,
        "approved": None,
        "iteration": 0,
    }

    try:
        orch_result = orchestrator_node(initial_state)
        initial_state["selected_agents"] = orch_result["selected_agents"]
        if "context" in orch_result:
            initial_state["context"].update(orch_result["context"])

        print(f"Orchestrator selected agents: {initial_state['selected_agents']}")

        for agent_name in initial_state["selected_agents"]:
            agent_func = AGENT_REGISTRY[agent_name]
            result = _call_agent_with_retry(agent_func, initial_state)
            initial_state["agent_outputs"].update(result["agent_outputs"])
            print(f"Agent '{agent_name}' completed")
            time.sleep(0.5)

        coord_result = coordinator_node(initial_state)
        decision: CoordinatorDecision = coord_result["coordinator_decision"]
        print("Coordinator decision ready")

    except Exception as e:
        print("AGENT GRAPH ERROR:", e)
        import traceback
        traceback.print_exc()
        decision = _fallback_decision(e)

    timezone_name = _validate_timezone(timezone_str)
    utc_start = datetime.now(timezone.utc)
    _save_plan_and_events(db, user.id, decision, utc_start, timezone_name=timezone_name)

    return {"plan": decision}


@router.post("/generate-stream")
async def generate_plan_stream(
    timezone_str: str = Query(
        "UTC",
        alias="timezone",
        description="User's IANA timezone (e.g., Asia/Singapore)",
    ),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream agent deliberation progress in real-time via SSE."""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Complete onboarding first.")

    user_profile = UserProfile(
        goals=profile.goals,
        primary_goal=profile.primary_goal,
        body=profile.body,
        medical=profile.medical,
        lifestyle=profile.lifestyle,
        psychology=profile.psychology,
    )

    # Fetch recent daily logs to adapt the plan to user preferences
    recent_logs = (
        db.query(Log)
        .filter(Log.user_id == user.id, Log.type == "daily_log")
        .order_by(Log.created_at.desc())
        .limit(10)
        .all()
    )
    recent_logs_text = _format_recent_logs(recent_logs)

    initial_state: AgentState = {
        "event_type": "onboarding",
        "profile": user_profile,
        "recent_logs": [],
        "context": {"recent_logs": recent_logs_text},
        "selected_agents": [],
        "agent_outputs": {},
        "conflicts": [],
        "coordinator_decision": None,
        "user_feedback": None,
        "approved": None,
        "iteration": 0,
    }

    timezone_name = _validate_timezone(timezone_str)

    async def event_generator():
        loop = asyncio.get_event_loop()
        try:
            orch_result = await loop.run_in_executor(None, orchestrator_node, initial_state)
            initial_state["selected_agents"] = orch_result["selected_agents"]
            if "context" in orch_result:
                initial_state["context"].update(orch_result["context"])

            agent_names = initial_state["selected_agents"]
            total = len(agent_names)

            yield f"event: start\ndata: {json.dumps({'total_agents': total, 'agent_names': agent_names})}\n\n"

            for idx, agent_name in enumerate(agent_names, start=1):
                agent_func = AGENT_REGISTRY[agent_name]
                result = await loop.run_in_executor(
                    None, _call_agent_with_retry, agent_func, initial_state
                )
                initial_state["agent_outputs"].update(result["agent_outputs"])
                agent_output = result["agent_outputs"][agent_name]

                yield f"event: agent\ndata: {json.dumps({
                    'agent_name': agent_output.agent_name,
                    'role': agent_output.role,
                    'confidence': agent_output.confidence,
                    'rationale': agent_output.rationale,
                    'index': idx,
                    'total': total,
                })}\n\n"

                await asyncio.sleep(0.4)

            coord_result = await loop.run_in_executor(None, coordinator_node, initial_state)
            decision: CoordinatorDecision = coord_result["coordinator_decision"]

            yield f"event: coordinator\ndata: {json.dumps({
                'final_recommendation': decision.final_recommendation.model_dump(mode='json'),
                'resolution_summary': decision.resolution_summary,
                'conflicts': [c.model_dump(mode='json') for c in decision.conflicts],
                'specialist_outputs': [o.model_dump(mode='json') for o in decision.specialist_outputs],
            })}\n\n"

            def _save_to_db():
                utc_start = datetime.now(timezone.utc)
                _save_plan_and_events(db, user.id, decision, utc_start, timezone_name=timezone_name)
                return True

            await loop.run_in_executor(None, _save_to_db)

            yield f"event: done\ndata: {json.dumps({'status': 'complete'})}\n\n"

        except Exception as e:
            print("STREAMING ERROR:", e)
            import traceback
            traceback.print_exc()
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )


@router.get("/current")
def get_current_plan(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.user_id == user.id, Plan.is_active == True).first()
    if not plan:
        return {"plan": None}

    # Re-serialize stored reasoning so datetime fields become JSON-safe strings.
    try:
        decision = CoordinatorDecision.model_validate(plan.reasoning)
        return {"plan": decision.model_dump(mode="json")}
    except Exception:
        return {"plan": plan.reasoning}


@router.get("/status")
def get_plan_status(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the active plan's progress, phases, and whether it needs a weekly regeneration."""
    plan = db.query(Plan).filter(Plan.user_id == user.id, Plan.is_active == True).first()
    if not plan:
        return {"plan": None, "needs_regeneration": False}

    now = datetime.now(timezone.utc)
    current_week = _current_week_number(plan.created_at, now)
    current_phase = _get_phase_for_week(current_week, plan.reasoning.get("final_recommendation", {}).get("phases", []))

    # Determine if we have rolled into a new week since last generation.
    last_generated_week = (
        _current_week_number(plan.created_at, plan.last_generated_at)
        if plan.last_generated_at else 0
    )
    needs_regeneration = current_week > last_generated_week

    return {
        "plan": {
            "target_duration_weeks": plan.target_duration_weeks,
            "target_date": plan.target_date.isoformat() if plan.target_date else None,
            "current_week": current_week,
            "current_phase": current_phase,
            "phases": plan.reasoning.get("final_recommendation", {}).get("phases", []),
            "timezone": plan.timezone,
            "last_generated_at": plan.last_generated_at.isoformat() if plan.last_generated_at else None,
        },
        "needs_regeneration": needs_regeneration,
    }


@router.post("/regenerate-week")
def regenerate_week(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate the current week's events based on the active plan. Called lazily from the dashboard."""
    plan = db.query(Plan).filter(Plan.user_id == user.id, Plan.is_active == True).first()
    if not plan:
        raise HTTPException(status_code=404, detail="No active plan found.")

    timezone_name = _validate_timezone(plan.timezone)
    now = datetime.now(timezone.utc)
    current_week = _current_week_number(plan.created_at, now)

    # Compute the start of the current 7-day window in UTC and local time.
    plan_start = _utc_start_of_day(plan.created_at)
    utc_window_start = plan_start + timedelta(days=(current_week - 1) * 7)
    local_window_start = _local_start_of_day(utc_window_start, timezone_name)

    # Load the stored decision
    try:
        decision = CoordinatorDecision.model_validate(plan.reasoning)
    except Exception:
        raise HTTPException(status_code=500, detail="Stored plan decision is invalid.")

    # Delete any events from the start of this window onward
    db.query(CalendarEvent).filter(
        CalendarEvent.user_id == user.id,
        CalendarEvent.date >= utc_window_start,
    ).delete()

    window_days = plan.generation_window_days or 7
    # Rotate meal/workout options by one day each week so weekly menus do not repeat exactly.
    day_offset_start = current_week - 1
    calendar_items = generate_calendar_events(
        decision,
        local_window_start,
        timezone_name=timezone_name,
        current_week=current_week,
        window_days=window_days,
        day_offset_start=day_offset_start,
    )

    current_phase = _get_phase_for_week(current_week, decision.final_recommendation.phases)

    for item in calendar_items:
        event = CalendarEvent(
            id=item.id or str(uuid4()),
            user_id=user.id,
            date=item.date,
            type=item.type,
            title=item.title,
            description=item.description,
            status=item.status,
            event_metadata=item.event_metadata,
        )
        db.add(event)

    plan.current_week = current_week
    plan.current_phase = current_phase
    plan.last_generated_at = now
    db.commit()

    return {
        "status": "ok",
        "current_week": current_week,
        "current_phase": current_phase,
        "generated_events": len(calendar_items),
    }
