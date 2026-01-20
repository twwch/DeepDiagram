from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage
from app.agents.graph import graph
from app.core.database import get_session
from sqlmodel.ext.asyncio.session import AsyncSession
from app.services.chat import ChatService
import json
import re
from typing import AsyncGenerator
from app.core.logger import logger
from datetime import datetime

router = APIRouter()

class ChatRequest(BaseModel):
    session_id: int | None = None
    agent_id: str | None = None
    prompt: str
    images: list[str] = []
    files: list[dict] = []
    history: list[dict] = []
    context: dict = {}
    parent_id: int | None = None
    is_retry: bool = False
    concurrency: int = 3
    model_id: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    user_id: str | None = None  # For data isolation


class StreamingTagParser:
    """Parse streaming output with <design_concept> and <code> XML-style tags.

    State transitions: INIT -> DESIGN_CONCEPT -> CODE -> DONE
    """

    # States
    STATE_INIT = 0
    STATE_DESIGN_CONCEPT = 1
    STATE_CODE = 2
    STATE_DONE = 3

    def __init__(self):
        self.buffer = ""
        self.state = self.STATE_INIT
        self.design_concept = ""
        self.code = ""
        self.last_dc_len = 0
        self.last_code_len = 0

    def feed(self, chunk: str) -> list:
        """Feed a chunk and return events based on current state."""
        self.buffer += chunk
        events = []

        # Check for tag positions
        dc_start_tag = '<design_concept>'
        dc_end_tag = '</design_concept>'
        code_start_tag = '<code>'
        code_end_tag = '</code>'

        dc_start_pos = self.buffer.find(dc_start_tag)
        dc_end_pos = self.buffer.find(dc_end_tag)
        code_start_pos = self.buffer.find(code_start_tag)
        code_end_pos = self.buffer.find(code_end_tag)

        # State: INIT -> waiting for design_concept tag
        if self.state == self.STATE_INIT:
            if dc_start_pos != -1:
                self.state = self.STATE_DESIGN_CONCEPT
                events.append(('design_concept_start', '', True))

        # State: DESIGN_CONCEPT -> streaming design_concept content
        if self.state == self.STATE_DESIGN_CONCEPT:
            if dc_start_pos != -1:
                content_start = dc_start_pos + len(dc_start_tag)
                if dc_end_pos != -1:
                    # design_concept is complete
                    dc_content = self.buffer[content_start:dc_end_pos].strip()
                    if len(dc_content) > self.last_dc_len:
                        new_content = dc_content[self.last_dc_len:]
                        self.last_dc_len = len(dc_content)
                        self.design_concept = dc_content
                        events.append(('design_concept', new_content, False))
                    events.append(('design_concept_end', '', False))
                    self.state = self.STATE_CODE
                    if code_start_pos != -1:
                        events.append(('code_start', '', True))
                else:
                    # Still streaming design_concept
                    dc_content = self.buffer[content_start:].strip()
                    if len(dc_content) > self.last_dc_len:
                        new_content = dc_content[self.last_dc_len:]
                        self.last_dc_len = len(dc_content)
                        self.design_concept = dc_content
                        events.append(('design_concept', new_content, True))

        # State: CODE -> streaming code content
        if self.state == self.STATE_CODE:
            if code_start_pos != -1:
                content_start = code_start_pos + len(code_start_tag)
                if code_end_pos != -1:
                    # code is complete
                    code_content = self.buffer[content_start:code_end_pos].strip()
                    if len(code_content) > self.last_code_len:
                        new_content = code_content[self.last_code_len:]
                        self.last_code_len = len(code_content)
                        self.code = code_content
                        events.append(('code', new_content, False))
                    events.append(('code_end', '', False))
                    self.state = self.STATE_DONE
                else:
                    # Still streaming code
                    code_content = self.buffer[content_start:].strip()
                    if len(code_content) > self.last_code_len:
                        new_content = code_content[self.last_code_len:]
                        self.last_code_len = len(code_content)
                        self.code = code_content
                        events.append(('code', new_content, True))

        return events

    def finalize(self) -> list:
        """Finalize parsing and emit any remaining events."""
        events = []

        dc_start_tag = '<design_concept>'
        dc_end_tag = '</design_concept>'
        code_start_tag = '<code>'
        code_end_tag = '</code>'

        # If still in design_concept state, close it
        if self.state == self.STATE_DESIGN_CONCEPT:
            dc_start_pos = self.buffer.find(dc_start_tag)
            dc_end_pos = self.buffer.find(dc_end_tag)
            if dc_start_pos != -1:
                content_start = dc_start_pos + len(dc_start_tag)
                content_end = dc_end_pos if dc_end_pos != -1 else len(self.buffer)
                dc_content = self.buffer[content_start:content_end].strip()
                if len(dc_content) > self.last_dc_len:
                    new_content = dc_content[self.last_dc_len:]
                    self.design_concept = dc_content
                    events.append(('design_concept', new_content, False))
            events.append(('design_concept_end', '', False))
            self.state = self.STATE_CODE
            if code_start_tag in self.buffer:
                events.append(('code_start', '', False))

        # If in code state, finalize code
        if self.state == self.STATE_CODE:
            code_start_pos = self.buffer.find(code_start_tag)
            code_end_pos = self.buffer.find(code_end_tag)
            if code_start_pos != -1:
                content_start = code_start_pos + len(code_start_tag)
                content_end = code_end_pos if code_end_pos != -1 else len(self.buffer)
                code_content = self.buffer[content_start:content_end].strip()
                if len(code_content) > self.last_code_len:
                    new_content = code_content[self.last_code_len:]
                    self.code = code_content
                    events.append(('code', new_content, False))
            events.append(('code_end', '', False))
            self.state = self.STATE_DONE

        return events


