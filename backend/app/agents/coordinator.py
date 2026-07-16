from langchain_core.prompts import ChatPromptTemplate
from app.agents.llm import get_llm
from app.models.schemas import CoordinatorDecision
from app.agents.graph.state import AgentState


def coordinator_node(state: AgentState) -> dict:
    profile = state["profile"]
    event_type = state["event_type"]
    agent_outputs = state["agent_outputs"]
    user_feedback = state.get("user_feedback")

    system_message = """You are the Coordinator Agent in Bodify, a multi-agent AI health companion.

Your job is to synthesize recommendations from multiple specialists into a single, coherent plan and define the user's transformation journey.

Instructions:
1. Review each specialist's output.
2. Identify any conflicts or trade-offs.
3. Resolve conflicts in favor of safety, sustainability, and user adherence.
4. Produce a final recommendation with specific numbers (calorie target, macros, weekly workouts, etc.).
5. Estimate a realistic, safe journey duration in weeks based on the user's goal and body profile. Do not promise unsafe timelines.
6. Define 2-4 phases (e.g., Adaptation, Progress, Consolidation). Each phase must have a week_start, week_end, and a one-sentence focus.
7. Do NOT set a target_date; the system will compute it from the duration.
8. Generate a meal_plan with exactly 7 unique breakfast_options, 7 unique lunch_options, and 7 unique dinner_options. Each option must include name, cuisine, and prep_time. prep_time should be a short value with units, e.g., "5 min", "10 min", "15 min". Respect the user's diet pattern, cuisines, allergies, budget, cooking ability, and medical constraints (e.g., low sodium for hypertension). Naturally vary cuisines across the week.
9. Generate a workout_plan with 4-7 unique workout options. Each option must include name, focus, duration_min, and intensity (low/moderate/high). Match the weekly workout frequency, current phase, and any injuries or medical limitations.
10. Summarize how you balanced differing opinions.
11. Be transparent about uncertainty.
12. BE CONCISE: keep resolution_summary under 150 words and specialist_outputs minimal.

11. If recent daily logs are provided in the context, pay attention to foods and workouts the user actually completed. If you see the same substitution 2-3 times (e.g., treadmill instead of brisk walk, eggs instead of avocado toast), prefer those options in the meal_plan and workout_plan.
12. Never recommend extreme restriction, fasting, or punishment. Keep recommendations safe, sustainable, and compassionate.

Output your decision as structured JSON matching the CoordinatorDecision schema.
"""

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_message),
            (
                "human",
                "Event type: {event_type}\nUser profile: {profile}\n\nRecent daily logs:\n{recent_logs}\n\nSpecialist outputs:\n{outputs}\n\n{feedback}\n\nSynthesize the final recommendation.",
            ),
        ]
    )

    llm = get_llm().with_structured_output(CoordinatorDecision)
    chain = prompt | llm

    feedback_text = (
        f"User feedback to incorporate: {user_feedback}"
        if user_feedback
        else "No additional user feedback."
    )

    recent_logs_text = state.get("context", {}).get("recent_logs", "No recent logs available.")

    decision: CoordinatorDecision = chain.invoke(
        {
            "event_type": event_type,
            "profile": profile.model_dump_json() if profile else "{}",
            "recent_logs": recent_logs_text,
            "outputs": "\n\n".join(
                [f"--- {out.agent_name} ---\n{out.model_dump_json()}" for out in agent_outputs.values()]
            ),
            "feedback": feedback_text,
        }
    )

    return {"coordinator_decision": decision}
