from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm
from app.core.context import set_context, get_messages, get_context

llm = get_llm()

FLOW_SYSTEM_PROMPT = """You are an expert Flowchart Generator.
Your goal is to generate high-end, professional flowcharts in JSON format for React Flow.

### NODE TYPES (V4 MODERN CARD)
- `start`: Flow entry point (Pill shape).
- `end`: Flow exit point (Pill shape).
- `process`: Action step (Modern Card with accent bar).
- `decision`: Logic branch (Amber SVG Diamond). ALWAYS has multiple outgoing edges.

### DESIGN PRINCIPLES (CRITICAL)
1. **CONTENT RICHNESS**: If the user request is simple (e.g., "login flow"), expand it into a professional, production-ready diagram. Include edge cases (e.g., "Forgot Password", "Invalid Credentials", "MFA"), loading states, and redirect logic.
2. **NO MANUAL STYLING**: NEVER include "style", "className", or "transform" in the JSON. The system handles all appearance natively.
3. **NO ROTATION**: NEVER rotate nodes. The "decision" diamond is handled by the system geometry.
4. **COMPLETENESS**: Include all necessary states, conditions, and loops.
5. **LANGUAGE**: All node labels, process steps, and decision texts MUST be in the same language as the user's input message.
6. **Clarity**: Keep labels concise and professional.

### LAYOUT & GRID
Nodes MUST be placed on a clean grid.
- **Vertical spacing**: Exactly **250px** between sequential nodes.
- **Horizontal spacing**: Exactly **400px** for parallel branches.
- **Positioning**: Start at { "x": 0, "y": 0 }.

### OUTPUT FORMAT (JSON)
{
  "nodes": [
    { "id": "1", "type": "start", "data": { "label": "START" }, "position": { "x": 0, "y": 0 } },
    { "id": "2", "type": "process", "data": { "label": "STEP 1" }, "position": { "x": 0, "y": 250 } }
  ],
  "edges": [
    { "id": "e1-2", "source": "1", "target": "2", "animated": true }
  ]
}

Return ONLY raw JSON. NO markdown code blocks (e.g. ```json ... ```).
Do NOT include any explanatory text outside the JSON.
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
    cleaned_json = re.sub(r'^```\w*\n?', '', json_str.strip())
    cleaned_json = re.sub(r'\n?```$', '', cleaned_json.strip())
    
    return cleaned_json.strip()

tools = [create_flow]
llm_with_tools = llm.bind_tools(tools)

async def flow_agent_node(state: AgentState):
    messages = state['messages']
    
    # 动态从历史中提取最新的 flowchart 代码（寻找最后一条 tool 消息且内容包含 nodes/edges）
    current_code = ""
    for msg in reversed(messages):
        if msg.type == "tool" and msg.content:
            stripped = msg.content.strip()
            if '"nodes":' in stripped and '"edges":' in stripped:
                current_code = stripped
                break

    # Safety: Ensure no empty text content blocks reach the LLM
    for msg in messages:
        if hasattr(msg, 'content') and not msg.content:
            msg.content = "Generate a flowchart"

    set_context(messages, current_code=current_code)
    
    system_prompt = SystemMessage(content="""You are an expert Flowchart Orchestrator.
    Your goal is to understand the user's request and call the `create_flowchart` tool with the appropriate instructions.
    
    ### CRITICAL: LANGUAGE CONSISTENCY
    You MUST ALWAYS respond in the SAME LANGUAGE as the user's input. If the user writes in Chinese, respond in Chinese. If the user writes in English, respond in English. This applies to ALL your outputs including tool arguments and explanations.
    
    ### PROACTIVENESS PRINCIPLES:
    1. **BE DECISIVE**: If the user provides a process or logic, call the tool IMMEDIATELY.
    2. **STRUCTURE DATA**: If no steps are provided, create a professional flow yourself.
    3. **AVOID HESITATION**: DO NOT ask for steps or boxes. Just generate a rich flowchart.
    """)
    
    response = await llm_with_tools.ainvoke([system_prompt] + messages)
    return {"messages": [response]}
