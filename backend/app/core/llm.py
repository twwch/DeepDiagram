from langchain_openai import ChatOpenAI
from app.core.config import settings

def get_llm(model_name: str | None = None, temperature: float = 0.3):
    """
    Returns a ChatOpenAI instance configured for either OpenAI or DeepSeek
    based on environment variables.
    """

    max_tokens = 1024*16
    
    # Priority: DeepSeek if key is present
    if settings.DEEPSEEK_API_KEY:
        # Override standard OpenAI model names to DeepSeek default
        model = "deepseek-chat"
             
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
        model=model_name or "claude-sonnet-3.7",
        temperature=temperature,
        streaming=True,
        request_timeout=120,
        max_tokens=max_tokens
    )
