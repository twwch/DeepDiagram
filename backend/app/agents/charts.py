from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm
from app.core.context import set_context, get_messages, get_context
import json

llm = get_llm()

CHARTS_SYSTEM_PROMPT = """You are an expert Data Visualization Specialist.
Your goal is to generate professional ECharts configurations (JSON).

### INPUT ANALYSIS
- Identify the data series, categories (labels), and the best chart type (Bar, Line, Pie, Scatter, Radar, etc.) to represent the relationship.

### OUTPUT INSTRUCTIONS
- Retrun ONLY a valid JSON string representing the ECharts 'option' object.
- **Do NOT** wrap in markdown code blocks. Just the raw JSON string.

### ECHARTS CONFIGURATION TIPS
- **Structure**:
  {
    "title": { "text": "..." },
    "tooltip": { "trigger": "axis" },
    "legend": { "data": [...] },
    "xAxis": { "type": "category", "data": [...] },
    "yAxis": { "type": "value" },
    "series": [ { "name": "...", "type": "bar", "data": [...] } ]
  }
- **Styling**: Add `smooth: true` for line charts. Use colors if specified.
- **Pie Charts**: DO NOT use xAxis/yAxis. Use `series: [{ type: 'pie', data: [{name:..., value:...}] }]`.

### EXECUTION
- If data is missing (e.g. "Draw a sales chart"), GENERATE realistic dummy data.
- Return ONLY the JSON string.
"""

@tool
async def create_chart(instruction: str):
    """
    Renders a Chart using Apache ECharts based on instructions.
    Args:
        instruction: Detailed instruction on what chart to create or modify.
    """
    messages = get_messages()
    context = get_context()
    current_code = context.get("current_code", "")
    
    # Call LLM to generate the ECharts option
    system_msg = CHARTS_SYSTEM_PROMPT
    if current_code:
        system_msg += f"\n\n### CURRENT CHART CODE\n```json\n{current_code}\n```\nApply changes to this code."
        
    prompt = [SystemMessage(content=system_msg)] + messages
    if instruction:
        prompt.append(HumanMessage(content=f"Instruction: {instruction}"))
    
    response = await llm.ainvoke(prompt)
    option_str = response.content
    
    # Strip potential markdown boxes
    import re
    option_str = re.sub(r'^```[a-zA-Z]*\n', '', option_str)
    option_str = re.sub(r'\n```$', '', option_str)
    
    return option_str.strip()

tools = [create_chart]
llm_with_tools = llm.bind_tools(tools)

async def charts_agent_node(state: AgentState):
    messages = state['messages']
    current_code = state.get("current_code", "")
    set_context(messages, current_code=current_code)
    
    system_prompt = SystemMessage(content="""You are an expert Data Visualization Orchestrator.
    Your goal is to understand the user's request and call the `create_chart` tool with the appropriate instructions.
    
    Interpret the data visualization needs and provide a clear instruction to the tool.
    """)
    
    response = await llm_with_tools.ainvoke([system_prompt] + messages)
    return {"messages": [response]}
