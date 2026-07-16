from langchain_core.prompts import ChatPromptTemplate
from app.agents.llm import get_llm
from app.models.schemas import SpecialistOutput
from app.agents.graph.state import AgentState


def nutrition_agent_node(state: AgentState) -> dict:
    profile = state["profile"]
    event_type = state["event_type"]
    context = state.get("context", {})

    system_message = """You are the Nutrition Specialist in Bodify, a multi-agent AI health companion.

Your job is to provide evidence-based nutrition recommendations given the user's profile and current event.

Guidelines:
- Prioritize health and safety over speed of results.
- Consider medical conditions (e.g., diabetes, hypertension) and dietary restrictions.
- Never recommend stopping medication or overriding a doctor's advice.
- Use supportive, non-judgmental language.
- Recommend specific, actionable nutrition targets (calories, macros, meal structure).
- BE CONCISE: keep rationale under 200 words, evidence under 100 words, and recommendation dict minimal.

Output your recommendation as structured JSON matching the SpecialistOutput schema.
"""

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_message),
            (
                "human",
                "Event type: {event_type}\nUser profile: {profile}\nAdditional context: {context}\n\nProvide your nutrition recommendation.",
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

    # Ensure agent name is set
    output.agent_name = "Nutrition Specialist"
    output.role = "Analyzes meals and nutritional balance"

    return {"agent_outputs": {"nutrition": output}}