# Keep old name as alias for compatibility
StreamingJsonParser = StreamingTagParser


def extract_tag_fields(content: str) -> tuple[str, str]:
    """Extract design_concept and code from XML-style tagged response."""
    design_concept = ""
    code = ""

    # Remove thinking tags if present
    content = re.sub(r'<think>[\s\S]*?</think>', '', content, flags=re.DOTALL)

    # Extract design_concept
    dc_match = re.search(r'<design_concept>\s*([\s\S]*?)\s*</design_concept>', content)
    if dc_match:
        design_concept = dc_match.group(1).strip()

    # Extract code
    code_match = re.search(r'<code>\s*([\s\S]*?)\s*</code>', content)
    if code_match:
        code = code_match.group(1).strip()

    return design_concept, code


# Keep old name as alias for compatibility
extract_json_fields = extract_tag_fields


async def event_generator(request: ChatRequest, db: AsyncSession) -> AsyncGenerator[str, None]:
    chat_service = ChatService(db, user_id=request.user_id)

    # 1. Manage Session
    session_id = request.session_id
    if not session_id:
        chat_session = await chat_service.create_session(title=request.prompt[:30])
        session_id = chat_session.id
        yield f"event: session_created\ndata: {json.dumps({'session_id': session_id})}\n\n"
    else:
        # Verify session ownership
        if not await chat_service.verify_session_ownership(session_id):
            yield f"event: error\ndata: {json.dumps({'message': 'Session not found or access denied'})}\n\n"
            return

    # 2. Load History for context reconstruction
    all_history = await chat_service.get_history(session_id)
    history_map = {msg.id: msg for msg in all_history}

    # 3. Manage User Message
    last_user_msg_id = None
    user_msg = None
    if request.is_retry and request.parent_id:
        # If retrying, the parent_id IS the user message we are retrying
        last_user_msg_id = request.parent_id
    else:
        # Save new User Message
        user_msg = await chat_service.add_message(
            session_id, "user", request.prompt,
            images=request.images,
            files=request.files,
            parent_id=request.parent_id
        )
        last_user_msg_id = user_msg.id

    turn_index = 0
    if user_msg:
        turn_index = user_msg.turn_index
    elif last_user_msg_id in history_map:
        turn_index = history_map[last_user_msg_id].turn_index

    yield f"event: message_created\ndata: {json.dumps({'id': last_user_msg_id, 'role': 'user', 'turn_index': turn_index})}\n\n"

    # 4. Handle Document Parsing & Extraction
    doc_context = ""
    accumulated_steps = []

    # Check if we can reuse existing context (Retry case)
    if request.is_retry and last_user_msg_id in history_map:
        existing_msg = history_map[last_user_msg_id]
        if existing_msg.file_context:
            doc_context = existing_msg.file_context
            yield f"event: status\ndata: {json.dumps({'content': 'Reusing previous document analysis...'})}\n\n"
            logger.info(f"♻️ Reusing existing file context for message {last_user_msg_id}")

    if not doc_context and request.files:
        from app.services.file_service import FileParsingService, LLMExtractionService
        parsing_service = FileParsingService()
        extraction_service = LLMExtractionService({
            "model_id": request.model_id,
            "api_key": request.api_key,
            "base_url": request.base_url
        })

        all_parsed_text = ""
        for file_info in request.files:
            filename = file_info.get("name", "document")
            yield f"event: status\ndata: {json.dumps({'content': f'Parsing {filename}...'})}\n\n"
            parsed_text = await parsing_service.parse_file(filename, file_info.get("data", ""))
            all_parsed_text += f"\n\n--- Document: {filename} ---\n{parsed_text}"

        if all_parsed_text.strip():
            yield f"event: status\ndata: {json.dumps({'content': 'Extracting core data from documents...'})}\n\n"

            # Use dedicated events for document analysis to separate from tool flow
            yield f"event: doc_analysis_start\ndata: {json.dumps({'session_id': session_id})}\n\n"

            analysis_buffers = {}

            async for result in extraction_service.extract_and_summarize(
                all_parsed_text,
                concurrency=request.concurrency,
                status_callback=None
            ):
                chunk_idx = result["index"]
                content = result.get("content", "")
                status = result.get("status", "running")

                # Initialize buffer if needed
                if chunk_idx not in analysis_buffers:
                    analysis_buffers[chunk_idx] = ""

                if status == "running":
                    analysis_buffers[chunk_idx] += content
                    yield f"event: doc_analysis_chunk\ndata: {json.dumps({'content': content, 'index': chunk_idx, 'status': 'running', 'session_id': session_id})}\n\n"

                elif status in ["done", "error"]:
                    # Final content for this block
                    final_text = analysis_buffers[chunk_idx]

                    if chunk_idx == -1:
                        doc_context = final_text
                        step_name = "doc_analysis_synthesis"
                    else:
                        step_name = f"doc_analysis_chunk_{chunk_idx}"

                    # Deduplication: Check if we already have a step for this index
                    existing_step = False
                    for step in accumulated_steps:
                        if step["type"] == "doc_analysis":
                            try:
                                content_json = json.loads(step["content"])
                                if content_json.get("index") == chunk_idx:
                                    existing_step = True
                                    break
                            except:
                                pass

                    if not existing_step:
                        accumulated_steps.append({
                            "type": "doc_analysis",
                            "name": step_name,
                            "content": json.dumps({"index": chunk_idx, "content": final_text}),
                            "status": "done",
                            "start_time": datetime.utcnow().timestamp(),
                            "end_time": datetime.utcnow().timestamp()
                        })

                    # Send final empty chunk to signal done state to frontend
                    yield f"event: doc_analysis_chunk\ndata: {json.dumps({'content': '', 'index': chunk_idx, 'status': 'done', 'session_id': session_id})}\n\n"

            yield f"event: doc_analysis_end\ndata: {json.dumps({'content': doc_context, 'session_id': session_id})}\n\n"

            yield f"event: status\ndata: {json.dumps({'content': 'Document processing complete.'})}\n\n"

            # Persist newly generated context to the user message
            if doc_context:
                await chat_service.update_message(last_user_msg_id, file_context=doc_context)

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
    current_prompt = request.prompt
    if doc_context:
        current_prompt = f"Document Context:\n{doc_context}\n\nUser Question:\n{current_prompt}"

    if request.images:
        content = [{"type": "text", "text": current_prompt}]
        for image_data in request.images:
            content.append({
                "type": "image_url",
                "image_url": {"url": image_data}
            })
        message = HumanMessage(content=content)
    else:
        message = HumanMessage(content=current_prompt)

    # Combine
    full_messages = formatted_history + [message]

    inputs = {
        "messages": full_messages,
        "model_config": {
            "model_id": request.model_id,
            "api_key": request.api_key,
            "base_url": request.base_url
        } if (request.model_id or request.api_key or request.base_url) else None
    }

    full_response_content = ""
    selected_agent = None

    # JSON streaming parser for new agent format
    json_parser = StreamingJsonParser()
    design_concept_started = False
    code_started = False

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
                    continue  # Skip all other events from "router" node

                # Detect Agent End
                if node_name.endswith("_agent") and event_type == "on_chain_end":
                    accumulated_steps.append({
                        "type": "agent_end",
                        "name": node_name,
                        "status": "done",
                        "timestamp": int(datetime.utcnow().timestamp() * 1000)
                    })
                    yield f"event: agent_end\ndata: {json.dumps({'agent': node_name, 'session_id': session_id})}\n\n"

                if event_type == "on_chat_model_stream":
                    chunk = data.get("chunk")
                    if chunk:
                        content = chunk.content
                        if content:
                            full_response_content += content

                            # For non-general agents, parse the JSON stream
                            if selected_agent and selected_agent != "general":
                                # Parse the streaming JSON
                                events = json_parser.feed(content)
                                for evt_type, evt_content, is_streaming in events:
                                    if evt_type == 'design_concept_start':
                                        if not design_concept_started:
                                            design_concept_started = True
                                            # Add design_concept step to accumulated_steps
                                            accumulated_steps.append({
                                                "type": "design_concept",
                                                "name": "Design Concept",
                                                "content": "",
                                                "status": "running",
                                                "timestamp": int(datetime.utcnow().timestamp() * 1000)
                                            })
                                            yield f"event: design_concept_start\ndata: {json.dumps({'session_id': session_id})}\n\n"
                                    elif evt_type == 'design_concept':
                                        if evt_content:
                                            yield f"event: design_concept\ndata: {json.dumps({'content': evt_content, 'session_id': session_id})}\n\n"
                                    elif evt_type == 'design_concept_end':
                                        # Update design_concept step with final content
                                        for step in accumulated_steps:
                                            if step.get("type") == "design_concept" and step.get("status") == "running":
                                                step["content"] = json_parser.design_concept
                                                step["status"] = "done"
                                                break
                                        yield f"event: design_concept_end\ndata: {json.dumps({'session_id': session_id})}\n\n"
                                    elif evt_type == 'code_start':
                                        if not code_started:
                                            code_started = True
                                            # Signal start of code (equivalent to tool_start)
                                            accumulated_steps.append({
                                                "type": "tool_start",
                                                "name": f"create_{selected_agent}",
                                                "content": "{}",
                                                "status": "done",
                                                "timestamp": int(datetime.utcnow().timestamp() * 1000)
                                            })
                                            yield f"event: tool_start\ndata: {json.dumps({'tool': f'create_{selected_agent}', 'input': {}, 'session_id': session_id})}\n\n"
                                    elif evt_type == 'code':
                                        if evt_content:
                                            yield f"event: tool_code\ndata: {json.dumps({'content': evt_content, 'session_id': session_id})}\n\n"
                                    elif evt_type == 'code_end':
                                        # Finalize tool_end with the complete code
                                        final_code = json_parser.code
                                        accumulated_steps.append({
                                            "type": "tool_end",
                                            "name": f"create_{selected_agent}",
                                            "content": final_code,
                                            "status": "done",
                                            "timestamp": int(datetime.utcnow().timestamp() * 1000)
                                        })
                                        yield f"event: tool_end\ndata: {json.dumps({'output': final_code, 'session_id': session_id})}\n\n"
                            else:
                                # For general agent, just stream as thought
                                yield f"event: thought\ndata: {json.dumps({'content': content, 'session_id': session_id})}\n\n"

            # Finalize any remaining JSON content
            if selected_agent and selected_agent != "general":
                final_events = json_parser.finalize()
                for evt_type, evt_content, is_streaming in final_events:
                    if evt_type == 'design_concept_start':
                        if not design_concept_started:
                            design_concept_started = True
                            # Add design_concept step to accumulated_steps
                            accumulated_steps.append({
                                "type": "design_concept",
                                "name": "Design Concept",
                                "content": "",
                                "status": "running",
                                "timestamp": int(datetime.utcnow().timestamp() * 1000)
                            })
                            yield f"event: design_concept_start\ndata: {json.dumps({'session_id': session_id})}\n\n"
                    elif evt_type == 'design_concept' and evt_content:
                        yield f"event: design_concept\ndata: {json.dumps({'content': evt_content, 'session_id': session_id})}\n\n"
                    elif evt_type == 'design_concept_end':
                        # Update design_concept step with final content
                        for step in accumulated_steps:
                            if step.get("type") == "design_concept" and step.get("status") == "running":
                                step["content"] = json_parser.design_concept
                                step["status"] = "done"
                                break
                        yield f"event: design_concept_end\ndata: {json.dumps({'session_id': session_id})}\n\n"
                    elif evt_type == 'code_start':
                        if not code_started:
                            code_started = True
                            accumulated_steps.append({
                                "type": "tool_start",
                                "name": f"create_{selected_agent}",
                                "content": "{}",
                                "status": "done",
                                "timestamp": int(datetime.utcnow().timestamp() * 1000)
                            })
                            yield f"event: tool_start\ndata: {json.dumps({'tool': f'create_{selected_agent}', 'input': {}, 'session_id': session_id})}\n\n"
                    elif evt_type == 'code' and evt_content:
                        yield f"event: tool_code\ndata: {json.dumps({'content': evt_content, 'session_id': session_id})}\n\n"
                    elif evt_type == 'code_end':
                        final_code = json_parser.code
                        accumulated_steps.append({
                            "type": "tool_end",
                            "name": f"create_{selected_agent}",
                            "content": final_code,
                            "status": "done",
                            "timestamp": int(datetime.utcnow().timestamp() * 1000)
                        })
                        yield f"event: tool_end\ndata: {json.dumps({'output': final_code, 'session_id': session_id})}\n\n"

                # Fallback: If parser didn't extract properly, try full extraction
                if not json_parser.code and full_response_content:
                    design_concept, code = extract_json_fields(full_response_content)
                    if code:
                        if not code_started:
                            accumulated_steps.append({
                                "type": "tool_start",
                                "name": f"create_{selected_agent}",
                                "content": "{}",
                                "status": "done",
                                "timestamp": int(datetime.utcnow().timestamp() * 1000)
                            })
                        accumulated_steps.append({
                            "type": "tool_end",
                            "name": f"create_{selected_agent}",
                            "content": code,
                            "status": "done",
                            "timestamp": int(datetime.utcnow().timestamp() * 1000)
                        })
                        yield f"event: tool_end\ndata: {json.dumps({'output': code, 'session_id': session_id})}\n\n"

            # 4. Save Assistant Message (Normal completion)
            if full_response_content or accumulated_steps:
                # For general agent, save full_response_content; for other agents, content is in steps
                content_to_save = full_response_content if selected_agent == "general" else ""
                assistant_msg = await chat_service.add_message(
                    session_id, "assistant",
                    content_to_save,
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
                        error_marker,
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
async def list_sessions(user_id: str | None = None, db: AsyncSession = Depends(get_session)):
    chat_service = ChatService(db, user_id=user_id)
    sessions = await chat_service.get_all_sessions()
    return sessions

@router.get("/sessions/{session_id}")
async def get_session_history(session_id: int, user_id: str | None = None, db: AsyncSession = Depends(get_session)):
    chat_service = ChatService(db, user_id=user_id)
    # Verify ownership
    if not await chat_service.verify_session_ownership(session_id):
        return {"messages": [], "session": None, "error": "Session not found or access denied"}

    history = await chat_service.get_history(session_id)
    session = await chat_service.get_session(session_id)

    return {
        "messages": history,
        "session": session
    }

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, user_id: str | None = None, db: AsyncSession = Depends(get_session)):
    chat_service = ChatService(db, user_id=user_id)
    # Verify ownership before deleting
    if not await chat_service.verify_session_ownership(session_id):
        return {"status": "error", "message": "Session not found or access denied"}
    await chat_service.delete_session(session_id)
    return {"status": "success"}


