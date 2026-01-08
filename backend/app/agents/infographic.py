from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm
from app.core.context import set_context, get_messages, get_context

llm = get_llm()

INFOGRAPHIC_SYSTEM_PROMPT = """You are an expert Infographic Designer. Your goal is to generate professional AntV Infographic DSL syntax.

### AntV Infographic Syntax Rules
- Start with `infographic <template-name>`.
- Use two-space indentation for blocks (`data`, `theme`).
- Key-value pairs: `key value`.
- Arrays: Use `-` prefix.
- Icons: Use `<collection>/<icon-name>` (e.g., `mdi/rocket-launch`).
- Illustrations: Use filename from unDraw (e.g., `coding`).

### Available Templates (SELECT ONE)
**Process/Timeline (sequence-*)**
- sequence-zigzag-steps-underline-text, sequence-horizontal-zigzag-underline-text, sequence-horizontal-zigzag-simple-illus, sequence-circular-simple, sequence-mountain-underline-text, sequence-cylinders-3d-simple, sequence-color-snake-steps-horizontal-icon-line, sequence-pyramid-simple, sequence-roadmap-vertical-simple, sequence-roadmap-vertical-plain-text, sequence-zigzag-pucks-3d-simple, sequence-ascending-steps, sequence-ascending-stairs-3d-underline-text, sequence-snake-steps-compact-card, sequence-snake-steps-underline-text, sequence-snake-steps-simple, sequence-stairs-front-compact-card, sequence-stairs-front-pill-badge, sequence-timeline-simple, sequence-timeline-rounded-rect-node, sequence-timeline-simple-illus

**Comparison (compare-*)**
- compare-binary-horizontal-simple-fold, compare-hierarchy-left-right-circle-node-pill-badge, compare-swot, compare-binary-horizontal-badge-card-arrow, compare-binary-horizontal-underline-text-vs

**Charts (chart-*)**
- chart-column-simple, chart-bar-plain-text, chart-line-plain-text, chart-pie-plain-text, chart-pie-compact-card, chart-pie-donut-plain-text, chart-pie-donut-pill-badge, chart-wordcloud

**Lists/Grids (list-*)**
- list-grid-badge-card, list-grid-candy-card-lite, list-grid-ribbon-card, list-row-horizontal-icon-arrow, list-row-simple-illus, list-sector-plain-text, list-column-done-list, list-column-vertical-icon-arrow, list-column-simple-vertical-arrow, list-zigzag-down-compact-card, list-zigzag-down-simple, list-zigzag-up-compact-card, list-zigzag-up-simple

**Others**
- quadrant-quarter-simple-card, quadrant-quarter-circular, quadrant-simple-illus, relation-circle-icon-badge, relation-circle-circular-progress, hierarchy-tree-tech-style-capsule-item, hierarchy-tree-curved-line-rounded-rect-node, hierarchy-tree-tech-style-badge-card, hierarchy-structure

### Data Structure
- `data.title`: Main title.
- `data.desc`: Brief description.
- `data.items`: Array of items. Each item can have: `label`, `value` (number), `desc`, `icon`, `illus`, `children` (for trees/hierarchies).

### Theme Options
- `theme dark` or `theme hand-drawn`.
- Custom palette: `theme` block with `palette` array of hex colors.
- Stylize: `theme` -> `stylize rough` (hand-drawn style).

### Example
infographic list-row-horizontal-icon-arrow
data
  title Example Title
  items
    - label Step 1
      desc Description 1
      icon mdi/rocket
    - label Step 2
      desc Description 2
      icon mdi/check

### EXECUTION & ENRICHMENT RULES
- **PERSONA**: Act as a World-Class Infographic Designer. Don't just follow instructions—consult and improve.
- **MANDATORY ENRICHMENT**: If the user provides a simple list (e.g., "A, B, C"), expand it into a professional narrative. Add meaningful descriptions (`desc`) that explain the "Why" and "How".
- **DATA SYNTHESIS**: If the user doesn't provide numbers, INVENT realistic, data-driven values (`value`) that add credibility to the visualization.
- **ICONOGRAPHY**: Choose icons (`icon`) and illustrations (`illus`) that are metaphorically relevant, not just literal.
- **PROFESSIONAL TONE**: Use industry-standard terminology (e.g., instead of "Testing", use "Quality Assurance & UAT").
- **MANDATORY GENERATION**: You MUST generate at least one valid `infographic` block. 
- **LANGUAGE**: Match user's input language.
- **ONLY** output DSL. NO markdown boxes.
"""

