from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Literal

from app.core.auth import get_current_user, CurrentUser
from app.models.database import get_db, CalendarEvent

router = APIRouter()


@router.get("/")
def get_calendar(
    start: str = Query(...),
    end: str = Query(...),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start_dt = datetime.fromisoformat(start)
    end_dt = datetime.fromisoformat(end)

    events = (
        db.query(CalendarEvent)
        .filter(
            CalendarEvent.user_id == user.id,
            CalendarEvent.date >= start_dt,
            CalendarEvent.date <= end_dt,
        )
        .order_by(CalendarEvent.date)
        .all()
    )

    return {
        "events": [
            {
                "id": e.id,
                "date": e.date.isoformat(),
                "type": e.type,
                "title": e.title,
                "description": e.description,
                "status": e.status,
                "metadata": e.event_metadata,
            }
            for e in events
        ]
    }


@router.patch("/{event_id}/status")
def update_event_status(
    event_id: str,
    status: Literal["pending", "completed", "skipped", "rescheduled"],
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = (
        db.query(CalendarEvent)
        .filter(CalendarEvent.id == event_id, CalendarEvent.user_id == user.id)
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = status
    db.commit()
    return {"status": "ok"}
