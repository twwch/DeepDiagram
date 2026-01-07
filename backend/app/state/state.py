from typing import TypedDict, Annotated, List, Union, Any, Dict, Optional
import operator

class AgentState(TypedDict):
    """The state of the agent."""
    messages: Annotated[List[Any], operator.add]
    active_agent: Optional[str] = None
    intent: Optional[str] = None
    # Add other state variables as needed
