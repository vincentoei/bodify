from langchain_core.prompts import ChatPromptTemplate
from app.agents.llm import get_llm, get_llm_large
from app.models.schemas import (
    CoordinatorDecision, RecoveryDecision, ExtractedFact,
    SimulationSummary,
)
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
13. If recent plan adaptations are provided in the context, treat them as durable facts: do NOT reintroduce activities or meals the user explicitly adapted away from (e.g. if a prior adaptation skipped leg workouts due to a broken leg, exclude leg-focused workouts from the workout_plan until that adaptation has expired or been superseded; if a meal was replaced on recurring dates, keep respecting that pattern). When in doubt, prefer the adaptation over the original plan.

Output your decision as structured JSON matching the CoordinatorDecision schema.
"""

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_message),
            (
                "human",
                "Event type: {event_type}\nUser profile: {profile}\n\nRecent daily logs:\n{recent_logs}\n\nRecent plan adaptations:\n{recent_adaptations}\n\nSpecialist outputs:\n{outputs}\n\n{feedback}\n\nSynthesize the final recommendation.",
            ),
        ]
    )

    llm = get_llm_large().with_structured_output(CoordinatorDecision)
    chain = prompt | llm

    feedback_text = (
        f"User feedback to incorporate: {user_feedback}"
        if user_feedback
        else "No additional user feedback."
    )

    recent_logs_text = state.get("context", {}).get("recent_logs", "No recent logs available.")
    recent_adaptations_text = state.get("context", {}).get("recent_adaptations", "No recent adaptations.")

    decision: CoordinatorDecision = chain.invoke(
        {
            "event_type": event_type,
            "profile": profile.model_dump_json() if profile else "{}",
            "recent_logs": recent_logs_text,
            "recent_adaptations": recent_adaptations_text,
            "outputs": "\n\n".join(
                [f"--- {out.agent_name} ---\n{out.model_dump_json()}" for out in agent_outputs.values()]
            ),
            "feedback": feedback_text,
        }
    )

    return {"coordinator_decision": decision}


def recovery_coordinator_node(state: AgentState) -> dict:
    """Synthesize specialist outputs into a RecoveryDecision.

    Produces:
    - resolution_summary: compassionate narrative recap
    - specialist_outputs: every specialist's SpecialistOutput
    - calendar_mutations: targeted changes to apply to the calendar (preserve
      events with status completed/skipped today — executor enforces this)
    - extracted_facts: durable facts to persist (re-emitted in case the fact
      extractor missed any; orchestrator's facts take precedence)
    """
    profile = state["profile"]
    message = state.get("recovery_message") or ""
    agent_outputs = state["agent_outputs"]
    context = state.get("context", {})
    memories_text = context.get("memories_text", "None")
    today_local = context.get("today_local", "unknown")
    extracted_facts = state.get("extracted_facts") or []

    system_message = f"""You are the Coordinator Agent in Bodify, synthesizing a compassionate Recovery response.

The user sent a free-form recovery message — it may describe something that already happened AND/OR something that will happen (e.g. travel, parties, work crunch). Several specialists reviewed it and returned recommendations.

Today's date in the user's timezone is {today_local}. ALL `date` and `new_date` fields in calendar_mutations MUST be ISO `yyyy-mm-dd` absolute dates computed from this anchor. NEVER use relative words like 'tomorrow', 'next week', 'next month', 'every Friday'. Convert them yourself before emitting.

Your job:
1. Summarize how the council will adapt, in a warm, non-judgmental voice (resolution_summary, under 150 words).
2. Convert specialist recommendations into concrete, targeted CalendarMutations. Do NOT regenerate the whole week. Only emit mutations explicitly justified by the message. Use the upcoming events list below to pick the exact dates that have affected activities. For example:
   - travel dates → skip or replace workouts on those exact ISO dates, lighter meal titles
   - party on Friday (recurring) → emit ONE mutation per upcoming Friday within the next 14 days from today, each targeting the dinner meal via meal_filter="dinner"
   - injury for a month → emit ONE mutation per affected workout date within the next 30 days from today. For leg injuries, use `title_keywords` to target only leg-bearing workouts (e.g., "yoga", "cycling", "running", "leg", "squat", "lunge") and preserve upper-body sessions.
   - busy tomorrow so skip breakfast → ONE mutation: date=tomorrow's ISO date, action="skip", event_type="meal", meal_filter="breakfast"
3. Use meal_filter to narrow meal mutations — do NOT affect unrelated meals on the same date.
4. Use title_keywords to narrow workout mutations — do NOT affect unrelated workouts on the same date.
5. If a fact in the message looks durable and is NOT covered by extracted_facts already in context, append it to extracted_facts in the output. Otherwise mirror the existing extracted_facts.
6. Preserve events already completed/skipped today — executor enforces this. Do not emit mutations with date == today unless the message clearly refers to today's future events.
7. resolution_summary must be one coherent paragraph; specialist_outputs must mirror the agent_outputs you received.

Output JSON matching the RecoveryDecision schema.
"""

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_message),
            ("human",
             "User message: {message}\n\nUser profile: {profile}\n\nDurable memories: {memories}\n\n"
             "Upcoming scheduled events (next 30 days):\n{upcoming_events}\n\n"
             "Specialist outputs:\n{outputs}\n\nAlready extracted facts: {facts}\n\n"
             "Synthesize the RecoveryDecision.",
            ),
        ]
    )

    llm = get_llm(max_tokens=2048).with_structured_output(RecoveryDecision)
    chain = prompt | llm

    upcoming_events_text = context.get("upcoming_events_text", "No upcoming events available.")

    decision: RecoveryDecision = chain.invoke(
        {
            "message": message,
            "profile": profile.model_dump_json() if profile else "{}",
            "memories": memories_text,
            "upcoming_events": upcoming_events_text,
            "outputs": "\n\n".join(
                [f"--- {out.agent_name} ---\n{out.model_dump_json()}" for out in agent_outputs.values()]
            ) or "No specialist outputs.",
            "facts": "\n".join([f.model_dump_json() for f in extracted_facts]) or "No facts yet.",
        }
    )

    # Coerce pydantic objects to sa:RecoveryDecision normalization — preserve agent's facts if LLM dropped them
    if not decision.extracted_facts:
        decision.extracted_facts = extracted_facts

    return {"recovery_decision": decision}


def simulation_coordinator_node(state: AgentState) -> dict:
    """Synthesize specialist outputs into a SimulationSummary (lightweight).

    Differs from plan coordinator: no meal_plan/workout_plan emission, no
    CalendarMutations, no fact persistence. Returns impact narrative + risks +
    optional numeric delta. Uses get_llm (max_tokens 2048) — cheap and fast.
    """
    profile = state["profile"]
    context = state.get("context", {})
    scenario = context.get("scenario", "")
    agent_outputs = state["agent_outputs"]
    memories_text = context.get("memories_text", "None")
    recent_logs_text = context.get("recent_logs", "No recent logs available.")

    system_message = """You are the Coordinator Agent in Bodify synthesizing a what-if simulation result.

A user asked a hypothetical question (e.g. "What if I move to Japan for a month?" or selected a preset like "Miss 3 Workouts"). Several specialists assessed the scenario against the user's profile, durable memories, and recent daily logs.

Your job:
1. impact_summary: one or two sentences (≤40 words) describing what the scenario means in the user's context.
2. likely_outcome: concrete prediction (≤150 words). Cover timeline, body composition, mood, adherence, and any phase shifts if relevant. Be honest about uncertainty.
3. risks: 3-7 short bullet strings. Each ≤15 words. Realistic, not alarmist.
4. recommendation_delta: numeric shift between current plan and the simulated scenario. Set a field ONLY if the scenario materially shifts that metric; leave the rest null. Values are deltas (e.g. calorie_target: -200 means 200 kcal lower; weekly_workouts: -3 means 3 fewer workouts/week). If the scenario is non-numeric (e.g. travel, lifestyle), leave ALL fields null.
5. specialist_outputs: mirror the agent_outputs you received unchanged.
6. conflicts: include only if specialists materially disagreed; omit otherwise (empty list).
7. resolution_summary: ≤80 words, warm non-judgmental voice, naming the path forward.

Do NOT generate meal plans, workout options, or calendar mutations. Output JSON matching the SimulationSummary schema.
"""

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_message),
            ("human",
             "Scenario: {scenario}\n\nUser profile: {profile}\n\nDurable memories: {memories}\n\n"
             "Recent daily logs:\n{recent_logs}\n\nSpecialist outputs:\n{outputs}\n\n"
             "Synthesize the SimulationSummary.",
             ),
        ]
    )

    llm = get_llm(max_tokens=2048).with_structured_output(SimulationSummary)
    chain = prompt | llm

    summary: SimulationSummary = chain.invoke(
        {
            "scenario": scenario,
            "profile": profile.model_dump_json() if profile else "{}",
            "memories": memories_text,
            "recent_logs": recent_logs_text,
            "outputs": "\n\n".join(
                [f"--- {out.agent_name} ---\n{out.model_dump_json()}" for out in agent_outputs.values()]
            ) or "No specialist outputs.",
        }
    )

    return {"coordinator_decision": summary}
