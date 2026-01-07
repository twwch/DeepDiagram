from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from app.core.config import settings
from app.core.llm import get_llm
from app.state.state import AgentState
from app.core.context import get_messages

llm = get_llm()

DRAWIO_SYSTEM_PROMPT = """You are an expert at creating Draw.io (mxGraph) XML diagrams.
Your goal is to interpret the user's request and generate a valid, uncompressed Draw.io XML string representing the diagram.

### XML Structure Rules:
1.  Root element must be `<mxfile host="Electron" modified="..." agent="..." version="...">`.
2.  Inside `<mxfile>`, contain one `<diagram id="..." name="Page-1">`.
3.  Inside `<diagram>`, contain `<mxGraphModel dx="..." dy="..." grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">`.
4.  Inside `<mxGraphModel>`, contain `<root>`.
5.  Inside `<root>`, always start with:
    ```xml
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    ```
6.  All other `mxCell` elements (nodes and edges) must have `parent="1"`.
7.  **Do not** use compressed XML (deflate/base64). Use plain, human-readable XML.

### Styling Guidelines:
-   Use standard `style` attributes for shapes (e.g., `style="rounded=1;whiteSpace=wrap;html=1;"` for rectangles).
-   Use `style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"` for connectors (edges).
- **CONTENT RICHNESS**: If the user request is simple (e.g., "AWS Architecture"), expand it into a detailed, professional diagram including VPCs, Subnets, multiple availability zones, and common services (ELB, EC2, RDS, S3) arranged logically.
- **LANGUAGE**: All text inside the diagram (values, labels, descriptions) MUST be in the same language as the user's input.

### Example Output format:
<mxfile host="Electron" agent="DeepDiagram" version="24.0.0">
  <diagram id="UUID" name="Page-1">
    <mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="2" value="Start" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="340" y="240" width="120" height="60" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>

IMPORTANT: Return ONLY the raw XML string. Do not wrap it in markdown code blocks. Do not add explanations.
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
    
    response = await llm.ainvoke(prompt)
    xml_content = response.content
    
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
    
    system_prompt = SystemMessage(content="""You are an expert Draw.io Orchestrator.
    Your goal is to understand the user's request and call the `render_drawio_xml` tool with the appropriate instructions.
    
    ### CRITICAL: LANGUAGE CONSISTENCY
    You MUST ALWAYS respond in the SAME LANGUAGE as the user's input. If the user writes in Chinese, respond in Chinese. If the user writes in English, respond in English. This applies to ALL your outputs including tool arguments and explanations.

    ### PROACTIVENESS PRINCIPLES:
    1. **BE DECISIVE**: If the user provides a topic (e.g., "Network architecture"), call the tool IMMEDIATELY.
    2. **STRUCTURE DATA**: If no architecture is provided, create a professional layout yourself.
    3. **AVOID HESITATION**: DO NOT ask for node types or positions. Just generate a rich diagram.
    """)
    
    response = await llm_with_tools.ainvoke([system_prompt] + messages)
    return {"messages": [response]}
