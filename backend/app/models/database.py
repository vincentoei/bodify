from sqlalchemy import create_engine, Column, String, Boolean, DateTime, Integer, Float, ForeignKey, JSON, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.sql import func
from app.core.config import get_settings

settings = get_settings()
Base = declarative_base()

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=True)
    full_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    profile = relationship("Profile", back_populates="user", uselist=False)
    plans = relationship("Plan", back_populates="user")
    events = relationship("CalendarEvent", back_populates="user")
    logs = relationship("Log", back_populates="user")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True)
    goals = Column(JSON, default=list)
    primary_goal = Column(String)
    body = Column(JSON)
    medical = Column(JSON)
    lifestyle = Column(JSON)
    psychology = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="profile")


class Plan(Base):
    __tablename__ = "plans"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)
    calorie_target = Column(Integer)
    macros = Column(JSON)
    schedule = Column(JSON)
    reasoning = Column(JSON)  # CoordinatorDecision serialized
    target_duration_weeks = Column(Integer, default=12)
    target_date = Column(DateTime(timezone=True), nullable=True)
    current_week = Column(Integer, default=1)
    current_phase = Column(String, nullable=True)
    timezone = Column(String, default="UTC")
    generation_window_days = Column(Integer, default=7)
    last_generated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="plans")
    agent_outputs = relationship("AgentOutput", back_populates="plan")


class AgentOutput(Base):
    __tablename__ = "agent_outputs"

    id = Column(String, primary_key=True)
    plan_id = Column(String, ForeignKey("plans.id"))
    agent_name = Column(String)
    role = Column(String)
    recommendation = Column(JSON)
    evidence = Column(Text)
    confidence = Column(Float)
    rationale = Column(Text)

    plan = relationship("Plan", back_populates="agent_outputs")


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    date = Column(DateTime(timezone=True))
    type = Column(String)
    title = Column(String)
    description = Column(Text, nullable=True)
    status = Column(String, default="pending")
    event_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="events")


class Log(Base):
    __tablename__ = "logs"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    type = Column(String)
    content = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="logs")
