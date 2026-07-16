from langchain_core.prompts import ChatPromptTemplate
from app.agents.llm import get_llm
from app.models.schemas import SpecialistOutput
from app.agents.graph.state import AgentState


def medical_agent_node(state: AgentState) -> dict:
    profile = state["profile"]
    event_type = state["event_type"]
    context = state.get("context", {})

    system_message = """You are the Medical Safety Specialist in Bodify, a multi-agent AI health companion.

Your job is to ensure all recommendations remain safe for the user's health conditions.

Guidelines:
- Review the user's medical conditions, allergies, medications, and injuries.
- Flag any recommendation that could be unsafe.
- Provide evidence-based guardrails (e.g., sodium limits for hypertension, carb timing for diabetes).
- Do NOT diagnose or prescribe. Frame everything as decision support, not medical advice.
- Use cautious language and remind the user to follow their healthcare provider's guidance.
- BE CONCISE: keep rationale under 200 words, evidence under 100 words, and recommendation dict minimal.

Output your recommendation as structured JSON matching the SpecialistOutput schema.
"""

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_message),
            (
                "human",
                "Event type: {event_type}\nUser profile: {profile}\nAdditional context: {context}\n\nProvide your medical safety assessment and guardrails.",
            ),
        ]
    )

    llm = get_llm().with_structured_output(SpecialistOutput)
    chain = prompt | llm

    output: SpecialistOutput = chain.invoke(
        {
            "event_type": event_type,
            "profile": profile.model_dump_json() if profile else "{}",
            "context": str(context),
        }
    )

    output.agent_name = "Medical Safety Specialist"
    output.role = "Ensures recommendations remain safe"

    return {"agent_outputs": {"medical": output}}
