from typing import Literal
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm

llm = get_llm(model_name="claude-sonnet-3.7") # Use a fast model for routing, or default to general config

def router_node(state: AgentState):
    """
    Analyzes the user's input and determines the appropriate agent.
    """
    messages = state['messages']
    current_code = state.get("current_code", "")
    
    # Determine active context from code
    active_context = "None"
    if current_code:
        if "mermaid" in current_code or "graph TD" in current_code or "flowchart" in current_code:
            active_context = "Flowchart (Mermaid)"
        elif "series" in current_code and "type" in current_code:
             active_context = "Chart (ECharts)"
        elif "# " in current_code and ("- " in current_code or "##" in current_code):
             active_context = "Mindmap (Markdown)"

    system_prompt = f"""You are an Intent Router. 
    Analyze the user's request and the conversation history to classify the intent into one of the categories.
    
    CURRENT VISUAL CONTEXT: {active_context}
    (This is what the user is currently looking at on the screen)

    Context Awareness Rules:
    1. IF "CURRENT VISUAL CONTEXT" is "Chart" AND user asks to "add", "remove", "change", "update" numbers or items -> YOU MUST ROUTE TO 'charts'.
    2. IF "CURRENT VISUAL CONTEXT" is "Mindmap" AND user asks to "add node", "expand" -> YOU MUST ROUTE TO 'mindmap'.
    3. IF "CURRENT VISUAL CONTEXT" is "Flowchart" AND user asks to "change shape", "connect" -> YOU MUST ROUTE TO 'flow'.
    
    Categories:
    - 'mindmap': for creating NEW mind maps or MODIFYING existing ones.
    - 'flow': for creating NEW flowcharts or MODIFYING existing ones.
    - 'charts': for creating NEW data visualizations or MODIFYING existing ones.
    - 'general': only for completely unrelated topics (e.g. "Write a poem", "Hello").
    
    Output ONLY the category name.
    """
    
    # Serialize history to text to prevent the LLM from entering "Chat Mode"
    conversation_text = ""
    for msg in messages:
        role = "User" if msg.type == "human" else "Assistant"
        conversation_text += f"{role}: {msg.content}\n"
    
    # We pass the full history so the router can see previous context
    # Use a single HumanMessage containing instructions + history to force analysis mode
    final_prompt = f"{system_prompt}\n\nCONVERSATION HISTORY:\n{conversation_text}\n\nUser's Last Request: {messages[-1].content}\n\nCLASSIFICATION:"
    
    response = llm.invoke([HumanMessage(content=final_prompt)])
    intent = response.content.strip().lower()
    
    print(f"DEBUG ROUTER | Context: {active_context} | Raw Intent: {intent}")

    # Heuristic Fallback: If router says "general" but we have an active diagram and modification keywords
    if "general" in intent and active_context != "None":
        last_msg = messages[-1].content.lower()
        keywords = ["add", "remove", "change", "update", "modify", "delete", "insert", "+", "-", "plus", "minus", "reduce", "increase", "set", "make"]
        
        if any(k in last_msg for k in keywords):
            print(f"DEBUG ROUTER | Overriding 'general' to Active Context based on keywords")
            if "Chart" in active_context:
                intent = "charts"
            elif "Flowchart" in active_context:
                intent = "flow"
            elif "Mindmap" in active_context:
                intent = "mindmap"

    if "mindmap" in intent:
        return {"intent": "mindmap"}
    elif "flow" in intent:
        return {"intent": "flow"}
    elif "chart" in intent:
        return {"intent": "charts"}
    elif "general" in intent:
        return {"intent": "general"}
    else:
        return {"intent": "general"} # Default to general for safety

def route_decision(state: AgentState) -> Literal["mindmap_agent", "flow_agent", "charts_agent", "general_agent"]:
    intent = state.get("intent")
    if intent == "mindmap":
        return "mindmap_agent"
    elif intent == "flow":
        return "flow_agent"
    elif intent == "charts":
        return "charts_agent"
    elif intent == "general":
        return "general_agent"
    return "general_agent"
