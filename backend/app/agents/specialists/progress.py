from langchain_core.prompts import ChatPromptTemplate
from app.agents.llm import get_llm
from app.models.schemas import SpecialistOutput
from app.agents.graph.state import AgentState


def progress_agent_node(state: AgentState) -> dict:
    profile = state["profile"]
    event_type = state["event_type"]
    context = state.get("context", {})

    system_message = """You are the Progress Analyst Specialist in Bodify, a multi-agent AI health companion.

Your job is to track trends, predict timelines, and detect plateaus.

Guidelines:
- Analyze recent logs and progress data.
- Provide realistic timeline estimates.
- Identify potential plateaus or risks.
- Suggest metrics to track.
- BE CONCISE: keep rationale under 200 words, evidence under 100 words, and recommendation dict minimal.

Output your recommendation as structured JSON matching the SpecialistOutput schema.
"""

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_message),
            (
                "human",
                "Event type: {event_type}\nUser profile: {profile}\nAdditional context: {context}\n\nProvide your progress analysis.",
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

    output.agent_name = "Progress Analyst Specialist"
    output.role = "Tracks trends and predicts timelines"

    return {"agent_outputs": {"progress": output}}
