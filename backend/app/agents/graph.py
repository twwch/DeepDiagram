from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from app.state.state import AgentState
from app.agents.dispatcher import router_node, route_decision
from app.agents.mindmap import mindmap_agent_node, tools as mindmap_tools
from app.agents.flow import flow_agent_node, tools as flow_tools
from app.agents.charts import charts_agent_node, tools as charts_tools
from app.agents.general import general_agent_node

# Define the graph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("router", router_node)
workflow.add_node("mindmap_agent", mindmap_agent_node)
workflow.add_node("flow_agent", flow_agent_node)
workflow.add_node("charts_agent", charts_agent_node)
workflow.add_node("general_agent", general_agent_node)

# Tool Nodes
# We need to register tool nodes if we want the graph to actually execute tools.
# The agents currently return messages with tool calls, but don't execute them themselves in the simple node function.
# We need to add "tools" node and edges back to the agents if we want the ReAct loop.
# For MVP simplicity, let's assume the "agent network" handles the conversation and tool calls.
# However, standard LangGraph ReAct pattern requires a tool node.

# Combined tools for the generic tool node, or separate ones?
# Let's create specific tool nodes for clarity
mindmap_tool_node = ToolNode(mindmap_tools)
flow_tool_node = ToolNode(flow_tools)
charts_tool_node = ToolNode(charts_tools)

workflow.add_node("mindmap_tools", mindmap_tool_node)
workflow.add_node("flow_tools", flow_tool_node)
workflow.add_node("charts_tools", charts_tool_node)

# Entry point
workflow.set_entry_point("router")

# Router edges
workflow.add_conditional_edges(
    "router",
    route_decision,
    {
        "mindmap_agent": "mindmap_agent",
        "flow_agent": "flow_agent",
        "charts_agent": "charts_agent",
        "general_agent": "general_agent"
    }
)

# Agent <-> Tool edges (ReAct Loop)
# Simple check: if last message has tool_calls, go to tool node. Else END.
def should_continue(state: AgentState):
    messages = state['messages']
    last_message = messages[-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "continue"
    return "end"

# MindMap Loop
workflow.add_conditional_edges(
    "mindmap_agent",
    should_continue,
    {"continue": "mindmap_tools", "end": END}
)
workflow.add_edge("mindmap_tools", "mindmap_agent")

# Flow Loop
workflow.add_conditional_edges(
    "flow_agent",
    should_continue,
    {"continue": "flow_tools", "end": END}
)
workflow.add_edge("flow_tools", "flow_agent")

# Charts Loop
workflow.add_conditional_edges(
    "charts_agent",
    should_continue,
    {"continue": "charts_tools", "end": END}
)
workflow.add_edge("charts_tools", "charts_agent")

# General Agent (No tools, just ends)
workflow.add_edge("general_agent", END)

# Compile
graph = workflow.compile()
