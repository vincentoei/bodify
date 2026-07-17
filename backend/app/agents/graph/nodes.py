from app.agents.graph.state import AgentState
from app.services.rag.retriever import retrieve_guidelines
from app.agents.specialists.nutrition import nutrition_agent_node
from app.agents.specialists.fitness import fitness_agent_node
from app.agents.specialists.medical import medical_agent_node
from app.agents.specialists.behavioral import behavioral_agent_node
from app.agents.specialists.progress import progress_agent_node
from app.agents.coordinator import coordinator_node


AGENT_REGISTRY = {
    "nutrition": nutrition_agent_node,
    "fitness": fitness_agent_node,
    "medical": medical_agent_node,
    "behavioral": behavioral_agent_node,
    "progress": progress_agent_node,
}


def _memories_to_text(memories: list[dict]) -> str:
    if not memories:
        return "No durable memories on record."
    lines = []
    for m in memories:
        cat = m.get("category", "")
        content = m.get("content", "")
        lines.append(f"- [{cat}] {content}")
    return "\n".join(lines)


def orchestrator_node(state: AgentState) -> dict:
    """Decide which agents should participate based on event type."""
    event_type = state["event_type"]
    context = state.get("context", {})
    profile = state.get("profile")
    memories = state.get("memories", [])

    # Surface durable memories to specialists via context
    if memories:
        context["memories_text"] = _memories_to_text(memories)

    # Retrieve relevant guidelines based on profile and event
    query = context.get("scenario", event_type.replace("_", " "))
    guidelines = retrieve_guidelines(profile, query, n_results=3)
    if guidelines:
        context["guidelines"] = guidelines

    # Default full council for onboarding and major reviews
    if event_type in {"onboarding", "monthly_review", "major_profile_change"}:
        return {"selected_agents": list(AGENT_REGISTRY.keys()), "context": context}

    # Selective activation for adaptive events
    if event_type == "missed_workout":
        return {"selected_agents": ["fitness", "behavioral", "medical"], "context": context}

    if event_type == "meal_logged":
        return {"selected_agents": ["nutrition", "progress"], "context": context}

    if event_type == "setback_reported":
        return {"selected_agents": ["behavioral", "nutrition", "fitness", "medical"], "context": context}

    if event_type == "recovery_chat":
        message = (state.get("recovery_message") or "").lower()
        # Default council for recovery: behavioral + fitness + nutrition + progress
        agents = ["behavioral", "fitness", "nutrition", "progress"]
        # Escalate to medical if illness/injury keywords appear
        if any(
            kw in message
            for kw in (
                "sick", "ill", "flu", "fever", "injury", "injured", "pain",
                "hurt", "hospital", "medication", "dizzy", "nausea",
            )
        ):
            agents.append("medical")
        return {"selected_agents": agents, "context": context}

    if event_type == "what_if":
        # For simulations, run full council unless narrowed by context
        scenario = context.get("scenario", "")
        if "workout" in scenario.lower():
            return {"selected_agents": ["fitness", "behavioral", "progress", "medical"], "context": context}
        if "diet" in scenario.lower() or "calorie" in scenario.lower():
            return {"selected_agents": ["nutrition", "progress", "medical", "behavioral"], "context": context}
        return {"selected_agents": list(AGENT_REGISTRY.keys()), "context": context}

    # Fallback: coordinator only
    return {"selected_agents": list(AGENT_REGISTRY.keys()), "context": context}


__all__ = [
    "orchestrator_node",
    "coordinator_node",
    "AGENT_REGISTRY",
    "nutrition_agent_node",
    "fitness_agent_node",
    "medical_agent_node",
    "behavioral_agent_node",
    "progress_agent_node",
]
