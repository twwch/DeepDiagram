from contextvars import ContextVar
from typing import List, Dict, Any, Optional
from langchain_core.messages import BaseMessage

# A ContextVar to store the current conversation messages
# This allows tools to access the context without passing it as an argument.
request_context: ContextVar[Dict[str, Any]] = ContextVar("request_context", default={})

def set_context(messages: List[BaseMessage], **kwargs):
    """Sets the current request context."""
    context = {
        "messages": messages,
        **kwargs
    }
    request_context.set(context)

def get_context() -> Dict[str, Any]:
    """Retrieves the current request context."""
    return request_context.get()

def get_messages() -> List[BaseMessage]:
    """Retrieves the messages from the current context."""
    return get_context().get("messages", [])
