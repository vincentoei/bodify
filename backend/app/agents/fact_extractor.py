from langchain_core.prompts import ChatPromptTemplate

from app.agents.llm import get_llm
from app.models.schemas import ExtractedFact, ExtractedFacts
from app.agents.graph.state import AgentState


def extract_facts_node(state: AgentState) -> dict:
    """Classify the recovery message into durable facts vs one-off events.

    Durable facts (travel dates, recurring parties, injuries, schedule shifts)
    get persisted to agent_memory. One-off past-tense food mentions are NOT
    extracted here — they live in the daily log only.
    """
    message = state.get("recovery_message") or ""

    system_message = """You are the Fact Extractor for Bodify, a multi-agent AI health companion.

Your job is to read a free-form message from the user and decide which parts are DURABLE context that specialist agents should remember across future sessions, versus one-off information that does not need persistence.

What is durable:
- Upcoming travel (with dates or relative timeframes like "next week for 3 days")
- Recurring social events ("every Friday I have a party")
- Schedule changes ("starting next month I'll be working nights")
- Dietary shifts ("I'm going vegetarian")
- New injuries or illnesses
- Strong lifestyle preferences that affect the plan

What is NOT durable (do not extract):
- Past-tense food logs ("I ate three donuts today") — those belong in the daily log.
- Mood-only statements with no forward implication.
- Casual mentions of today's meals.

Output JSON matching the ExtractedFacts schema (a JSON object with a "facts" array). If nothing durable, return an empty facts list.

Each fact needs:
- category: one of travel, social_event, schedule, diet, injury, motivation, lifestyle, other
- content: a short, factual sentence (third person, future-oriented when possible)
- ttl_days: optional integer. Set for time-bounded facts (e.g., a 3-day trip → ttl_days=3 measured from the start date, or just the trip length in days). Omit/None for facts that persist indefinitely.
"""

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_message),
            ("human", "Message:\n{message}\n\nExtract durable facts only."),
        ]
    )

    llm = get_llm().with_structured_output(ExtractedFacts)
    chain = prompt | llm

    try:
        result: ExtractedFacts = chain.invoke({"message": message})
        facts = result.facts
    except Exception as e:
        print("FACT EXTRACTION ERROR:", e)
        facts = []

    return {"extracted_facts": facts}