@tool
async def create_infographic(instruction: str):
    """
    Renders an Infographic using AntV Infographic DSL based on instructions.
    Args:
        instruction: Detailed instruction on what infographic to create or modify.
    """
    messages = get_messages()
    context = get_context()
    current_code = context.get("current_code", "")
    
    # Call LLM to generate the Infographic DSL
    system_msg = INFOGRAPHIC_SYSTEM_PROMPT
    if current_code:
        system_msg += f"\n\n### CURRENT INFOGRAPHIC CODE\n```\n{current_code}\n```\nApply changes to this code."
        
    prompt = [SystemMessage(content=system_msg)] + messages
    if instruction:
        prompt.append(HumanMessage(content=f"Instruction: {instruction}"))
    
    # Using astream to allow the graph's astream_events to catch it
    full_content = ""
    async for chunk in llm.astream(prompt):
        content = chunk.content
        if content:
            full_content += content
    
    dsl_str = full_content
    
    # Robust Stripping: Extract from ``` blocks if present
    import re
    code_block_match = re.search(r'```(?:\w+)?\n([\s\S]*?)```', dsl_str)
    if code_block_match:
        dsl_str = code_block_match.group(1).strip()
    
    # Further ensure it starts with infographic keyword
    if 'infographic' in dsl_str and not dsl_str.strip().startswith('infographic'):
        infographic_match = re.search(r'infographic[\s\S]*', dsl_str)
        if infographic_match:
            dsl_str = infographic_match.group(0).strip()
    
    return dsl_str.strip()

tools = [create_infographic]
llm_with_tools = llm.bind_tools(tools)

async def infographic_agent_node(state: AgentState):
    messages = state['messages']
    
    # 动态从历史中提取最新的 infographic 代码（寻找最后一条 tool 消息且内容包含 infographic）
    current_code = ""
    for msg in reversed(messages):
        if msg.type == "tool" and msg.content:
            stripped = msg.content.strip()
            if stripped.startswith('infographic '):
                current_code = stripped
                break

    # Safety: Ensure no empty text content blocks reach the LLM
    for msg in messages:
        if hasattr(msg, 'content') and not msg.content:
            msg.content = "Generate an infographic"

    set_context(messages, current_code=current_code)
    
    system_prompt = SystemMessage(content="""You are an expert Infographic Orchestrator. 
    YOUR MISSION is to act as a Consultative Creative Director. When a user provides a request, don't just pass it through—EXPAND and ENRICH it.
    
    ### ORCHESTRATION RULES:
    1. **CREATIVE EXPANSION**: If the user says "draw a timeline for AI", don't just send that. Expand it to "draw a professional timeline of AI development from 1950 to 2024, including key milestones, Turing test, deep learning era, and GenAI explosion, with professional descriptions and icons".
    2. **MANDATORY TOOL CALL**: Always use `create_infographic`.
    3. **DATA SYNTHESIS**: If the user lacks data, conceptualize professional data points that make the infographic insightful.
    4. **METAPHORICAL THINKING**: Suggest templates that fit the "Vibe" of the content (e.g., roadmap for strategy, pyramid for hierarchy, high-contrast comparison for VS).
    
    ### LANGUAGE CONSISTENCY:
    - Respond and call tools in the SAME LANGUAGE as the user.
    
    ### PROACTIVENESS:
    - BE DECISIVE. If you see an opportunity to add a "Did you know?" section or a "Key Metric", include it in the tool instruction.
    """)
    
    full_response = None
    async for chunk in llm_with_tools.astream([system_prompt] + messages):
        if full_response is None:
            full_response = chunk
        else:
            full_response += chunk
    return {"messages": [full_response]}
