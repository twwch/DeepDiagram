from langchain_core.messages import SystemMessage
from langchain_core.tools import tool
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm

llm = get_llm()

@tool
def create_flow(code: str):
    """
    Renders a Mermaid flowchart.
    Args:
        code: The complete Mermaid syntax code (e.g., starts with 'graph TD' or 'flowchart LR').
    """
    # Simply return the code so the frontend can render it.
    # We might want to strip markdown code blocks if the LLM includes them.
    cleaned_code = code.replace("```mermaid", "").replace("```", "").strip()
    return cleaned_code

@tool
def modify_flow(instruction: str, current_code: str):
    """
    Modifies existing Mermaid code based on instructions.
    Args:
        instruction: What to change.
        current_code: The current mermaid code.
    """
    # This is a placeholder; in a real agent, the LLM loop would handle the modification logic 
    # and call create_flow with the new code. 
    # But if we keep this tool, it implies the TOOL does the modification.
    # For now, let's just return a placeholder or ask the LLM to do it.
    # Better approach: The LLM should just call `create_flow` with the NEW code.
    # But for compatibility, let's leave it but returning a comment.
    return f"%% Modified based on: {instruction}\n{current_code}"

tools = [create_flow] # modify_flow is better handled by the LLM generating new code.
llm_with_tools = llm.bind_tools(tools)

async def flow_agent_node(state: AgentState):
    messages = state['messages']
    
    system_prompt = SystemMessage(content="""You are an expert Flowchart Generator and Image Analyst.
    Your goal is to generate ACCURATE, COMPLEX Mermaid flowchart code.

    ### CRITICAL: HOW TO HANDLE IMAGES
    If the user provides an image (e.g., a technical diagram, architecture, or workflow):
    1. **VISUAL ANALYSIS**: breakdown every node (box, diamond, circle), connection (arrow), and label text in the image.
    2. **STRUCTURAL FIDELITY**: You MUST reproduce the EXACT structure. 
       - If there is a "Decision Diamond" (Check 80%?), use `id{Text}` syntax.
       - If there are branches (Yes/No), ensure the arrows have labels: `A -- Yes --> B`.
       - If there are subgraphs (dotted boxes), use `subgraph Title ... end`.
    3. **TEXT EXTRACTION**: Transcribe the text inside nodes exactly as it appears.

    ### MERMAID SYNTAX RULES
    - Start with `graph TD` (Top-Down) or `graph LR` (Left-Right) based on the image layout.
    - Use meaningful IDs (e.g., `Start`, `Process1`, `Decision`) or `A`, `B`, `C` if simple.
    - Node Syntax:
       - Rectangle: `id[Text]`
       - Round Rect: `id(Text)`
       - Circle: `id((Text))`
       - Rhombus (Decision): `id{Text}`
    - Edge Syntax:
       - Arrow: `A --> B`
       - Dotted: `A -.-> B`
       - With Text: `A -- Text --> B`

    ### EXECUTION
    - You MUST call the `create_flow` tool.
    - The argument `code` must be the VALID, COMPLETE Mermaid syntax.
    - Do NOT wrap the code in markdown blocks (```) inside the tool argument. just the raw string.
    """)
    
    response = await llm_with_tools.ainvoke([system_prompt] + messages)
    return {"messages": [response]}
