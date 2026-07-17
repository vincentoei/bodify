from pydantic import BaseModel, Field
from typing import Literal, Any
from datetime import datetime
from enum import Enum


# ---------- Shared ----------
class BodyProfile(BaseModel):
    age: int
    sex: Literal["male", "female", "other"]
    height_cm: float
    weight_kg: float
    activity_level: Literal["sedentary", "lightly_active", "moderately_active", "very_active", "super_active"]
    occupation: str | None = None


class MedicalProfile(BaseModel):
    conditions: list[str] = []
    allergies: list[str] = []
    medications: list[str] = []
    injuries: list[str] = []
    pregnancy: bool = False


class LifestyleProfile(BaseModel):
    diet_pattern: str  # e.g., omnivore, vegetarian, vegan, halal, kosher
    cuisines: list[str] = []
    cooking_ability: Literal["none", "basic", "intermediate", "advanced"]
    kitchen_access: Literal["minimal", "basic", "full"]
    budget_level: Literal["low", "medium", "high"]
    work_schedule: str
    sleep_hours: float
    stress_level: Literal["low", "medium", "high"]
    social_eating: Literal["rarely", "sometimes", "often"]


class PsychologyProfile(BaseModel):
    past_attempts: list[str] = []
    motivation_style: Literal["data_driven", "supportive", "competitive"]
    restriction_tolerance: Literal["low", "medium", "high"]
    setbacks_history: list[str] = []
    why_now: str | None = None


class UserProfile(BaseModel):
    goals: list[str]
    primary_goal: str
    body: BodyProfile
    medical: MedicalProfile
    lifestyle: LifestyleProfile
    psychology: PsychologyProfile


class MacroTargets(BaseModel):
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float | None = None


class PlanPhase(BaseModel):
    name: str
    week_start: int
    week_end: int
    focus: str


class MealOption(BaseModel):
    name: str
    cuisine: str
    prep_time: str


class MealPlan(BaseModel):
    breakfast_options: list[MealOption]
    lunch_options: list[MealOption]
    dinner_options: list[MealOption]


class WorkoutOption(BaseModel):
    name: str
    focus: str
    duration_min: int
    intensity: Literal["low", "moderate", "high"]


class WorkoutPlan(BaseModel):
    options: list[WorkoutOption]


class PlanRecommendation(BaseModel):
    calorie_target: int
    macros: MacroTargets
    weekly_workouts: int
    workout_duration_min: int
    daily_steps_goal: int
    sleep_hours_target: float
    hydration_liters: float
    notes: str = ""
    target_duration_weeks: int = 12
    target_date: datetime | None = None
    timezone: str = "UTC"
    phases: list[PlanPhase] = []
    meal_plan: MealPlan | None = None
    workout_plan: WorkoutPlan | None = None


class SpecialistOutput(BaseModel):
    agent_name: str
    role: str
    recommendation: dict[str, Any]
    evidence: str
    confidence: float = Field(..., ge=0, le=1)
    rationale: str


class Conflict(BaseModel):
    agents: list[str]
    topic: str
    summary: str
    trade_off: str


class CoordinatorDecision(BaseModel):
    final_recommendation: PlanRecommendation
    specialist_outputs: list[SpecialistOutput]
    conflicts: list[Conflict]
    resolution_summary: str


class CalendarEventItem(BaseModel):
    id: str | None = None
    date: datetime
    type: Literal["meal", "workout", "hydration", "sleep", "recovery", "checkin"]
    title: str
    description: str | None = None
    status: Literal["pending", "completed", "skipped", "rescheduled"] = "pending"
    event_metadata: dict[str, Any] | None = None


class LogEntry(BaseModel):
    type: Literal["meal", "workout", "checkin", "setback"]
    content: dict[str, Any]


class ParsedLogEntry(BaseModel):
    type: Literal["meal", "workout", "hydration", "sleep", "other"]
    description: str
    estimated_calories: int | None = None
    grams_protein: int | None = None
    grams_carbs: int | None = None
    grams_fat: int | None = None
    grams_fiber: int | None = None
    liters_water: float | None = None
    hours_sleep: float | None = None
    time_of_day: Literal["morning", "afternoon", "evening", "night"] | None = None
    matches_planned_event: bool = True


