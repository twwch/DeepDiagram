from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm
from app.core.context import set_context, get_messages, get_context

llm = get_llm()

MINDMAP_SYSTEM_PROMPT = """You are an expert MindMap Generator.
Your goal is to generate detailed, structured mindmaps using Markdown syntax (Markmap).

### INPUT ANALYSIS
- Analyze the user's request to understand the core topic and sub-topics.
- If the user provides a text blob or an image, structure the information hierarchically.

### MARKDOWN RULES (Markmap)
- **Root Node**: Must start with a single `# Title`.
- **Branches**: Use bullet points `-` or `*`.
- **Hierarchy**: Indent bullet points to create sub-branches.
- **Formatting**: You can use **bold**, *italic*, and [links](url).

### CONTENT RICHNESS (CRITICAL)
- **Expand Simple Inputs**: If the user provides a simple topic (e.g. "SpaceX"), expand it into a comprehensive hierarchy with at least 4-5 main branches and 2-3 sub-levels each.
- **Hierarchical Depth**: Always aim for at least 3 levels of depth.
- **Logical Grouping**: Organically group related concepts to ensure a clean, professional structure.
- **Descriptions**: Do not just list keywords. Provide short descriptions or sub-points where valuable.
- **LANGUAGE**: Detect the user's input language and ensure all mindmap nodes, branches, and descriptions are in that same language.

### EXECUTION
- Return the VALID, COMPLETE markdown string.
- Do not wrap in markdown code blocks.
- **Example**:
  # Project Plan
  ## Phase 1
  - Research included
    - User interviews
    - Competitor analysis
  ## Phase 2
  - Design
    - UI Mockups
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
    
    response = await llm.ainvoke(prompt)
    markdown = response.content
    
    # Simply return the markdown so the frontend can render it.
    return markdown

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
    
    system_prompt = SystemMessage(content="""You are an expert MindMap Orchestrator.
    Your goal is to understand the user's request and call the `create_mindmap` tool with the appropriate instructions.
    
    ### CRITICAL: LANGUAGE CONSISTENCY
    You MUST ALWAYS respond in the SAME LANGUAGE as the user's input. If the user writes in Chinese, respond in Chinese. If the user writes in English, respond in English. This applies to ALL your outputs including tool arguments and explanations.
    
    ### PROACTIVENESS PRINCIPLES:
    1. **BE DECISIVE**: If the user provides a topic (e.g., "SpaceX"), call the tool IMMEDIATELY.
    2. **STRUCTURE DATA**: If no structure is provided, create a deep, professional hierarchy yourself.
    3. **AVOID HESITATION**: DO NOT ask for sub-topics or levels. Just generate a rich mindmap.
    """)
    
    response = await llm_with_tools.ainvoke([system_prompt] + messages)
    return {"messages": [response]}

# Simple ReAct loop for the agent could be implemented here or managed by the top-level graph.
# For simplicity, we'll define the node here and likely bind it in the main graph.
