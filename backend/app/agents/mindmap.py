from langchain_core.messages import SystemMessage, AIMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm

llm = get_llm()

@tool
def create_mindmap(markdown: str):
    """
    Renders a MindMap.
    Args:
        markdown: The complete Markdown content for the mindmap (Markmap syntax). 
                  Start with a single top-level header (# Title), then use lists (- Item) for branches.
    """
    # Simply return the markdown so the frontend can render it.
    return markdown

@tool
def modify_mindmap(instruction: str, current_markdown: str):
    """
    Modifies existing markdown based on instructions.
    """
    return f"{current_markdown}\n- [Modified]: {instruction}"

tools = [create_mindmap] # Rely on LLM to generate full new markdown for modifications too
llm_with_tools = llm.bind_tools(tools)

async def mindmap_agent_node(state: AgentState):
    messages = state['messages']
    
    system_prompt = SystemMessage(content="""You are an expert MindMap Generator.
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
    - You MUST call the `create_mindmap` tool.
    - The argument `markdown` must be the VALID, COMPLETE markdown string.
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
    """)
    
    response = await llm_with_tools.ainvoke([system_prompt] + messages)
    return {"messages": [response]}

# Simple ReAct loop for the agent could be implemented here or managed by the top-level graph.
# For simplicity, we'll define the node here and likely bind it in the main graph.
