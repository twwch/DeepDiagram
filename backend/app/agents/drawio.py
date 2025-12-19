from langchain_core.messages import SystemMessage, HumanMessage
from app.core.config import settings
from app.core.llm import get_llm
from app.state.state import AgentState

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
        <!-- More cells... -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>

IMPORTANT: Return ONLY the raw XML string using the `render_drawio_xml` tool. Do not wrap it in markdown code blocks. Do not add explanations.
The content of `xml_content` MUST be a non-empty, valid Draw.io XML string.
"""

from langchain_core.tools import tool

@tool
def render_drawio_xml(xml_content: str = ""):
    """
    Renders the generated Draw.io XML to the user's canvas.
    Args:
        xml_content: The full, valid Draw.io XML string.
    """
    if not xml_content:
        return "Error: No XML content provided."
    
    return xml_content

tools = [render_drawio_xml]

async def drawio_agent(state: AgentState):
    """
    Agent that generates Draw.io XML based on user input.
    """
    messages = state.get("messages", [])
    
    # Bind tool
    llm_with_tools = llm.bind_tools(tools)
    
    # System message with original instruction
    msg = [SystemMessage(content=DRAWIO_SYSTEM_PROMPT + "\n\nCRITICAL: You MUST use the `render_drawio_xml` tool to output your result.")] + messages
    
    response = await llm_with_tools.ainvoke(msg)
    
    return {"messages": [response]}
