from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm, get_thinking_instructions
from app.core.context import set_context, get_messages, get_context
import json

llm = get_llm()

CHARTS_SYSTEM_PROMPT = """You are a World-Class Data Visualization Specialist. Your goal is to generate professional, insightful, and aesthetically pleasing ECharts configurations (JSON).

### PERSONA & PRINCIPLES
- **Consultative Designer**: Don't just plot data. Analyze the context and choose the most impactful visualization (e.g., Waterfall for budget, Radar for multi-dim comparisons, Gauges for KPIs).
- **Aesthetic Excellence**: Use elegant color palettes, gradients, and subtle shadows. Ensure charts look premium and modern.
- **Data storytelling**: Add meaningful titles, subtitles, and data labels that tell a story.

### OUTPUT INSTRUCTIONS
- Return ONLY a valid JSON string representing the ECharts 'option' object.
- **Do NOT** wrap in markdown code blocks. Just the raw JSON string.
- **Strict JSON Syntax**: No comments (// or /* */), no trailing commas, double quotes for keys.

### ECHARTS CONFIGURATION TIPS
- **Structure**:
  {
    "title": { "text": "Main Title", "subtext": "Insightful Subtitle", "left": "center" },
    "tooltip": { "trigger": "axis", "axisPointer": { "type": "shadow" } },
    "grid": { "containLabel": true, "bottom": "10%" },
    "legend": { "top": "bottom" },
    "series": [ ... ]
  }
- **Styling**: Use `itemStyle: { borderRadius: 5 }` for bars. Use `areaStyle: {}` with gradients for line charts.
- **Themes**: Prefer high-contrast, professional color palettes.

### EXECUTION & ENRICHMENT
- **MANDATORY ENRICHMENT**: If the user provides sparse data, expand it into a professional dataset with realistic metrics and categories.
- **INSIGHTFUL FEATURES**: Add `dataZoom`, `toolbox` (feature: {saveAsImage: {}}), and `markLine` where appropriate.
- **LANGUAGE**: Match user's input language.
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
    system_msg = CHARTS_SYSTEM_PROMPT + get_thinking_instructions()
    if current_code:
        system_msg += f"\n\n### CURRENT CHART CODE\n```json\n{current_code}\n```\nApply changes to this code."
        
    prompt = [SystemMessage(content=system_msg)] + messages
    if instruction:
        prompt.append(HumanMessage(content=f"Instruction: {instruction}"))
    
    full_content = ""
    async for chunk in llm.astream(prompt):
        if chunk.content:
            full_content += chunk.content
    
    option_str = full_content
    
    # Robust JSON Extraction: Find the substring from first '{' to last '}'
    import re
    # Remove any thinking tags first just in case
    option_str = re.sub(r'<think>[\s\S]*?</think>', '', option_str, flags=re.DOTALL)
    
    match = re.search(r'(\{[\s\S]*\})', option_str)
    if match:
        option_str = match.group(1)
    else:
        # Fallback: simple markdown strip
        option_str = re.sub(r'^```\w*\n?', '', option_str.strip())
        option_str = re.sub(r'\n?```$', '', option_str.strip())
    
    return option_str.strip()

tools = [create_chart]
llm_with_tools = llm.bind_tools(tools)

async def charts_agent_node(state: AgentState):
    messages = state['messages']
    
    # 动态从历史中提取最新的 charts 代码（寻找最后一条 tool 消息且内容包含 series/xAxis 等）
    current_code = ""
    for msg in reversed(messages):
        if msg.type == "tool" and msg.content:
            stripped = msg.content.strip()
            if '"series":' in stripped or '"xAxis":' in stripped:
                current_code = stripped
                break

    # Safety: Ensure no empty text content blocks reach the LLM
    for msg in messages:
        if hasattr(msg, 'content') and not msg.content:
            msg.content = "Generate a chart"

    set_context(messages, current_code=current_code)
    
    system_prompt = SystemMessage(content="""You are a World-Class Data Analysis Consultant.
    YOUR MISSION is to act as a Strategic Advisor. When a user requests a chart, don't just "draw" it—ANALYZE and EXPAND it.
    
    ### ORCHESTRATION RULES:
    1. **CONSULTATIVE EXPANSION**: If the user says "draw a price chart", expand it to "draw a professional financial analysis chart showing price trends over the last 12 months, including moving averages, volume bars, and key resistance levels, with professional annotations".
    2. **MANDATORY TOOL CALL**: Always use `create_chart`.
    3. **DATA SYNTHESIS**: If the user lacks data, synthesize realistic, industry-relevant data points (e.g., SaaS metrics like Churn, CAC, LTV) to make the chart insightful.
    4. **STORYTELLING**: Suggest chart types that fit the "Insight" (e.g., Funnels for conversion, Heatmaps for patterns, Stacked Areas for composition).
    
    ### LANGUAGE CONSISTENCY:
    - Respond and call tools in the SAME LANGUAGE as the user.
    
    ### PROACTIVENESS:
    - BE DECISIVE. If you see an opportunity to add a "Goal Target" line or "YoY Growth" metrics, include it in the tool instruction.
    """ + get_thinking_instructions())
    
    full_response = None
    async for chunk in llm_with_tools.astream([system_prompt] + messages):
        if full_response is None:
            full_response = chunk
        else:
            full_response += chunk
    return {"messages": [full_response]}
