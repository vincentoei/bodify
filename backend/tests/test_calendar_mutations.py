import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import unittest
from datetime import datetime, timezone, timedelta
from uuid import uuid4

from app.models.database import Base, engine, CalendarEvent, Plan, get_db
from app.models.schemas import CalendarMutation, ExtractedFact
from app.services.calendar import apply_calendar_mutations, generate_fallback_mutations_for_facts


class TestCalendarMutations(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)

    def setUp(self):
        self.db = next(get_db())
        # Clean tables between tests
        self.db.query(CalendarEvent).delete()
        self.db.query(Plan).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _make_plan(self, user_id: str = "u1", timezone_name: str = "UTC") -> Plan:
        plan = Plan(
            id=str(uuid4()),
            user_id=user_id,
            is_active=True,
            timezone=timezone_name,
        )
        self.db.add(plan)
        self.db.commit()
        return plan

    def _make_event(
        self,
        user_id: str,
        title: str,
        event_type: str = "workout",
        date: datetime | None = None,
        status: str = "pending",
    ) -> CalendarEvent:
        ev = CalendarEvent(
            id=str(uuid4()),
            user_id=user_id,
            date=date or datetime(2026, 7, 20, 18, 0, tzinfo=timezone.utc),
            type=event_type,
            title=title,
            status=status,
        )
        self.db.add(ev)
        return ev

    def test_title_keywords_skip_only_matching_workouts(self):
        """Skip leg-focused workouts while keeping upper-body sessions."""
        plan = self._make_plan()
        self._make_event("u1", "Vinyasa Yoga")
        self._make_event("u1", "Cycling Intervals")
        self._make_event("u1", "Upper Body Strength")
        self.db.commit()

        mutation = CalendarMutation(
            action="skip",
            date="2026-07-20",
            event_type="workout",
            title_keywords=["yoga", "cycling"],
            reason="broken leg",
        )
        changelog = apply_calendar_mutations(self.db, "u1", [mutation], plan)

        self.assertEqual(len(changelog), 2)
        titles = {c["title"] for c in changelog}
        self.assertEqual(titles, {"Vinyasa Yoga", "Cycling Intervals"})

        statuses = {ev.title: ev.status for ev in self.db.query(CalendarEvent).all()}
        self.assertEqual(statuses["Vinyasa Yoga"], "skipped")
        self.assertEqual(statuses["Cycling Intervals"], "skipped")
        self.assertEqual(statuses["Upper Body Strength"], "pending")

    def test_title_keywords_case_insensitive(self):
        """Keyword matching is case-insensitive."""
        plan = self._make_plan()
        self._make_event("u1", "Morning YOGA Flow")
        self.db.commit()

        mutation = CalendarMutation(
            action="skip",
            date="2026-07-20",
            event_type="workout",
            title_keywords=["yoga"],
            reason="broken leg",
        )
        changelog = apply_calendar_mutations(self.db, "u1", [mutation], plan)

        self.assertEqual(len(changelog), 1)
        self.assertEqual(changelog[0]["title"], "Morning YOGA Flow")

    def test_empty_title_keywords_affects_all_matching_type(self):
        """No title_keywords means all events of the type are affected."""
        plan = self._make_plan()
        self._make_event("u1", "Yoga")
        self._make_event("u1", "Cycling")
        self._make_event("u1", "Upper Body Strength")
        self.db.commit()

        mutation = CalendarMutation(
            action="skip",
            date="2026-07-20",
            event_type="workout",
            reason="skip all workouts",
        )
        changelog = apply_calendar_mutations(self.db, "u1", [mutation], plan)

        self.assertEqual(len(changelog), 3)

    def test_fallback_mutations_skip_leg_exercises_only(self):
        """Injury fact generates skip mutations for leg exercises, keeps upper body."""
        plan = self._make_plan()
        base = datetime(2026, 7, 20, 18, 0, tzinfo=timezone.utc)
        self._make_event("u1", "Vinyasa Yoga", date=base)
        self._make_event("u1", "Cycling Intervals", date=base + timedelta(days=1))
        self._make_event("u1", "Upper Body Strength", date=base + timedelta(days=2))
        self._make_event("u1", "Restorative Stretch", date=base + timedelta(days=3))
        self.db.commit()

        events = self.db.query(CalendarEvent).all()
        facts = [ExtractedFact(category="injury", content="broken leg", ttl_days=30)]

        mutations = generate_fallback_mutations_for_facts(facts, events, plan)

        self.assertEqual(len(mutations), 2)
        titles = {m.title_keywords[0] if m.title_keywords else "" for m in mutations}
        self.assertIn("yoga", titles)
        self.assertIn("cycling", titles)

    def test_fallback_mutations_ignore_expired_window(self):
        """Events outside the fact TTL window are not affected."""
        plan = self._make_plan()
        base = datetime(2026, 7, 20, 18, 0, tzinfo=timezone.utc)
        self._make_event("u1", "Cycling", date=base + timedelta(days=40))
        self.db.commit()

        events = self.db.query(CalendarEvent).all()
        facts = [ExtractedFact(category="injury", content="broken leg", ttl_days=30)]

        mutations = generate_fallback_mutations_for_facts(facts, events, plan)
        self.assertEqual(len(mutations), 0)


if __name__ == "__main__":
    unittest.main()
