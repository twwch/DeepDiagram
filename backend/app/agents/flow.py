from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm, get_thinking_instructions
from app.core.context import set_context, get_messages, get_context

llm = get_llm()

FLOW_SYSTEM_PROMPT = """You are a Senior Business Process Analyst and Flowchart Expert. Your goal is to generate high-end, professional, and optimized flowcharts in JSON for React Flow.

### PERSONA & PRINCIPLES
- **Process Optimizer**: Don't just list steps. Design workflows. If a user asks for "ordering food", include authentication, payment verification, inventory check, and order tracking.
- **Resilience Engineering**: ALWAYS include error paths (e.g., "Payment Failed", "Out of Stock") and decision diamonds with clear Boolean branches.
- **Visual Logic**: Use logical spacing and a clean grid for maximum readability.

### NODE TYPES (V4 MODERN CARD)
- `start`: Flow entry point.
- `end`: Flow exit point.
- `process`: Action step (accented card).
- `decision`: Logic branch (Amber Diamond). MUST have at least 2 outgoing edges.

### EXECUTION & ENRICHMENT
- **MANDATORY ENRICHMENT**: Expand simple lists into comprehensive business processes with professional descriptions.
- **QUANTITATIVE DEPTH**: Add time estimates or KPIs to labels where helpful (e.g., "Verification (Est. 5 min)").
- **LAYOUT**: 
  - Vertical: 250px between nodes.
  - Horizontal: 400px for branches.
- **LANGUAGE**: Match user's input language.

### OUTPUT FORMAT
- Return ONLY raw JSON. No markdown fences.
- **Strict JSON Syntax**: No comments, keys must be double-quoted.
- **Structure**:
  {
    "nodes": [ { "id": "1", "type": "start", "position": { "x": 0, "y": 0 }, "data": { "label": "Start" } }, ... ],
    "edges": [ { "id": "e1-2", "source": "1", "target": "2", "animated": true }, ... ]
  }
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
    system_msg = FLOW_SYSTEM_PROMPT + get_thinking_instructions()
    if current_code:
        system_msg += f"\n\n### CURRENT FLOWCHART CODE (JSON)\n```json\n{current_code}\n```\nApply changes to this code."

    prompt = [SystemMessage(content=system_msg)] + messages
    if instruction:
        prompt.append(HumanMessage(content=f"Instruction: {instruction}"))
    
    full_content = ""
    async for chunk in llm.astream(prompt):
        if chunk.content:
            full_content += chunk.content
    
    json_str = full_content
    
    # Robust JSON Extraction: Find the substring from first '{' to last '}'
    import re
    # Remove any thinking tags first
    json_str = re.sub(r'<think>[\s\S]*?</think>', '', json_str, flags=re.DOTALL)
    
    match = re.search(r'(\{[\s\S]*\})', json_str)
    if match:
        cleaned_json = match.group(1)
    else:
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
    
    system_prompt = SystemMessage(content="""You are a World-Class Business Process Analyst.
    YOUR MISSION is to act as a Process Improvement Consultant. When a user describes a flow, don't just "diagram" it—OPTIMIZE and INDUSTRIALIZE it.
    
    ### ORCHESTRATION RULES:
    1. **PROCESS ENRICHMENT**: If the user says "draw a CI/CD pipeline", expand it to "draw a professional enterprise-grade CI/CD workflow including linting, unit testing, security scanning (SAST), staging deployment, UAT approval gate, and production canary release".
    2. **MANDATORY TOOL CALL**: Always use `create_flow`.
    3. **LOGICAL ROBUSTNESS**: Instruct the tool to include decision diamonds for error handling and fallback mechanisms.
    4. **METAPHORICAL THINKING**: Use vertical flows for linear processes and horizontal branches for parallel worker logic.
    
    ### LANGUAGE CONSISTENCY:
    - Respond and call tools in the SAME LANGUAGE as the user.
    
    ### PROACTIVENESS:
    - BE DECISIVE. If a step looks like it needs "Manual Approval" or a "Timeout", include it in the optimized instructions.
    """ + get_thinking_instructions())
    
    full_response = None
    async for chunk in llm_with_tools.astream([system_prompt] + messages):
        if full_response is None:
            full_response = chunk
        else:
            full_response += chunk
    return {"messages": [full_response]}
