from langchain_openai import ChatOpenAI
from app.core.config import settings

def get_llm(model_name: str | None = None, temperature: float = 0.3):
    """
    Returns a ChatOpenAI instance configured for either OpenAI or DeepSeek
    based on environment variables.
    """

    max_tokens = settings.MAX_TOKENS
    # Priority: DeepSeek if key is present
    if settings.DEEPSEEK_API_KEY:
        # Override standard OpenAI model names to DeepSeek default
        model = settings.MODEL_ID or "deepseek-chat"
    
        
        return ChatOpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
            model=model,
            temperature=temperature,
            streaming=True,
            request_timeout=120,
            max_tokens=max_tokens
        )
    
    # Fallback to OpenAI
    return ChatOpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_BASE_URL,
        model=model_name or settings.MODEL_ID or "claude-sonnet-3.7",
        temperature=temperature,
        streaming=True,
        request_timeout=120,
        max_tokens=max_tokens
    )


def get_thinking_instructions() -> str:
    """
    Returns system prompt instructions based on thinking verbosity setting.
    """
    verbosity = settings.THINKING_VERBOSITY.lower()
    
    if verbosity == "concise":
        return "\n\n### THINKING PROCESS\n- Please be extremely concise in your internal thinking (<think> tags).\n- Focus ONLY on critical reasoning steps.\n- Avoid restating the obvious or verbose planning."
    elif verbosity == "verbose":
        return "\n\n### THINKING PROCESS\n- Please explore all possibilities in your internal thinking.\n- Verify assumptions and plan in detail."
    
    return "" # Normal - rely on model default
