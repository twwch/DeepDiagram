from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm
from app.core.context import set_context, get_messages, get_context

llm = get_llm()

MERMAID_SYSTEM_PROMPT = """You are an expert Mermaid Diagram Generator.
Your goal is to generate technical diagrams using Mermaid syntax.

### SUPPORTED DIAGRAM TYPES
- Sequence Diagrams (sequenceDiagram)
- Class Diagrams (classDiagram)
- State Diagrams (stateDiagram-v2)
- Entity Relationship Diagrams (erDiagram)
- Gantt Charts (gantt)
- User Journey (journey)
- Git Graph (gitGraph)
- Pie Chart (pie) - prefer Charts Agent for complex data, but simple pies are okay here.

Note: Flowcharts are handled by a separate agent, but you can generate them if explicitly requested as "Mermaid flowchart".

### DESIGN PRINCIPLES (CRITICAL)
1. **CONTENT RICHNESS**: If the user request is simple, expand it into a professional, production-ready diagram. Add detailed participants, notes, and edge cases to Sequence Diagrams. For Gantt charts, add more phases and milestones.
2. **FORMAT**: Return the raw Mermaid syntax string. Do not wrap the code in markdown blocks.
3. **LANGUAGE**: Use the user's language for all diagram labels, notes, participant names, and annotations.

### EXAMPLES

**Sequence Diagram:**
sequenceDiagram
    Alice->>John: Hello John, how are you?
    John-->>Alice: Great!
    
**Class Diagram:**
classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal : +int age
    Animal : +String gender
"""

@tool
async def create_mermaid(instruction: str):
    """
    Renders a diagram using Mermaid syntax based on instructions.
    Args:
        instruction: Detailed instruction on what diagram to create or modify.
    """
    messages = get_messages()
    context = get_context()
    current_code = context.get("current_code", "")
    
    # Call LLM to generate the Mermaid code
    system_msg = MERMAID_SYSTEM_PROMPT
    if current_code:
        system_msg += f"\n\n### CURRENT DIAGRAM CODE\n```mermaid\n{current_code}\n```\nApply changes to this code."

    prompt = [SystemMessage(content=system_msg)] + messages
    if instruction:
        prompt.append(HumanMessage(content=f"Instruction: {instruction}"))
    
    response = await llm.ainvoke(prompt)
    code = response.content
    
    # Robustly strip markdown code blocks
    import re
    cleaned_code = re.sub(r'^```[a-zA-Z]*\n', '', code)
    cleaned_code = re.sub(r'\n```$', '', cleaned_code)
    return cleaned_code.strip()

tools = [create_mermaid]
llm_with_tools = llm.bind_tools(tools)

async def mermaid_agent_node(state: AgentState):
    messages = state['messages']
    
    # 动态从历史中提取最新的 mermaid 代码（寻找最后一条 tool 消息且内容包含 graph/sequenceDiagram 等）
    current_code = ""
    for msg in reversed(messages):
        if msg.type == "tool" and msg.content:
            stripped = msg.content.strip()
            if any(stripped.startswith(k) for k in ["graph", "sequenceDiagram", "gantt", "classDiagram", "stateDiagram", "pie"]):
                current_code = stripped
                break

    # Safety: Ensure no empty text content blocks reach the LLM
    for msg in messages:
        if hasattr(msg, 'content') and not msg.content:
            msg.content = "Generate a mermaid diagram"

    set_context(messages, current_code=current_code)
    
    system_prompt = SystemMessage(content="""You are an expert Mermaid Orchestrator.
    Your goal is to understand the user's request and call the `create_mermaid` tool with the appropriate instructions.
    
    ### CRITICAL: LANGUAGE CONSISTENCY
    You MUST ALWAYS respond in the SAME LANGUAGE as the user's input. If the user writes in Chinese, respond in Chinese. If the user writes in English, respond in English. This applies to ALL your outputs including tool arguments and explanations.

    ### CRITICAL RULE:
    - YOU MUST USE THE `create_mermaid` TOOL TO GENERATE OR MODIFY DIAGRAMS.
    - NEVER respond with raw Mermaid syntax in the chat body. 
    - If the user wants a diagram, YOUR ONLY JOB is to call the tool.
    
    ### PROACTIVENESS PRINCIPLES:
    1. **BE DECISIVE**: If the user provides a topic (e.g., "Architecture of AWS"), call the tool IMMEDIATELY.
    2. **STRUCTURE DATA**: If no structure is provided, create a professional diagram yourself.
    3. **AVOID HESITATION**: DO NOT ask for steps or boxes. Just generate a rich mermaid diagram.
    """)
    
    response = await llm_with_tools.ainvoke([system_prompt] + messages)
    return {"messages": [response]}
