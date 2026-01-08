from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm
from app.core.context import set_context, get_messages, get_context

llm = get_llm()

MINDMAP_SYSTEM_PROMPT = """You are a World-Class Strategic Thinking Partner and Knowledge Architect. Your goal is to generate deep, insightful, and structured mindmaps using Markdown (Markmap).

### PERSONA & PRINCIPLES
- **Deep Thinker**: Don't just list sub-topics. Map the entire mental model. If a user asks for "Remote Work", include Mental Health, Tooling, Communication Protocols, Management Shifts, and Future Trends.
- **Hierarchical Depth**: Aim for 4-5 levels of depth. Expand broad concepts into specific, actionable points.
- **Visual Structure**: Use `#` for root, `##` for main branches, and `-` for detailed leaf nodes.

### MARKDOWN RULES
- **Root**: Exactly one `# Main Topic`.
- **Branches**: Use `##`, `###`, and `-` for nesting.
- **Enrichment**: Use **bold** for key terms and `code` for technical concepts.

### EXECUTION & ENRICHMENT
- **MANDATORY ENRICHMENT**: Transform simple keywords into comprehensive knowledge graphs.
- **PROMPT TO ACTION**: Include "Next Steps" or "Key Takeaways" branches where appropriate.
- **LANGUAGE**: Match user's input language.

Return ONLY the raw Markdown. No code fences.
"""

@tool
async def create_mindmap(instruction: str):
    """
    Renders a MindMap based on instructions.
    Args:
        instruction: Detailed instruction on what mindmap to create or modify.
    """
    messages = get_messages()
    context = get_context()
    current_code = context.get("current_code", "")
    
    # Call LLM to generate the Mindmap code
    system_msg = MINDMAP_SYSTEM_PROMPT
    if current_code:
        system_msg += f"\n\n### CURRENT MINDMAP CODE (Markdown)\n```markdown\n{current_code}\n```\nApply changes to this code."

    prompt = [SystemMessage(content=system_msg)] + messages
    if instruction:
        prompt.append(HumanMessage(content=f"Instruction: {instruction}"))
    
    full_content = ""
    async for chunk in llm.astream(prompt):
        if chunk.content:
            full_content += chunk.content
    
    # Simply return the markdown so the frontend can render it.
    return full_content

tools = [create_mindmap]
llm_with_tools = llm.bind_tools(tools)

async def mindmap_agent_node(state: AgentState):
    messages = state['messages']
    
    # 动态从历史中提取最新的 mindmap 代码（寻找最后一条 tool 消息且内容非空）
    current_code = ""
    for msg in reversed(messages):
        if msg.type == "tool" and msg.content:
            # 简单判断是否是 mindmap (Markdown 格式) 
            # 更好的办法是判断 tool_name，但目前 content 已经足够
            stripped = msg.content.strip()
            if stripped.startswith("#"):
                current_code = stripped
                break

    # Safety: Ensure no empty text content blocks reach the LLM
    for msg in messages:
        if hasattr(msg, 'content') and not msg.content:
            msg.content = "Generate a mindmap"

    set_context(messages, current_code=current_code)
    
    system_prompt = SystemMessage(content="""You are a Visionary Strategic Thinking Partner.
    YOUR MISSION is to act as a Mental Model Consultant. When a user provides a topic, don't just "brainstorm" it—MAP the entire ecosystem.
    
    ### ORCHESTRATION RULES:
    1. **STRATEGIC EXPANSION**: If the user says "mindmap for a startup", expand it to "create a 5-level deep mindmap for a tech startup, covering Product/Market Fit, Scaling Strategy, Financial Runway, Team Culture, and Technology Stack, with detailed sub-points and action items".
    2. **MANDATORY TOOL CALL**: Always use `create_mindmap`.
    3. **HI-FI HIERARCHY**: Instruct the tool to avoid shallow maps. Enforce a minimum of 4 levels of depth.
    4. **METAPHORICAL THINKING**: Use categories that represent the "Full Picture" (e.g., SWOT analysis, 5W1H, or First Principles).
    
    ### LANGUAGE CONSISTENCY:
    - Respond and call tools in the SAME LANGUAGE as the user.
    
    ### PROACTIVENESS:
    - BE DECISIVE. If a topic has obvious "Pros/Cons" or "Future Risks", include them in the brainstormed instructions.
    """)
    
    full_response = None
    async for chunk in llm_with_tools.astream([system_prompt] + messages):
        if full_response is None:
            full_response = chunk
        else:
            full_response += chunk
    return {"messages": [full_response]}

# Simple ReAct loop for the agent could be implemented here or managed by the top-level graph.
# For simplicity, we'll define the node here and likely bind it in the main graph.
