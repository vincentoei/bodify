from langgraph.graph import StateGraph, END, START
from app.agents.graph.state import AgentState
from app.agents.graph.nodes import (
    orchestrator_node,
    coordinator_node,
    AGENT_REGISTRY,
)


def build_agent_graph():
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("orchestrator", orchestrator_node)
    for name, func in AGENT_REGISTRY.items():
        workflow.add_node(name, func)
    workflow.add_node("coordinator", coordinator_node)

    # Entry point
    workflow.add_edge(START, "orchestrator")

    # Conditional edges from orchestrator to selected agents
    def route_to_agents(state: AgentState):
        return state["selected_agents"]

    workflow.add_conditional_edges(
        "orchestrator",
        route_to_agents,
        {name: name for name in AGENT_REGISTRY.keys()},
    )

    # All agents converge to coordinator
    for name in AGENT_REGISTRY.keys():
        workflow.add_edge(name, "coordinator")

    # End after coordinator
    workflow.add_edge("coordinator", END)

    return workflow.compile()


agent_graph = build_agent_graph()
