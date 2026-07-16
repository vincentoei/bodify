from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, CurrentUser
from app.models.database import get_db, User

router = APIRouter()


@router.get("/me")
def get_me(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Ensure user exists in our DB
    db_user = db.query(User).filter(User.id == user.id).first()
    if not db_user:
        db_user = User(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
        )
        db.add(db_user)
        db.commit()
    elif user.full_name and db_user.full_name != user.full_name:
        # Sync full_name from Supabase metadata if it has changed
        db_user.full_name = user.full_name
        db.commit()
        db.refresh(db_user)

    return {
        "id": user.id,
        "email": user.email,
        "full_name": db_user.full_name,
    }
