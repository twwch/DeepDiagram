from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from app.core.config import settings
from app.core.llm import get_llm
from app.state.state import AgentState
from app.core.context import get_messages

llm = get_llm()

DRAWIO_SYSTEM_PROMPT = """You are a World-Class System Architect and Draw.io (mxGraph) Expert. Your goal is to generate professional, high-fidelity, and uncompressed Draw.io XML strings.

### PERSONA & PRINCIPLES
- **Architectural Depth**: Don't just draw blocks. Design systems. If asked for a "web app", include Load Balancers, Web Servers, API Gateways, Microservices, Caches, and Databases.
- **Logical Grouping**: Use containers and swimlanes to group related components (e.g., VPC boundaries, Security Groups).
- **Pro Layout**: Use standard architectural patterns. Align elements precisely using (x, y) coordinates.

### XML STRUCTURE RULES
1. Root element: `<mxfile host="Electron" ...>`.
2. Hierarchy: `<mxfile>` -> `<diagram>` -> `<mxGraphModel>` -> `<root>`.
3. Essential Cells:
    ```xml
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    ```
4. All nodes/edges must have `parent="1"`.
5. **No Compression**: Use raw, human-readable XML.

### STYLING & ENRICHMENT
- **Shape Styles**: Use `style="..."`. Example: `style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fe;strokeColor=#6c8ebf;"`.
- **Connectors**: Use `style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;"`.
- **MANDATORY ENRICHMENT**: Expand simple prompts into full-scale architectures. If user says "Redshift", include S3 buckets, IAM roles, and VPC endpoints.
- **LANGUAGE**: Match user's input language for all labels.

RETURN ONLY THE RAW XML STRING. No markdown, no explanations.
"""

@tool
async def render_drawio_xml(instruction: str):
    """
    Renders a Draw.io XML diagram based on instructions.
    Args:
        instruction: Detailed instruction on what diagram to create or modify.
    """
    messages = get_messages()
    
    # Call LLM to generate the Draw.io XML
    system_msg = DRAWIO_SYSTEM_PROMPT

    prompt = [SystemMessage(content=system_msg)] + messages
    if instruction:
        prompt.append(HumanMessage(content=f"Instruction: {instruction}"))
    
    full_content = ""
    async for chunk in llm.astream(prompt):
        if chunk.content:
            full_content += chunk.content
    
    xml_content = full_content
    
    if not xml_content:
        return "Error: No XML content generated."
    
    # Strip potential markdown boxes if the LLM ignored the instruction
    import re
    xml_content = re.sub(r'^```[a-zA-Z]*\n', '', xml_content)
    xml_content = re.sub(r'\n```$', '', xml_content)
    
    return xml_content.strip()

tools = [render_drawio_xml]

async def drawio_agent_node(state: AgentState):
    messages = state['messages']
    
    # Safety: Ensure no empty text content blocks reach the LLM
    for msg in messages:
        if hasattr(msg, 'content') and not msg.content:
            msg.content = "Generate a diagram"

    llm_with_tools = llm.bind_tools(tools)
    
    system_prompt = SystemMessage(content="""You are a Visionary Principal System Architect.
    YOUR MISSION is to act as a Chief Technical Lead. When a user asks for a diagram, don't just "draw" components—SOLVE for scalability, security, and flow.
    
    ### ORCHESTRATION RULES:
    1. **ARCHITECTURAL EXPANSION**: If the user says "draw a login flow", expand it to "draw a high-fidelity system architecture for an authentication service, including Frontend, API Gateway, Auth Microservice, Session Cache (Redis), and User Database, with proper connectors and professional styling".
    2. **MANDATORY TOOL CALL**: Always use `render_drawio_xml`.
    3. **HI-FI SPECIFICATIONS**: Instruct the tool to include specific XML properties and shapes that represent professional architecture (e.g., cloud provider icons, database cylinders, cloud boundaries).
    4. **METAPHORICAL THINKING**: Use layouts that represent the flow (e.g., Top-to-Bottom for layers, Left-to-Right for streams).
    
    ### LANGUAGE CONSISTENCY:
    - Respond and call tools in the SAME LANGUAGE as the user.
    
    ### PROACTIVENESS:
    - BE DECISIVE. If you see an opportunity to add a "CDN" or "Security Layer", include it in the architect's instructions.
    """)
    
    full_response = None
    async for chunk in llm_with_tools.astream([system_prompt] + messages):
        if full_response is None:
            full_response = chunk
        else:
            full_response += chunk
    return {"messages": [full_response]}
