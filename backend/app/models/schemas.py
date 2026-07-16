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
    time_of_day: Literal["morning", "afternoon", "evening", "night"] | None = None
    matches_planned_event: bool = True


class DailyLogParseResult(BaseModel):
    entries: list[ParsedLogEntry]
    total_calories_consumed: int | None = None
    total_calories_burned: int | None = None
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
    inputs: dict[str, Any]


class SimulationResult(BaseModel):
    scenario: SimulationScenario
    original_plan: PlanRecommendation
    simulated_plan: PlanRecommendation
    debate: CoordinatorDecision
    impact_summary: str
