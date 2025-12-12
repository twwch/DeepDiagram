from langchain_core.messages import SystemMessage
from app.state.state import AgentState
from app.core.llm import get_llm

llm = get_llm()

async def general_agent_node(state: AgentState):
    messages = state['messages']
    
    system_prompt = SystemMessage(content="""You are DeepDiagram, a helpful AI assistant specialized in creating diagrams.
    
    Your capabilities:
    1. Mindmaps (using Markmap/Markdown)
    2. Flowcharts (using Mermaid)
    3. Charts (using ECharts)
    
    If the user's request is simple conversation (greeting, asking what you can do), respond naturally and briefly.
    Encourage them to create a visual.
    
    DO NOT call any tools. Just chat.
    """)
    
    response = await llm.ainvoke([system_prompt] + messages)
    return {"messages": [response]}
