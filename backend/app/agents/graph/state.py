from typing import TypedDict, Annotated, Any
from operator import add
from app.models.schemas import UserProfile, SpecialistOutput, Conflict, CoordinatorDecision, LogEntry


class AgentState(TypedDict):
    event_type: str
    profile: UserProfile | None
    recent_logs: list[LogEntry]
    context: dict[str, Any]
    selected_agents: list[str]
    agent_outputs: Annotated[dict[str, SpecialistOutput], lambda x, y: {**x, **y}]
    conflicts: list[Conflict]
    coordinator_decision: CoordinatorDecision | None
    user_feedback: str | None
    approved: bool | None
    iteration: int
