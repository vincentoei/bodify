from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import uuid4

from app.core.auth import get_current_user, CurrentUser
from app.core.supabase import get_supabase
from app.models.database import get_db, Profile, User
from app.models.schemas import UserProfile

router = APIRouter()


@router.post("/profile")
def create_profile(
    profile_data: UserProfile,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Ensure user exists in our DB
    db_user = db.query(User).filter(User.id == user.id).first()
    if not db_user:
        db_user = User(id=user.id, email=user.email)
        db.add(db_user)
        db.commit()

    # Upsert profile
    existing = db.query(Profile).filter(Profile.user_id == user.id).first()
    if existing:
        existing.goals = profile_data.goals
        existing.primary_goal = profile_data.primary_goal
        existing.body = profile_data.body.model_dump()
        existing.medical = profile_data.medical.model_dump()
        existing.lifestyle = profile_data.lifestyle.model_dump()
        existing.psychology = profile_data.psychology.model_dump()
    else:
        profile = Profile(
            id=str(uuid4()),
            user_id=user.id,
            goals=profile_data.goals,
            primary_goal=profile_data.primary_goal,
            body=profile_data.body.model_dump(),
            medical=profile_data.medical.model_dump(),
            lifestyle=profile_data.lifestyle.model_dump(),
            psychology=profile_data.psychology.model_dump(),
        )
        db.add(profile)

    db.commit()
    return {"status": "ok", "profile_id": existing.id if existing else profile.id}


@router.get("/profile")
def get_profile(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {
        "goals": profile.goals,
        "primary_goal": profile.primary_goal,
        "body": profile.body,
        "medical": profile.medical,
        "lifestyle": profile.lifestyle,
        "psychology": profile.psychology,
    }
