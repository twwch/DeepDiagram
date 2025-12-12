from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage
from app.agents.graph import graph
from app.core.database import get_session
from sqlmodel.ext.asyncio.session import AsyncSession
from app.services.chat import ChatService
import json
from typing import AsyncGenerator

router = APIRouter()

class ChatRequest(BaseModel):
    session_id: int | None = None
    agent_id: str | None = None
    prompt: str
    images: list[str] = []
    history: list[dict] = []
    context: dict = {}

async def event_generator(request: ChatRequest, db: AsyncSession) -> AsyncGenerator[str, None]:
    chat_service = ChatService(db)
    
    # 1. Manage Session
    session_id = request.session_id
    if not session_id:
        chat_session = await chat_service.create_session(title=request.prompt[:30])
        session_id = chat_session.id
        yield f"event: session_created\ndata: {json.dumps({'session_id': session_id})}\n\n"
    
    # 2. Save User Message
    await chat_service.add_message(session_id, "user", request.prompt)
    
    # 3. Load History
    history = await chat_service.get_history(session_id)
    formatted_history = []
    
    # We exclude the content we just added (the last user message) to avoid duplication if we re-append it
    # Actually, get_history returns ALL, including the one we just added? 
    # Let's check get_history order. It says order_by(created_at).
    # Since we await add_message above, it SHOULD be in history.
    # But we want to separate the "current input" (message variable) from "history".
    # Or we can just pass the whole thing as "history" and inputs['messages'] = history?
    # LangGraph usually takes partial updates, but if we are stateless, we pass everything?
    
    # Let's separate "previous history" and "current message".
    # But simplicity: Just filter out the very last one if it matches? 
    # Or cleaner: Fetch history BEFORE adding current? No, get_history might render better?
    
    # Implementation:
    # 1. Fetch all history (including current)
    # 2. Convert to LC messages
    # 3. separate last one as 'current'? Or just pass all?
    # For router, passing all is fine.
    
    from langchain_core.messages import AIMessage, HumanMessage

    for msg in history:
        # Skip the current message we just added to properly treat it as "new input" if needed?
        # Actually safer to construct "previous history" + "current message request object".
        # But ChatMessage db object content is string.
        
        # If it's the message we just added ... skip?
        if msg.role == "user" and msg.content == request.prompt and msg == history[-1]: 
             continue

        if msg.role == "user":
            formatted_history.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            formatted_history.append(AIMessage(content=msg.content))
            
    # Current Message Construction (same as before)
    if request.images:
        content = [{"type": "text", "text": request.prompt}]
        for image_data in request.images:
            content.append({
                "type": "image_url",
                "image_url": {"url": image_data}
            })
        message = HumanMessage(content=content)
    else:
        message = HumanMessage(content=request.prompt)

    # Combine
    full_messages = formatted_history + [message]

    inputs = {
        "messages": full_messages,
        "current_code": request.context.get("current_code", ""),
    }
    
    full_response_content = ""

    try:
        # Stateless execution: No thread_id, so it runs fresh with provided history
        async for event in graph.astream_events(inputs, version="v1"):
            event_type = event["event"]
            data = event["data"]
            metadata = event.get("metadata", {})
            node_name = metadata.get("langgraph_node", "")
            
            # Filter internal Router LLM stream
            if node_name == "router":
                # We do NOT want to stream the router's internal thought process or result as content
                # But we DO want to capture its final output (handled below in on_chain_end)
                if event_type == "on_chain_end" and event["name"] == "router":
                     pass # Fall through to the handler below
                else: 
                     continue
            
            # Detect Router Output to notify frontend
            if event_type == "on_chain_end" and event["name"] == "router":
                # The router returns {"intent": "..."}
                output = data.get("output")
                if output and "intent" in output:
                    intent = output["intent"]
                    yield f"event: agent_selected\ndata: {json.dumps({'agent': intent})}\n\n"
            
            if event_type == "on_chat_model_stream":
                chunk = data.get("chunk")
                if chunk:
                     # 1. Content Stream (Thinking)
                    content = chunk.content
                    if content:
                         full_response_content += content
                         yield f"event: thought\ndata: {json.dumps({'content': content})}\n\n"
                    
                    # 2. Tool Args Stream (Generating)
                    if hasattr(chunk, 'tool_call_chunks'):
                        for tool_chunk in chunk.tool_call_chunks or []:
                            if tool_chunk and tool_chunk.get('args'):
                                args_chunk = tool_chunk['args']
                                yield f"event: tool_args_stream\ndata: {json.dumps({'args': args_chunk})}\n\n"

            elif event_type == "on_tool_start":
                yield f"event: tool_start\ndata: {json.dumps({'tool': event['name'], 'input': data.get('input')})}\n\n"

            elif event_type == "on_tool_end":
                output = data.get('output')
                if hasattr(output, 'content'):
                    output = output.content
                elif isinstance(output, (dict, list, str, int, float, bool, type(None))):
                    pass # Already serializable
                else:
                    output = str(output)
                yield f"event: tool_end\ndata: {json.dumps({'output': output})}\n\n"
        
        # 4. Save Assistant Message
        if full_response_content:
            await chat_service.add_message(session_id, "assistant", full_response_content)
            
    except Exception as e:
        yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"

@router.post("/chat/stream")
async def chat_stream(request: ChatRequest, db: AsyncSession = Depends(get_session)):
    return StreamingResponse(event_generator(request, db), media_type="text/event-stream")