class TestModelRequest(BaseModel):
    model_id: str
    api_key: str
    base_url: str


@router.post("/test-model")
async def test_model_connection(request: TestModelRequest):
    """Test if a model configuration is valid by making a simple API call."""
    from langchain_openai import ChatOpenAI

    try:
        # Create a test LLM instance
        llm = ChatOpenAI(
            model=request.model_id,
            api_key=request.api_key,
            base_url=request.base_url,
            timeout=15,
            max_retries=1
        )

        # Make a simple test call
        response = await llm.ainvoke([HumanMessage(content="Hi, respond with just 'OK'.")])

        return {
            "success": True,
            "message": "Model connection successful",
            "response": response.content[:100] if response.content else "OK"
        }
    except Exception as e:
        error_msg = str(e)
        # Clean up error message for common cases
        if "401" in error_msg or "Unauthorized" in error_msg.lower():
            error_msg = "Invalid API key - authentication failed"
        elif "404" in error_msg or "not found" in error_msg.lower():
            error_msg = "Model not found - please check the model ID"
        elif "Connection" in error_msg or "timeout" in error_msg.lower():
            error_msg = "Connection failed - please check the base URL"
        elif "Invalid URL" in error_msg:
            error_msg = "Invalid base URL format"

        return {
            "success": False,
            "message": error_msg
        }


