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
    last_message = messages[-1]
    
    # 0. Check for explicit @agent routing
    explicit_intent = None
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
                explicit_intent = intent_name
                # Clean the keyword from the message so the agent doesn't see it
                # We update the original message object content for the downstream agent
                cleaned = re.sub(rf"{keyword}\s*", "", last_message.content, flags=re.IGNORECASE).strip()
                if not cleaned:
                    cleaned = f"Generate a default {intent_name} diagram."
                last_message.content = cleaned
                print(f"DEBUG ROUTER | Explicit Routing Triggered: {keyword} -> {intent_name} | Cleaned: {last_message.content}")
                break

    agent_descriptions = {
        "mindmap": "Best for hierarchical structures, brainstorming, outlining ideas, and organizing concepts. Output: Markdown/Markmap.",
        "flow": "Best for standard Flowcharts ONLY. Output: React Flow JSON.",
        "mermaid": "Best for Sequence Diagrams, Class Diagrams, State Diagrams, Gantt Charts, Git Graphs, Entity Relationship Diagrams (ERD), and User Journeys. Use this if user explicitly asks for 'Mermaid'. Output: Mermaid Syntax.",
        "charts": "Best for quantitative data visualization (sales, stats, trends). Output: ECharts (Bar, Line, Pie, etc.).",
        "drawio": "Best for professional, heavy-duty architecture diagrams, cloud infrastructure, and detailed UML. Use this ONLY if user explicitly asks for 'Draw.io' or complex 'architecture'.",
        "general": "Handles greetings, questions unrelated to diagramming, or requests that don't fit other categories."
    }
    
    # Identify Full Agent Execution History
    execution_history = []
    for msg in messages[:-1]:
        if msg.type == "ai" and "### Execution Trace:" in str(msg.content):
            # Extract the whole trace block for the router
            parts = str(msg.content).split("### Execution Trace:")
            if len(parts) > 1:
                trace = parts[1].strip()
                # Safety truncate each trace block
                if len(trace) > 1000:
                    trace = trace[:1000] + "... [TRUNCATED]"
                execution_history.append(trace)
    
    execution_history_text = "\n---\n".join(execution_history) if execution_history else "None"
    
    # Identify Last Active Agent
    last_active_agent = "None"
    for msg in reversed(messages[:-1]):
        if msg.type == "ai" and "agentName:" in str(msg.content):
            match = re.search(r"agentName:\s*(\w+)", str(msg.content))
            if match:
                last_active_agent = match.group(1)
                break
    
    # If we have an explicit intent, we can skip the LLM call but we STILL want to return 
    # the intent inside the unified flow for consistency.
    if explicit_intent:
        print(f"DEBUG ROUTER | Proceeding with Explicit Intent: {explicit_intent}")
        return {"intent": explicit_intent}

    descriptions_text = "\n".join([f"- '{key}': {desc}" for key, desc in agent_descriptions.items()])

    system_prompt = f"""You are an intelligent DeepDiagram Router.
    Your goal is to analyze the user's intent and route to the most appropriate diagram agent.
    
    AGENT EXECUTION HISTORY (Agents + Tools): 
    {execution_history_text}
    
    LAST ACTIVE AGENT: {last_active_agent}
    
    (If the user's request is a follow-up, refinement, or "fix" for the previous result, FAVOUR the {last_active_agent} unless they explicitly ask for a different tool or the topic has fundamentally shifted)

    Context Awareness Rules:
    1. IF "CURRENT VISUAL CONTEXT" is "Chart" AND user asks to "add", "remove", "change", "update" numbers or items -> YOU MUST ROUTE TO 'charts'.
    2. IF "CURRENT VISUAL CONTEXT" is "Mindmap" AND user asks to "add node", "expand" -> YOU MUST ROUTE TO 'mindmap'.
    3. IF "CURRENT VISUAL CONTEXT" is "Flowchart" AND user asks to "change shape", "connect" -> YOU MUST ROUTE TO 'flow'.
    4. IF "CURRENT VISUAL CONTEXT" is "Mermaid Diagram" AND user asks to "add participant", "change flow" -> YOU MUST ROUTE TO 'mermaid'.
    5. IF "CURRENT VISUAL CONTEXT" is "Draw.io Architecture" AND user asks to "add cloud component", "change layout" -> YOU MUST ROUTE TO 'drawio'.
    6. IF user mentions "Mermaid" OR asks for "Sequence Diagram", "Class Diagram", "Gantt" -> YOU MUST ROUTE TO 'mermaid'.
    
    Agent Capabilities:
    {descriptions_text}
    
    Output ONLY keywords: 'mindmap', 'flow', 'mermaid', 'charts', 'drawio', 'general'.
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
            text = " ".join(text_parts)
        else:
            text = str(content)
        
        # Safety truncation for routing efficiency
        if len(text) > 1000:
            return text[:1000] + "... [TRUNCATED]"
        return text

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
    Respond in the same language as the user's input (e.g., if the user asks in Chinese, respond in Chinese).
    """
    
    # We pass the instruction as a SystemMessage and the ACTUAL last message as is.
    # This ensures that if the last message has image_url, the LLM will see it as an image, NOT as long text tokens.
    msgs_to_invoke = [
        SystemMessage(content=routing_instructions),
        messages[-1] # The real last message with multimodal content
    ]
    
    response = llm.invoke(msgs_to_invoke)
    intent = response.content.strip().lower()
    
    print(f"DEBUG ROUTER | Last Agent: {last_active_agent} | Raw Intent: {intent}")

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
