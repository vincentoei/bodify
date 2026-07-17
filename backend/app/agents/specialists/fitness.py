from langchain_core.prompts import ChatPromptTemplate
from app.agents.llm import get_llm
from app.models.schemas import SpecialistOutput
from app.agents.graph.state import AgentState


def fitness_agent_node(state: AgentState) -> dict:
    profile = state["profile"]
    event_type = state["event_type"]
    context = state.get("context", {})

    system_message = """You are the Fitness Coach Specialist in Bodify, a multi-agent AI health companion.

Your job is to design safe, realistic exercise recommendations given the user's profile and current event.

Guidelines:
- Consider injuries, medical conditions, fitness level, and available equipment.
- Recommend workout frequency, type, duration, and intensity.
- Prioritize consistency and recovery over extreme intensity.
- Never recommend exercises that could harm the user given their medical profile.
- BE CONCISE: keep rationale under 200 words, evidence under 100 words, and recommendation dict minimal.

Output your recommendation as structured JSON matching the SpecialistOutput schema.
"""

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_message),
            (
                "human",
                "Event type: {event_type}\nUser profile: {profile}\nAdditional context: {context}\n\nDurable memories about the user:\n{memories}\n\nProvide your fitness recommendation.",
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
            "memories": context.get("memories_text", "None"),
        }
    )

    output.agent_name = "Fitness Coach Specialist"
    output.role = "Designs exercise recommendations"

    return {"agent_outputs": {"fitness": output}}
