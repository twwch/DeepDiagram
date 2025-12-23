from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from app.core.config import settings
from app.core.llm import get_llm
from app.state.state import AgentState
from app.core.context import set_context, get_messages, get_context

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
-   For complex diagrams, ensure spatial layout is clear and nodes do not overlap.

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
    context = get_context()
    current_code = context.get("current_code", "")
    
    # Call LLM to generate the Draw.io XML
    system_msg = DRAWIO_SYSTEM_PROMPT
    if current_code:
        system_msg += f"\n\n### CURRENT DIAGRAM XML\n```xml\n{current_code}\n```\nApply changes to this code."

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

async def drawio_agent(state: AgentState):
    """
    Agent that orchestrates Draw.io XML generation.
    """
    messages = state.get("messages", [])
    current_code = state.get("current_code", "")
    set_context(messages, current_code=current_code)
    
    # Bind tool
    llm_with_tools = llm.bind_tools(tools)
    
    # System message for orchestration
    system_prompt = SystemMessage(content="""You are an expert Draw.io Orchestrator.
    Your goal is to understand the user's request and call the `render_drawio_xml` tool with the appropriate instructions.
    
    Interpret the user's intent to create or modify a complex diagram. 
    Explain what you are going to draw, then call the tool.
    """)
    
    response = await llm_with_tools.ainvoke([system_prompt] + messages)
    
    return {"messages": [response]}
