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
from app.core.logger import logger
from datetime import datetime, timezone

router = APIRouter()

class ChatRequest(BaseModel):
    session_id: int | None = None
    agent_id: str | None = None
    prompt: str
    images: list[str] = []
    history: list[dict] = []
    context: dict = {}
    parent_id: int | None = None
    is_retry: bool = False
    model_id: str | None = None
    api_key: str | None = None
    base_url: str | None = None

async def event_generator(request: ChatRequest, db: AsyncSession) -> AsyncGenerator[str, None]:
    chat_service = ChatService(db)
    
    # 1. Manage Session
    session_id = request.session_id
    if not session_id:
        chat_session = await chat_service.create_session(title=request.prompt[:30])
        session_id = chat_session.id
        yield f"event: session_created\ndata: {json.dumps({'session_id': session_id})}\n\n"
    
    # 2. Load History for context reconstruction
    all_history = await chat_service.get_history(session_id)
    history_map = {msg.id: msg for msg in all_history}

    # 3. Manage User Message
    last_user_msg_id = None
    if request.is_retry and request.parent_id:
        # If retrying, the parent_id IS the user message we are retrying
        last_user_msg_id = request.parent_id
    else:
        # Save new User Message
        user_msg = await chat_service.add_message(
            session_id, "user", request.prompt, 
            images=request.images,
            parent_id=request.parent_id
        )
        last_user_msg_id = user_msg.id
    
    yield f"event: message_created\ndata: {json.dumps({'id': last_user_msg_id, 'role': 'user', 'turn_index': (user_msg.turn_index if not request.is_retry else history_map[last_user_msg_id].turn_index) if last_user_msg_id in history_map or not request.is_retry else 0})}\n\n"
    
    # Group messages by turn_index and pick the latest of each
    turn_to_latest = {}
    for msg in all_history:
        t = msg.turn_index or 0
        if t not in turn_to_latest or msg.id > turn_to_latest[t].id:
            turn_to_latest[t] = msg

    # Identify the relevant turn range
    import time
    start_time = time.time()
    
    max_turn = -1
    if request.parent_id and (request.parent_id in history_map):
        max_turn = history_map[request.parent_id].turn_index
        if request.is_retry:
            max_turn -= 1

    branch_messages = []
    for t in range(max_turn + 1):
        if t in turn_to_latest:
            branch_messages.append(turn_to_latest[t])
    
    logger.info(f"⏱️ History assembly took {(time.time() - start_time) * 1000:.2f}ms, {len(branch_messages)} messages")
    
    from langchain_core.messages import AIMessage, HumanMessage

    formatted_history = []
    for msg in branch_messages:
        if msg.role == "user":
            if msg.images:
                human_content = [{"type": "text", "text": msg.content}]
                for img_url in msg.images:
                    human_content.append({"type": "image_url", "image_url": {"url": img_url}})
                formatted_history.append(HumanMessage(content=human_content))
            else:
                formatted_history.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            # Augment assistant message with tool inputs/outputs for better context
            content = msg.content or ""
            if msg.steps:
                execution_details = []
                last_tool_desc = ""
                agent_name = msg.agent or "general"
                
                # Format steps following user suggestion
                for s in msg.steps:
                    if s["type"] == "agent_select":
                        details_line = f"agentName: {s['name']}"
                        execution_details.append(details_line)
                    elif s["type"] == "tool_start":
                        last_tool_desc = f"toolName: {s['name']}, toolArgs: {s.get('content', '')}"
                    elif s["type"] == "tool_end" and last_tool_desc:
                        output = s.get('content', '')
                        # Combine start and end into a single execution line
                        execution_details.append(f"{last_tool_desc}, toolsOutput: {output}")
                        last_tool_desc = ""
                    elif s["type"] == "tool_end":
                         # Fallback if no tool_start found
                         output = s.get('content', '')
                         execution_details.append(f"toolName: {s['name']}, toolsOutput: {output}")
                
                if last_tool_desc:
                    execution_details.append(last_tool_desc)
                
                if execution_details:
                    trace_block = "### Execution Trace:\n" + "\n".join(execution_details)
                    if content:
                        content = f"{content}\n\n{trace_block}"
                    else:
                        content = trace_block
            
            formatted_history.append(AIMessage(content=content))
            
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

    # Combined state for persistence

    inputs = {
        "messages": full_messages,
        "model_config": {
            "model_id": request.model_id,
            "api_key": request.api_key,
            "base_url": request.base_url
        } if (request.model_id or request.api_key or request.base_url) else None
    }
    
    full_response_content = ""
    accumulated_steps = []
    selected_agent = None
    
    # Buffer to capture raw streamed content (including thoughts) for the current tool logic
    current_tool_content = ""
    
    logger.info(f"🚀 Starting LLM stream with {len(full_messages)} messages, is_retry={request.is_retry}")
    
    assistant_msg_saved = False
    
    try:
        try:
            # Stateless execution: No thread_id, so it runs fresh with provided history
            async for event in graph.astream_events(inputs, version="v1"):
                event_type = event["event"]
                data = event["data"]
                metadata = event.get("metadata", {})
                node_name = metadata.get("langgraph_node", "")
                
                # Filter internal Router LLM stream
                if node_name == "router":
                    # Detect Router Output to notify frontend
                    if event_type == "on_chain_end":
                        # The router returns {"intent": "..."}
                        output = data.get("output")
                        if output and "intent" in output:
                            intent = output["intent"]
                            selected_agent = intent
                            yield f"event: agent_selected\ndata: {json.dumps({'agent': intent, 'session_id': session_id})}\n\n"
                            
                            # Also add a pseudo-step for history
                            accumulated_steps.append({
                                "type": "agent_select",
                                "name": intent,
                                "status": "done",
                                "timestamp": int(datetime.utcnow().timestamp() * 1000)
                            })
                    continue # Skip all other events from "router" node

                if event_type == "on_chat_model_stream":
                    chunk = data.get("chunk")
                    if chunk:
                        content = chunk.content
                        if content:
                            is_tool_stream = node_name.endswith("_tools")
                            if is_tool_stream:
                                current_tool_content += content
                                yield f"event: tool_code\ndata: {json.dumps({'content': content, 'session_id': session_id})}\n\n"
                            else:
                                full_response_content += content
                                yield f"event: thought\ndata: {json.dumps({'content': content, 'session_id': session_id})}\n\n"
                        
                        if hasattr(chunk, 'tool_call_chunks'):
                            for tool_chunk in chunk.tool_call_chunks or []:
                                if tool_chunk and tool_chunk.get('args'):
                                    args_chunk = tool_chunk['args']
                                    yield f"event: tool_args_stream\ndata: {json.dumps({'args': args_chunk, 'session_id': session_id})}\n\n"

                elif event_type == "on_tool_start":
                    # Filter out internal LangChain/OpenAI calls that are mistakenly reported as tools in v1
                    if event["name"] == "ChatOpenAI":
                        continue
                        
                    # Add tool start step
                    tool_input = json.dumps(data.get("input"))
                    
                    # Reset buffer for new tool
                    current_tool_content = ""
                    
                    step = {
                        "type": "tool_start",
                        "name": event["name"],
                        "content": tool_input,
                        "status": "running",
                        "timestamp": int(datetime.utcnow().timestamp() * 1000)
                    }
                    accumulated_steps.append(step)
                    yield f"event: tool_start\ndata: {json.dumps({'tool': event['name'], 'input': data.get('input'), 'session_id': session_id})}\n\n"

                elif event_type == "on_tool_end":
                    output = data.get('output')
                    if hasattr(output, 'content'):
                        output = output.content
                    elif not isinstance(output, (dict, list, str, int, float, bool, type(None))):
                        output = str(output)
                    
                    # Update steps
                    if accumulated_steps:
                        # If we captured raw content (with thoughts), use it for persistence
                        # fallback to output (cleaned) if no stream was captured (e.g. cache or simple tool)
                        final_content = current_tool_content if current_tool_content else (output if isinstance(output, str) else json.dumps(output))
                        
                        accumulated_steps.append({
                            "type": "tool_end",
                            "name": event["name"],
                            "content": final_content,
                            "status": "done",
                            "timestamp": int(datetime.utcnow().timestamp() * 1000)
                        })
                        for s in reversed(accumulated_steps):
                            if s["type"] == "tool_start" and s["status"] == "running":
                                s["status"] = "done"
                                break

                    yield f"event: tool_end\ndata: {json.dumps({'output': output, 'session_id': session_id})}\n\n"
            
            # 4. Save Assistant Message (Normal completion)
            if full_response_content or accumulated_steps:
                assistant_msg = await chat_service.add_message(
                    session_id, "assistant", 
                    full_response_content, 
                    steps=accumulated_steps,
                    agent=selected_agent,
                    parent_id=last_user_msg_id
                )
                assistant_msg_saved = True
                yield f"event: message_created\ndata: {json.dumps({'id': assistant_msg.id, 'role': 'assistant', 'turn_index': assistant_msg.turn_index, 'session_id': session_id})}\n\n"
                
        finally:
            import asyncio
            # Robust Persistence: Ensure partial data is saved if connection was aborted
            if not assistant_msg_saved and (full_response_content or accumulated_steps):
                error_marker = "\n\n[Generation stopped by user/connection lost]"
                try:
                    # Use asyncio.shield to prevent the save operation from being cancelled
                    await asyncio.shield(chat_service.add_message(
                        session_id, "assistant", 
                        full_response_content + error_marker, 
                        steps=accumulated_steps,
                        agent=selected_agent,
                        parent_id=last_user_msg_id
                    ))
                    logger.info(f"💾 Robust Persistence: Saved partial assistant message for session {session_id}")
                except Exception as save_err:
                    logger.error(f"Failed to save partial message: {save_err}")
                
    except Exception as e:
        import traceback
        error_msg = str(e)
        logger.error(f"Error in chat stream: {error_msg}")
        logger.error(traceback.format_exc())
        yield f"event: error\ndata: {json.dumps({'message': error_msg})}\n\n"

@router.post("/chat/completions")
async def chat_completions(request: ChatRequest, db: AsyncSession = Depends(get_session)):
        
    return StreamingResponse(event_generator(request, db), media_type="text/event-stream")

@router.get("/sessions")
async def list_sessions(db: AsyncSession = Depends(get_session)):
    chat_service = ChatService(db)
    sessions = await chat_service.get_all_sessions()
    return sessions

@router.get("/sessions/{session_id}")
async def get_session_history(session_id: int, db: AsyncSession = Depends(get_session)):
    chat_service = ChatService(db)
    history = await chat_service.get_history(session_id)
    session = await chat_service.get_session(session_id)
    
    return {
        "messages": history,
        "session": session
    }

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, db: AsyncSession = Depends(get_session)):
    chat_service = ChatService(db)
    await chat_service.delete_session(session_id)
    return {"status": "success"}
