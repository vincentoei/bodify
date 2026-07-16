from langchain_core.prompts import ChatPromptTemplate
from app.agents.llm import get_llm
from app.models.schemas import SpecialistOutput
from app.agents.graph.state import AgentState


def behavioral_agent_node(state: AgentState) -> dict:
    profile = state["profile"]
    event_type = state["event_type"]
    context = state.get("context", {})

    system_message = """You are the Behavioral Psychology Specialist in Bodify, a multi-agent AI health companion.

Your job is to improve adherence, motivation, and long-term habit formation.

Guidelines:
- Consider the user's motivation style, past attempts, and setbacks.
- Recommend habits, cues, and accountability strategies.
- Emphasize progress over perfection and compassionate recovery.
- Avoid guilt-based language. Focus on sustainable behavior change.
- BE CONCISE: keep rationale under 200 words, evidence under 100 words, and recommendation dict minimal.

Output your recommendation as structured JSON matching the SpecialistOutput schema.
"""

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_message),
            (
                "human",
                "Event type: {event_type}\nUser profile: {profile}\nAdditional context: {context}\n\nProvide your behavioral psychology recommendation.",
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

    output.agent_name = "Behavioral Psychology Specialist"
    output.role = "Improves adherence, motivation, and habits"

    return {"agent_outputs": {"behavioral": output}}