# ============ Auth Routes ============

class GoogleAuthRequest(BaseModel):
    credential: str  # JWT token from Google


@router.post("/auth/google")
async def google_auth(request: GoogleAuthRequest, db: AsyncSession = Depends(get_session)):
    """Verify Google credential and create/update user."""
    from app.services.auth import AuthService
    import jwt

    try:
        # Decode the JWT (without verification - Google already verified it)
        # In production, you should verify with Google's public keys
        decoded = jwt.decode(request.credential, options={"verify_signature": False})

        user_id = decoded.get("sub")  # Google's unique user ID
        if not user_id:
            return {"success": False, "message": "Invalid credential"}

        user_info = {
            "email": decoded.get("email"),
            "name": decoded.get("name"),
            "picture": decoded.get("picture"),
            "email_verified": decoded.get("email_verified"),
        }

        auth_service = AuthService(db)
        user = await auth_service.get_or_create_user(
            user_id=user_id,
            auth_type="google",
            user_info=user_info
        )

        return {
            "success": True,
            "user": {
                "id": user.user_id,
                "email": user_info.get("email"),
                "name": user_info.get("name"),
                "picture": user_info.get("picture"),
            }
        }
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        return {"success": False, "message": str(e)}


@router.get("/auth/user/{user_id}")
async def get_user(user_id: str, db: AsyncSession = Depends(get_session)):
    """Get user info by user_id."""
    from app.services.auth import AuthService

    auth_service = AuthService(db)
    user = await auth_service.get_user_by_id(user_id)

    if not user:
        return {"success": False, "message": "User not found"}

    return {
        "success": True,
        "user": {
            "id": user.user_id,
            "type": user.type,
            "email": user.user_info.get("email") if user.user_info else None,
            "name": user.user_info.get("name") if user.user_info else None,
            "picture": user.user_info.get("picture") if user.user_info else None,
        }
    }
