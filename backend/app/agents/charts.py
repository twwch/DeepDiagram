from langchain_core.messages import SystemMessage
from langchain_core.tools import tool
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm
import json

llm = get_llm()

@tool
def create_chart(option_str: str):
    """
    Renders a Chart using Apache ECharts.
    Args:
        option_str: A valid JSON string representing the ECharts 'option' object. 
                    Must include 'series', 'xAxis', 'yAxis' (for cartesian), or other required fields.
    """
    # Validate JSON (optional but good practice)
    try:
        json.loads(option_str)
    except json.JSONDecodeError:
        # If LLM messed up, we might return an error string or try to fix it. 
        pass
    return option_str

@tool
def modify_chart(instruction: str, current_option: str):
    """
    Modifies existing Echarts option.
    """
    # Placeholder
    return current_option

tools = [create_chart]
llm_with_tools = llm.bind_tools(tools)

async def charts_agent_node(state: AgentState):
    messages = state['messages']
    
    current_code = state.get("current_code", "")

    system_prompt = SystemMessage(content=f"""You are an expert Data Visualization Specialist.
    Your goal is to generate professional ECharts configurations (JSON).

    ### CURRENT CHART CODE
    ```json
    {current_code if current_code else "None (New Chart)"}
    ```

    ### INPUT ANALYSIS
    - Identify the data series, categories (labels), and the best chart type (Bar, Line, Pie, Scatter, Radar, etc.) to represent the relationship.
    - If the user asks to MODIFY the current chart (e.g., "Add 10 to Sales", "Remove 'Others'", "Change color"), you **MUST** apply these changes to the `CURRENT CHART CODE` above and regenerate the **FULL JSON**.

    ### OUTPUT INSTRUCTIONS
    - **CRITICAL**: You CANNOT update the chart by just talking. You **MUST** call the `create_chart` tool with the new full JSON.
    - If you do not call the tool, the chart will NOT update.
    - The `option_str` argument MUST be a valid JSON string.
    - **Do NOT** wrap in markdown code blocks. Just the raw JSON string.
    - **NO CHIT-CHAT**: Do NOT say "Here is your chart" or "I updated the code". JUST CALL THE TOOL.

    ### ECHARTS CONFIGURATION TIPS
    - **Structure**:
      {{
        "title": {{ "text": "..." }},
        "tooltip": {{ "trigger": "axis" }},
        "legend": {{ "data": [...] }},
        "xAxis": {{ "type": "category", "data": [...] }},
        "yAxis": {{ "type": "value" }},
        "series": [ {{ "name": "...", "type": "bar", "data": [...] }} ]
      }}
    - **Styling**: Add `smooth: true` for line charts. Use colors if specified.
    - **Pie Charts**: DO NOT use xAxis/yAxis. Use `series: [{{ type: 'pie', data: [{{name:..., value:...}}] }}]`.
    - **Pareto Charts**: Use dual y-axes. Left logic for 'bar' (counts), Right axis for 'line' (cumulative percentage).

    ### EXECUTION
    - If data is missing (e.g. "Draw a sales chart"), GENERATE realistic dummy data.
    - **DO NOT** output the JSON in the chat message. ONLY use the tool.
    - Return ONLY the function call.
    """)
    
    response = await llm_with_tools.ainvoke([system_prompt] + messages)
    return {"messages": [response]}
