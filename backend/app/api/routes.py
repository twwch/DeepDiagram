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


class StreamingJsonParser:
    """Parse streaming JSON output with design_concept and code fields.

    Uses simple regex to determine current streaming state.
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

        # Determine state by checking what patterns exist in buffer
        has_dc_start = '"design_concept"' in self.buffer
        has_code_start = '"code"' in self.buffer

        # Check if design_concept value has started (found opening quote after key)
        dc_value_started = False
        if has_dc_start:
            dc_match = re.search(r'"design_concept"\s*:\s*"', self.buffer)
            dc_value_started = dc_match is not None

        # Check if code value has started
        code_value_started = False
        if has_code_start:
            code_match = re.search(r'"code"\s*:\s*"', self.buffer)
            code_value_started = code_match is not None

        # State: INIT -> waiting for design_concept
        if self.state == self.STATE_INIT:
            if dc_value_started:
                self.state = self.STATE_DESIGN_CONCEPT
                events.append(('design_concept_start', '', True))

        # State: DESIGN_CONCEPT -> streaming design_concept content
        if self.state == self.STATE_DESIGN_CONCEPT:
            # Extract current design_concept content
            dc_content = self._extract_value_content('design_concept')
            if dc_content is not None:
                # Check if design_concept is complete (code field started)
                if code_value_started:
                    # design_concept is complete
                    if len(dc_content) > self.last_dc_len:
                        new_content = dc_content[self.last_dc_len:]
                        self.last_dc_len = len(dc_content)
                        self.design_concept = dc_content
                        events.append(('design_concept', new_content, False))
                    events.append(('design_concept_end', '', False))
                    self.state = self.STATE_CODE
                    events.append(('code_start', '', True))
                else:
                    # Still streaming design_concept
                    if len(dc_content) > self.last_dc_len:
                        new_content = dc_content[self.last_dc_len:]
                        self.last_dc_len = len(dc_content)
                        self.design_concept = dc_content
                        events.append(('design_concept', new_content, True))

        # State: CODE -> streaming code content
        if self.state == self.STATE_CODE:
            code_content = self._extract_value_content('code')
            if code_content is not None and len(code_content) > self.last_code_len:
                new_content = code_content[self.last_code_len:]
                self.last_code_len = len(code_content)
                self.code = code_content
                events.append(('code', new_content, True))

        return events

    def _extract_value_content(self, field_name: str) -> str | None:
        """Extract the current content of a field value (may be incomplete)."""
        # Find field start: "field_name": "
        pattern = f'"{field_name}"\\s*:\\s*"'
        match = re.search(pattern, self.buffer)
        if not match:
            return None

        start_idx = match.end()  # Position right after opening quote

        # Find the content - scan for unescaped closing quote or end of buffer
        content = []
        i = start_idx
        while i < len(self.buffer):
            char = self.buffer[i]
            if char == '\\':
                if i + 1 >= len(self.buffer):
                    # Incomplete escape sequence at end of buffer, stop here
                    break
                # Escape sequence - decode it
                next_char = self.buffer[i + 1]
                if next_char == 'n':
                    content.append('\n')
                elif next_char == 't':
                    content.append('\t')
                elif next_char == 'r':
                    content.append('\r')
                elif next_char == '"':
                    content.append('"')
                elif next_char == '\\':
                    content.append('\\')
                elif next_char == '/':
                    content.append('/')
                elif next_char == 'u':
                    # Unicode escape \uXXXX
                    if i + 5 < len(self.buffer):
                        hex_str = self.buffer[i+2:i+6]
                        try:
                            content.append(chr(int(hex_str, 16)))
                            i += 6
                            continue
                        except ValueError:
                            content.append('\\u')
                            i += 2
                            continue
                    else:
                        # Incomplete unicode escape
                        break
                else:
                    # Unknown escape, just keep the character after backslash
                    content.append(next_char)
                i += 2
            elif char == '"':
                # End of string value
                break
            else:
                content.append(char)
                i += 1

        return ''.join(content)

    def finalize(self) -> list:
        """Finalize parsing and emit any remaining events."""
        events = []

        # If still in design_concept state, close it
        if self.state == self.STATE_DESIGN_CONCEPT:
            dc_content = self._extract_value_content('design_concept')
            if dc_content and len(dc_content) > self.last_dc_len:
                new_content = dc_content[self.last_dc_len:]
                self.design_concept = dc_content
                events.append(('design_concept', new_content, False))
            events.append(('design_concept_end', '', False))

            # Check if code exists
            if '"code"' in self.buffer:
                self.state = self.STATE_CODE
                events.append(('code_start', '', False))

        # If in code state, finalize code
        if self.state == self.STATE_CODE:
            code_content = self._extract_value_content('code')
            if code_content and len(code_content) > self.last_code_len:
                new_content = code_content[self.last_code_len:]
                self.code = code_content
                events.append(('code', new_content, False))
            events.append(('code_end', '', False))
            self.state = self.STATE_DONE

        return events


def extract_json_fields(content: str) -> tuple[str, str]:
    """Extract design_concept and code from complete JSON response."""
    design_concept = ""
    code = ""

    # Remove thinking tags if present
    content = re.sub(r'<think>[\s\S]*?</think>', '', content, flags=re.DOTALL)

    # Try to find JSON object
    try:
        # Find the JSON object boundaries
        start_idx = content.find('{')
        end_idx = content.rfind('}')
        if start_idx != -1 and end_idx != -1:
            json_str = content[start_idx:end_idx+1]
            parsed = json.loads(json_str)
            design_concept = parsed.get('design_concept', '')
            code = parsed.get('code', '')
    except json.JSONDecodeError:
        # If JSON parsing fails, try regex extraction
        dc_match = re.search(r'"design_concept"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,', content, re.DOTALL)
        if dc_match:
            design_concept = dc_match.group(1).replace('\\n', '\n').replace('\\"', '"')

        code_match = re.search(r'"code"\s*:\s*"((?:[^"\\]|\\.)*)"', content, re.DOTALL)
        if code_match:
            code = code_match.group(1).replace('\\n', '\n').replace('\\"', '"')

    return design_concept, code


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
                assistant_msg = await chat_service.add_message(
                    session_id, "assistant",
                    "",  # We don't store the raw JSON in content anymore
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
