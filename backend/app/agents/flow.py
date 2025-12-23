from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm
from app.core.context import set_context, get_messages, get_context

llm = get_llm()

FLOW_SYSTEM_PROMPT = """You are an expert Flowchart Generator.
Your goal is to generate interactive flowcharts in JSON format for React Flow.

### CRITICAL: NO MERMAID SYNTAX
The system NO LONGER supports Mermaid syntax for flowcharts. Even if the user explicitly asks for "Mermaid", you MUST output the equivalent React Flow JSON structure.

### OUTPUT FORMAT (JSON)
Return a valid JSON string containing `nodes` and `edges`:
{
  "nodes": [
    { "id": "1", "data": { "label": "Start" }, "position": { "x": 0, "y": 0 }, "type": "default" },
    ...
  ],
  "edges": [
    { "id": "e1-2", "source": "1", "target": "2", "label": "Yes", "animated": true },
    ...
  ]
}

### POSITIONING
Assign reasonable x and y coordinates to nodes (e.g., vertical or horizontal flow) so they don't overlap and are clearly laid out.

### EXECUTION
Return ONLY the raw JSON string.
Do not wrap in markdown code blocks.
"""

@tool
async def create_flow(instruction: str):
    """
    Renders an interactive flowchart using React Flow based on instructions.
    Args:
        instruction: Detailed instruction on what flowchart to create or modify.
    """
    messages = get_messages()
    context = get_context()
    current_code = context.get("current_code", "")
    
    # Call LLM to generate the Flow JSON
    system_msg = FLOW_SYSTEM_PROMPT
    if current_code:
        system_msg += f"\n\n### CURRENT FLOWCHART CODE (JSON)\n```json\n{current_code}\n```\nApply changes to this code."

    prompt = [SystemMessage(content=system_msg)] + messages
    if instruction:
        prompt.append(HumanMessage(content=f"Instruction: {instruction}"))
    
    response = await llm.ainvoke(prompt)
    json_str = response.content
    
    # Strip potential markdown boxes
    import re
    cleaned_json = re.sub(r'^```[a-zA-Z]*\n', '', json_str)
    cleaned_json = re.sub(r'\n```$', '', cleaned_json)
    
    return cleaned_json.strip()

tools = [create_flow]
llm_with_tools = llm.bind_tools(tools)

async def flow_agent_node(state: AgentState):
    messages = state['messages']
    current_code = state.get("current_code", "")
    set_context(messages, current_code=current_code)
    
    system_prompt = SystemMessage(content="""You are an expert Flowchart Orchestrator.
    Your goal is to understand the user's request and call the `create_flow` tool with the appropriate instructions.
    
    Interpret the flowchart requirements and provide a clear instruction to the tool.
    """)
    
    response = await llm_with_tools.ainvoke([system_prompt] + messages)
    return {"messages": [response]}
