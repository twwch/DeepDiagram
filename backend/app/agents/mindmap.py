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

### EXECUTION
- Return the VALID, COMPLETE markdown string.
- Do not wrap in markdown code blocks.
- **Expand the content**: Do not just list keywords. Provide short descriptions or sub-points where valuable.
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
    current_code = state.get("current_code", "")
    set_context(messages, current_code=current_code)
    
    system_prompt = SystemMessage(content="""You are an expert MindMap Orchestrator.
    Your goal is to understand the user's request and call the `create_mindmap` tool with the appropriate instructions.
    
    If the user wants a mindmap or structure, use the tool.
    Provide a clear, detailed instruction to the tool about what to generate.
    """)
    
    response = await llm_with_tools.ainvoke([system_prompt] + messages)
    return {"messages": [response]}

# Simple ReAct loop for the agent could be implemented here or managed by the top-level graph.
# For simplicity, we'll define the node here and likely bind it in the main graph.
