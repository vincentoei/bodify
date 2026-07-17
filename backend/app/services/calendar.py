"""Targeted calendar mutation executor for Recovery chat.

Receives a list of CalendarMutation (from recovery_coordinator_node) and applies
them to CalendarEvent rows. Never mutates events already completed or skipped
today — those reflect what the user actually did and must be preserved.

Mutations reference events by date (ISO yyyy-mm-dd). All events on that date
matching the optional `event_type` are affected. If `event_type` is None, all
events on that date are affected — used sparingly (e.g., travel days where
workouts + meals are all replaced by a "travel" placeholder).
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, available_timezones
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.database import CalendarEvent, Plan
from app.models.schemas import CalendarMutation, ExtractedFact


def _parse_iso_date(s: str, tz: ZoneInfo) -> tuple[datetime, datetime]:
    """Return [start, end) UTC bounds for the given local ISO date string."""
    if "T" in s:
        local_start = datetime.fromisoformat(s).astimezone(tz)
    else:
        naive = datetime.fromisoformat(s + "T00:00:00")
        local_start = naive.replace(tzinfo=tz)
    local_end = local_start + timedelta(days=1)
    return local_start.astimezone(timezone.utc), local_end.astimezone(timezone.utc)


def _ensure_metadata(event: CalendarEvent) -> dict[str, Any]:
    if event.event_metadata is None:
        event.event_metadata = {}
    return event.event_metadata


def apply_calendar_mutations(
    db: Session,
    user_id: str,
    mutations: list[CalendarMutation],
    plan: Plan | None,
) -> list[dict[str, Any]]:
    """Apply targeted mutations to calendar events. Returns a changelog.

    Never mutates events with status in {"completed", "skipped"} — preserve what
    the user actually did today.
    """
    if not mutations or not plan:
        return []

    tz_name = plan.timezone or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")

    protected_statuses = {"completed", "skipped"}
    changelog: list[dict[str, Any]] = []

    for m in mutations:
        try:
            start_utc, end_utc = _parse_iso_date(m.date, tz)
        except Exception as e:
            changelog.append({"date": m.date, "action": m.action, "error": f"bad date: {e}"})
            continue

        events = (
            db.query(CalendarEvent)
            .filter(
                CalendarEvent.user_id == user_id,
                CalendarEvent.date >= start_utc,
                CalendarEvent.date < end_utc,
            )
            .order_by(CalendarEvent.date)
            .all()
        )

        for ev in events:
            if ev.status in protected_statuses:
                continue
            if m.event_type and ev.type != m.event_type:
                continue
            # Narrow to a specific meal when requested (e.g. only breakfast).
            if m.meal_filter and ev.type == "meal":
                ev_meal = (ev.event_metadata or {}).get("meal")
                if ev_meal != m.meal_filter:
                    continue
            # Narrow to events whose title matches any keyword.
            if m.title_keywords:
                title_lower = ev.title.lower()
                if not any(kw.lower() in title_lower for kw in m.title_keywords):
                    continue

            if m.action == "skip":
                ev.status = "skipped"
                md = _ensure_metadata(ev)
                md["recovery_reason"] = m.reason or "skipped by recovery"
                changelog.append({
                    "event_id": ev.id, "date": ev.date.isoformat(), "type": ev.type,
                    "action": "skip", "title": ev.title,
                })

            elif m.action == "replace":
                if m.new_title:
                    ev.title = m.new_title
                if m.new_description:
                    ev.description = m.new_description
                md = _ensure_metadata(ev)
                md["recovery_reason"] = m.reason or "replaced by recovery"
                changelog.append({
                    "event_id": ev.id, "date": ev.date.isoformat(), "type": ev.type,
                    "action": "replace", "title": ev.title,
                })

            elif m.action == "reschedule":
                if not m.new_date:
                    continue
                try:
                    new_start_utc, _ = _parse_iso_date(m.new_date, tz)
                except Exception:
                    continue
                # Preserve time-of-day component from the original event when possible
                old_local = ev.date.astimezone(tz)
                time_of_day = old_local - old_local.replace(hour=0, minute=0, second=0, microsecond=0)
                new_local = new_start_utc.replace(tzinfo=tz) if new_start_utc.tzinfo is None else new_start_utc.astimezone(tz)
                # _parse_iso_date returns UTC; we want local midnight then add time-of-day
                new_local_midnight = new_local.replace(hour=0, minute=0, second=0, microsecond=0)
                new_dt_local = new_local_midnight + time_of_day
                ev.date = new_dt_local.astimezone(timezone.utc)
                ev.status = "rescheduled"
                md = _ensure_metadata(ev)
                md["recovery_reason"] = m.reason or "rescheduled by recovery"
                md["original_date"] = old_local.date().isoformat()
                changelog.append({
                    "event_id": ev.id, "date": ev.date.isoformat(), "type": ev.type,
                    "action": "rescheduled", "title": ev.title,
                })

            elif m.action == "add":
                # Insert a new event on this date
                try:
                    add_start_utc, _ = _parse_iso_date(m.date, tz)
                except Exception:
                    continue
                ev_type = m.event_type or "recovery"
                title = m.new_title or "Recovery reminder"
                new_ev = CalendarEvent(
                    id=str(uuid4()),
                    user_id=user_id,
                    date=add_start_utc,
                    type=ev_type,
                    title=title,
                    description=m.new_description,
                    status="pending",
                    event_metadata={"recovery_reason": m.reason or "added by recovery"},
                )
                db.add(new_ev)
                changelog.append({
                    "event_id": new_ev.id, "date": new_ev.date.isoformat(), "type": new_ev.type,
                    "action": "add", "title": new_ev.title,
                })

    db.commit()
    return changelog


# ponytail: keep keyword list narrow for now; expand via memory categories or
# user-configurable filters once we see more injury patterns.
LEG_EXERCISE_KEYWORDS = [
    "yoga", "cycling", "cycling", "spin", "bike", "biking", "running", "run",
    "leg", "squat", "lunge", "lower body", "hike", "hiking", "jump", "plyo",
]

INJURY_CONTENT_KEYWORDS = [
    "leg", "knee", "ankle", "foot", "hip", "injury", "injured", "hurt",
    "broken", "sprain", "fracture", "pain", "surgery", "torn",
]


def _event_date_local(ev: CalendarEvent, tz: ZoneInfo) -> datetime.date:
    dt = ev.date
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(tz).date()


def generate_fallback_mutations_for_facts(
    facts: list[ExtractedFact],
    events: list[CalendarEvent],
    plan: Plan | None,
) -> list[CalendarMutation]:
    """Deterministic fallback when the LLM coordinator emits no mutations.

    For each injury fact with a TTL, skip leg-bearing workouts scheduled within
    that window. Keeps upper-body and non-matching sessions intact.
    """
    if not facts or not events or not plan:
        return []

    tz_name = plan.timezone or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")

    today = datetime.now(timezone.utc).astimezone(tz).date()
    seen: set[str] = set()
    mutations: list[CalendarMutation] = []

    for fact in facts:
        if fact.category != "injury":
            continue
        content_lower = fact.content.lower()
        if not any(kw in content_lower for kw in INJURY_CONTENT_KEYWORDS):
            continue

        window_days = fact.ttl_days if fact.ttl_days is not None else 30

        for ev in events:
            if ev.type != "workout":
                continue
            ev_date = _event_date_local(ev, tz)
            days_from_today = (ev_date - today).days
            if days_from_today < 0 or days_from_today > window_days:
                continue

            title_lower = ev.title.lower()
            matched = [kw for kw in LEG_EXERCISE_KEYWORDS if kw in title_lower]
            if not matched:
                continue

            key = f"{ev_date.isoformat()}|workout|{','.join(sorted(matched))}"
            if key in seen:
                continue
            seen.add(key)

            mutations.append(CalendarMutation(
                action="skip",
                date=ev_date.isoformat(),
                event_type="workout",
                title_keywords=matched,
                reason=f"auto-skipped for injury fact: {fact.content}",
            ))

    return mutations