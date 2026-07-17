import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import unittest
from datetime import datetime, timezone, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.auth import get_current_user, CurrentUser
from app.models.database import Base, get_db, Plan, CalendarEvent, AgentMemory
from app.models.schemas import CoordinatorDecision, PlanRecommendation, MacroTargets, WorkoutPlan, WorkoutOption


# Use a shared in-memory SQLite connection for the API test so table creation
# and request handling see the same database.
_test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(bind=_test_engine)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)


def override_get_current_user():
    return CurrentUser(id="u1", email="u@test.com", full_name="Test")


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_current_user] = override_get_current_user
app.dependency_overrides[get_db] = override_get_db


class TestPlanRegeneration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=_test_engine)
        cls.client = TestClient(app)

    def setUp(self):
        self.db = TestSessionLocal()
        for table in [CalendarEvent, AgentMemory, Plan]:
            self.db.query(table).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _make_plan(self) -> Plan:
        plan = Plan(
            id=str(uuid4()),
            user_id="u1",
            is_active=True,
            calorie_target=2000,
            macros=MacroTargets(protein_g=120, carbs_g=180, fat_g=60).model_dump(),
            schedule={"weekly_workouts": 4},
            reasoning=CoordinatorDecision(
                final_recommendation=PlanRecommendation(
                    calorie_target=2000,
                    macros=MacroTargets(protein_g=120, carbs_g=180, fat_g=60),
                    weekly_workouts=4,
                    workout_duration_min=30,
                    daily_steps_goal=7000,
                    sleep_hours_target=7.5,
                    hydration_liters=2.5,
                    phases=[{"name": "Foundation", "week_start": 1, "week_end": 4, "focus": "Form and consistency"}],
                    workout_plan=WorkoutPlan(options=[
                        WorkoutOption(name="Vinyasa Yoga", focus="flexibility", duration_min=30, intensity="low"),
                        WorkoutOption(name="Cycling Intervals", focus="cardio", duration_min=45, intensity="moderate"),
                        WorkoutOption(name="Upper Body Strength", focus="upper body", duration_min=35, intensity="moderate"),
                        WorkoutOption(name="Morning Run", focus="cardio", duration_min=30, intensity="moderate"),
                        WorkoutOption(name="Leg Day", focus="lower body", duration_min=40, intensity="high"),
                        WorkoutOption(name="Core Blast", focus="core", duration_min=20, intensity="low"),
                        WorkoutOption(name="Restorative Stretch", focus="recovery", duration_min=20, intensity="low"),
                    ]),
                ),
                specialist_outputs=[],
                conflicts=[],
                resolution_summary="Test plan",
            ).model_dump(mode="json"),
            timezone="UTC",
            generation_window_days=7,
            last_generated_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        self.db.add(plan)
        self.db.commit()
        return plan

    def test_regenerate_week_respects_injury_memory(self):
        """Weekly regeneration skips leg workouts when an active injury memory exists."""
        plan = self._make_plan()

        # Seed an active injury memory.
        self.db.add(AgentMemory(
            id=str(uuid4()),
            user_id="u1",
            content="broken leg",
            category="injury",
            active=True,
            expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        ))
        self.db.commit()

        response = self.client.post("/plan/regenerate-week")
        self.assertEqual(response.status_code, 200, f"regenerate-week failed: {response.text}")

        # Re-query after endpoint commits.
        self.db.close()
        self.db = TestSessionLocal()
        events = self.db.query(CalendarEvent).filter(CalendarEvent.user_id == "u1").all()
        workout_statuses = {
            ev.title: ev.status
            for ev in events
            if ev.type == "workout"
        }

        # Regenerated events include leg-bearing workouts that should be skipped.
        leg_titles = [t for t in workout_statuses if any(kw in t.lower() for kw in ["yoga", "cycling", "running", "leg", "squat", "lunge"])]
        self.assertTrue(len(leg_titles) > 0, "expected at least one leg-bearing workout")
        for title in leg_titles:
            self.assertEqual(workout_statuses[title], "skipped", f"{title} should be skipped")

        # Upper-body or generic full-body sessions stay pending.
        non_leg = [t for t in workout_statuses if t not in leg_titles]
        self.assertTrue(len(non_leg) > 0, "expected at least one non-leg workout")
        for title in non_leg:
            self.assertEqual(workout_statuses[title], "pending", f"{title} should stay pending")


if __name__ == "__main__":
    unittest.main()
