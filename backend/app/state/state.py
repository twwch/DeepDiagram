from typing import TypedDict, Annotated, List, Union, Any, Dict
import operator

class AgentState(TypedDict):
    """The state of the agent."""
    messages: Annotated[List[Any], operator.add]
    current_code: str
    intent: str
    # Add other state variables as needed