class DailyLogParseResult(BaseModel):
    entries: list[ParsedLogEntry]
    total_calories_consumed: int | None = None
    total_calories_burned: int | None = None
    total_grams_protein: int | None = None
    total_grams_carbs: int | None = None
    total_grams_fat: int | None = None
    total_grams_fiber: int | None = None
    total_liters_water: float | None = None
    total_hours_sleep: float | None = None
    missed_event_types: list[str] = []
    summary: str = ""


class DailyLogSubmission(BaseModel):
    text: str


class DailyLogResponse(BaseModel):
    parsed: DailyLogParseResult
    updated_events: list[dict[str, Any]] = []
    calorie_target: int | None = None
    calories_consumed: int | None = None
    status: Literal["on_target", "under", "over"] = "on_target"
    message: str = ""


class SimulationScenario(BaseModel):
    id: str
    title: str
    description: str
    icon: str
    palette: str = ""


class PlanDelta(BaseModel):
    """Numeric shift between current plan and simulated scenario. Null fields
    mean the scenario does not affect that metric. ponytail: add macro fields
    if a scenario ever needs them."""
    calorie_target: int | None = None
    weekly_workouts: int | None = None
    workout_duration_min: int | None = None
    daily_steps_goal: int | None = None
    sleep_hours_target: float | None = None
    hydration_liters: float | None = None


class SimulationSummary(BaseModel):
    """Lightweight result shape for streaming custom what-if sims. No full
    meal_plan/workout_plan emission — keeps token cost low and UX snappy."""
    impact_summary: str
    likely_outcome: str
    risks: list[str] = []
    recommendation_delta: PlanDelta = PlanDelta()
    specialist_outputs: list[SpecialistOutput] = []
    conflicts: list[Conflict] = []
    resolution_summary: str


class SimulationStreamRequest(BaseModel):
    prompt: str


# ---------- Recovery & durable memory ----------
class ExtractedFact(BaseModel):
    """A durable fact the orchestrator wants persisted to agent_memory.

    ttl_days is optional: set for time-bounded facts (e.g. travel). None means
    the fact persists until explicitly retired.
    """
    category: Literal[
        "travel", "social_event", "schedule", "diet", "injury",
        "motivation", "lifestyle", "other"
    ]
    content: str
    ttl_days: int | None = None
    source_agent: str | None = None


class ExtractedFacts(BaseModel):
    """Container for structured LLM output of the fact extractor.

    LangChain's with_structured_output only accepts a Pydantic class, not a
    typing.List[...] generic, so we wrap the list here.
    """
    facts: list[ExtractedFact] = []


class AgentMemoryEntry(BaseModel):
    id: str
    content: str
    category: str
    source_agent: str | None = None
    active: bool
    created_at: datetime
    expires_at: datetime | None = None


class CalendarMutation(BaseModel):
    action: Literal["replace", "reschedule", "skip", "add"]
    date: str  # ISO yyyy-mm-dd absolute date (never relative words)
    event_type: Literal["meal", "workout", "hydration", "sleep", "recovery", "checkin"] | None = None
    meal_filter: Literal["breakfast", "lunch", "dinner"] | None = None
    title_keywords: list[str] | None = None  # match events whose title contains any keyword
    new_title: str | None = None
    new_description: str | None = None
    new_date: str | None = None  # ISO yyyy-mm-dd for reschedule
    reason: str = ""


class RecoveryDecision(BaseModel):
    resolution_summary: str
    specialist_outputs: list[SpecialistOutput] = []
    conflicts: list[Conflict] = []
    calendar_mutations: list[CalendarMutation] = []
    extracted_facts: list[ExtractedFact] = []


class RecoverySubmission(BaseModel):
    text: str


class PlanAdaptationEntry(BaseModel):
    """Audit ledger entry appended to Plan.plan_adaptations on every recovery
    mutation, so the main Coordinator can see what was adapted and when — and
    the user has a visible history.
    """
    at: datetime
    message: str
    changes: list[dict[str, Any]] = []
    facts: list[dict[str, Any]] = []
