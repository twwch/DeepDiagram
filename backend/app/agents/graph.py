from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from app.state.state import AgentState
from app.agents.dispatcher import router_node, route_decision
from app.agents.mindmap import mindmap_agent_node as mindmap_agent, tools as mindmap_tools
from app.agents.flow import flow_agent_node as flow_agent, tools as flow_tools
from app.agents.mermaid import mermaid_agent_node as mermaid_agent, tools as mermaid_tools
from app.agents.charts import charts_agent_node as charts_agent, tools as charts_tools
from app.agents.drawio import drawio_agent_node as drawio_agent, tools as drawio_tools
from app.agents.infographic import infographic_agent_node as infographic_agent, tools as infographic_tools
from app.agents.general import general_agent_node as general_agent

# Define the graph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("router", router_node)
workflow.add_node("mindmap_agent", mindmap_agent)
workflow.add_node("flow_agent", flow_agent)
workflow.add_node("mermaid_agent", mermaid_agent)
workflow.add_node("charts_agent", charts_agent)
workflow.add_node("drawio_agent", drawio_agent)
workflow.add_node("infographic_agent", infographic_agent)
workflow.add_node("general_agent", general_agent)

# Tool Nodes
mindmap_tool_node = ToolNode(mindmap_tools)
flow_tool_node = ToolNode(flow_tools)
mermaid_tool_node = ToolNode(mermaid_tools)
charts_tool_node = ToolNode(charts_tools)
drawio_tool_node = ToolNode(drawio_tools)
infographic_tool_node = ToolNode(infographic_tools)

workflow.add_node("mindmap_tools", mindmap_tool_node)
workflow.add_node("flow_tools", flow_tool_node)
workflow.add_node("mermaid_tools", mermaid_tool_node)
workflow.add_node("charts_tools", charts_tool_node)
workflow.add_node("drawio_tools", drawio_tool_node)
workflow.add_node("infographic_tools", infographic_tool_node)

# Entry point
workflow.set_entry_point("router")

# Router edges
workflow.add_conditional_edges(
    "router",
    route_decision,
    {
        "mindmap_agent": "mindmap_agent",
        "flow_agent": "flow_agent",
        "mermaid_agent": "mermaid_agent",
        "charts_agent": "charts_agent",
        "drawio_agent": "drawio_agent",
        "infographic_agent": "infographic_agent",
        "general_agent": "general_agent"
    }
)

# Agent <-> Tool edges (ReAct Loop)
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

# Mermaid Loop
workflow.add_conditional_edges(
    "mermaid_agent",
    should_continue,
    {"continue": "mermaid_tools", "end": END}
)
workflow.add_edge("mermaid_tools", "mermaid_agent")

# Charts Loop
workflow.add_conditional_edges(
    "charts_agent",
    should_continue,
    {"continue": "charts_tools", "end": END}
)
workflow.add_edge("charts_tools", "charts_agent")

# Drawio Loop
workflow.add_conditional_edges(
    "drawio_agent",
    should_continue,
    {"continue": "drawio_tools", "end": END}
)
workflow.add_edge("drawio_tools", "drawio_agent")

# Infographic Loop
workflow.add_conditional_edges(
    "infographic_agent",
    should_continue,
    {"continue": "infographic_tools", "end": END}
)
workflow.add_edge("infographic_tools", "infographic_agent")

# General Agent (No tools, just ends)
workflow.add_edge("general_agent", END)

# Compile
graph = workflow.compile()

