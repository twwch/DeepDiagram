from typing import Literal
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from app.state.state import AgentState
from app.core.config import settings
from app.core.llm import get_llm
import re

llm = get_llm() # Use a fast model for routing, or default to general config

def router_node(state: AgentState):
    """
    Analyzes the user's input and determines the appropriate agent.
    Supports explicit routing via @agent syntax.
    """
    messages = state['messages']
    current_code = state.get("current_code", "")
    last_message = messages[-1]
    
    # 0. Check for explicit @agent routing
    if isinstance(last_message, HumanMessage) and isinstance(last_message.content, str):
        content = last_message.content.lower().strip()
        
        # Explicit mapping
        mappings = {
            "@mindmap": "mindmap",
            "@flow": "flowchart",
            "@flowchart": "flowchart",
            "@mermaid": "mermaid",
            "@chart": "charts",
            "@charts": "charts",
            "@drawio": "drawio"
        }
        
        for keyword, intent_name in mappings.items():
            if keyword in content:
                # Remove the keyword from the message so the agent doesn't see it
                # We need to update the state with the cleaned message effectively
                # But state is immutable-ish in pass-by-value, so we modify the object referenced in list?
                # Actually LangGraph state updates merges. 
                # Ideally we shouldn't mutate message history for "routing" as it alters record.
                # BUT for the agent to behave correctly, prompt shouldn't contain "@flow".
                # Let's clean it for the downstream agent execution context if possible.
                # Since messages are objects, we can clone and modify or just accept it's in history.
                # For now, we just route. The agent typically ignores "@flow".
                print(f"DEBUG ROUTER | Explicit Routing Triggered: {keyword} -> {intent_name}")
                return {"intent": intent_name}

    # Determine active context from code
    active_context = "None"
    if current_code:
        if '"nodes":' in current_code and '"edges":' in current_code:
            active_context = "Flowchart (ReactFlow)"
        elif "series" in current_code and "type" in current_code:
             active_context = "Chart (ECharts)"
        elif "# " in current_code and ("- " in current_code or "##" in current_code):
             active_context = "Mindmap (Markdown)"

    agent_descriptions = {
        "mindmap": "Best for hierarchical structures, brainstorming, outlining ideas, and organizing concepts. Output: Markdown/Markmap.",
        "flow": "Best for standard Flowcharts ONLY. Output: React Flow JSON.",
        "mermaid": "Best for Sequence Diagrams, Class Diagrams, State Diagrams, Gantt Charts, Git Graphs, Entity Relationship Diagrams (ERD), and User Journeys. Use this if user explicitly asks for 'Mermaid'. Output: Mermaid Syntax.",
        "charts": "Best for quantitative data visualization (sales, stats, trends). Output: ECharts (Bar, Line, Pie, etc.).",
        "drawio": "Best for professional, heavy-duty architecture diagrams, cloud infrastructure, and detailed UML. Use this ONLY if user explicitly asks for 'Draw.io' or complex 'architecture'.",
        "general": "Handles greetings, questions unrelated to diagramming, or requests that don't fit other categories."
    }

    descriptions_text = "\n".join([f"- '{key}': {desc}" for key, desc in agent_descriptions.items()])

    system_prompt = f"""You are an Intent Router. 
    Analyze the user's request and the conversation history to classify the intent into one of the categories.
    
    CURRENT VISUAL CONTEXT: {active_context}
    (This is what the user is currently looking at on the screen)

    Context Awareness Rules:
    1. IF "CURRENT VISUAL CONTEXT" is "Chart" AND user asks to "add", "remove", "change", "update" numbers or items -> YOU MUST ROUTE TO 'charts'.
    2. IF "CURRENT VISUAL CONTEXT" is "Mindmap" AND user asks to "add node", "expand" -> YOU MUST ROUTE TO 'mindmap'.
    3. IF "CURRENT VISUAL CONTEXT" is "Flowchart" AND user asks to "change shape", "connect" -> YOU MUST ROUTE TO 'flow'.
    4. IF user mentions "Mermaid" OR asks for "Sequence Diagram", "Class Diagram", "Gantt" -> YOU MUST ROUTE TO 'mermaid'.
    
    Agent Capabilities:
    {descriptions_text}
    
    Output ONLY the category name.
    """
    
    # Helper to safely summarize PREVIOUS message content for history (concise text only)
    def summarize_history_content(content):
        if isinstance(content, list):
            text_parts = []
            for item in content:
                if isinstance(item, dict):
                    if item.get("type") == "text":
                        text_parts.append(item.get("text", ""))
                    elif item.get("type") == "image_url":
                        text_parts.append("[User uploaded an image]")
            return " ".join(text_parts)
        return str(content)

    # Summarize history except for the very last message
    conversation_text = ""
    for msg in messages[:-1]:
        role = "User" if msg.type == "human" else "Assistant"
        content_summary = summarize_history_content(msg.content)
        conversation_text += f"{role}: {content_summary}\n"
    
    # Final Routing Prompt
    routing_instructions = f"""{system_prompt}
    
    CONVERSATION HISTORY (Summarized):
    {conversation_text}
    
    Please analyze the user's latest message (which may include an image) and classify the intent.
    """
    
    # We pass the instruction as a SystemMessage and the ACTUAL last message as is.
    # This ensures that if the last message has image_url, the LLM will see it as an image, NOT as long text tokens.
    msgs_to_invoke = [
        SystemMessage(content=routing_instructions),
        messages[-1] # The real last message with multimodal content
    ]
    
    response = llm.invoke(msgs_to_invoke)
    intent = response.content.strip().lower()
    
    print(f"DEBUG ROUTER | Context: {active_context} | Raw Intent: {intent}")

    if "mindmap" in intent:
        return {"intent": "mindmap"}
    elif "flow" in intent:
        return {"intent": "flowchart"}
    elif "mermaid" in intent:
        return {"intent": "mermaid"}
    elif "chart" in intent:
        return {"intent": "charts"}
    elif "drawio" in intent or "draw.io" in intent or "architecture" in intent or "network" in intent:
        return {"intent": "drawio"} 
    elif "general" in intent:
        return {"intent": "general"}
    else:
        return {"intent": "general"} # Default to general for safety

def route_decision(state: AgentState) -> Literal["mindmap_agent", "flow_agent", "mermaid_agent", "charts_agent", "drawio_agent", "general_agent"]:
    intent = state.get("intent")
    if intent == "mindmap":
        return "mindmap_agent"
    elif intent == "flowchart":
        return "flow_agent"
    elif intent == "mermaid":
        return "mermaid_agent"
    elif intent == "charts":
        return "charts_agent"
    elif intent == "drawio":
        return "drawio_agent"
    elif intent == "general":
        return "general_agent"
    return "general_agent"
