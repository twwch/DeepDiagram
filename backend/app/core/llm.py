from langchain_openai import ChatOpenAI
from app.core.config import settings

def get_llm(model_name: str | None = None, temperature: float = 0.3, api_key: str | None = None, base_url: str | None = None):
    """
    Returns a ChatOpenAI instance configured for either OpenAI or DeepSeek
    based on environment variables or provided overrides.
    """

    max_tokens = settings.MAX_TOKENS
    
    # Use provided overrides if available
    final_api_key = api_key.strip() if (api_key and api_key.strip()) else None
    if final_api_key and final_api_key.startswith("Bearer "):
        final_api_key = final_api_key[7:].strip()
        
    final_base_url = base_url.strip() if (base_url and base_url.strip()) else None
    if final_base_url:
        final_base_url = final_base_url.rstrip("/")
        # Remove only the most common final endpoint segments
        # We DON'T strip /v1 because many providers require it as part of the base URL
        # and stripping it might break compatibility if the library doesn't add it back.
        for suffix in ["/chat/completions", "/completions"]:
            if final_base_url.lower().endswith(suffix):
                final_base_url = final_base_url[:-len(suffix)].rstrip("/")
                break

    final_model = (model_name.strip() if model_name else None) or settings.MODEL_ID
    
    from app.core.logger import logger
    
    if final_api_key:
        # Determine provider hint for better logging
        provider = "Custom"
        url_lower = (final_base_url or "").lower()
        if "nvidia" in url_lower: provider = "NVIDIA"
        elif "dashscope" in url_lower or "aliyun" in url_lower: provider = "Aliyun/DashScope"
        elif "deepseek" in url_lower: provider = "DeepSeek"
        elif "openai" in url_lower: provider = "OpenAI"

        key_hint = f"{final_api_key[:6]}...{final_api_key[-4:]}" if (final_api_key and len(final_api_key) > 10) else "REDACTED"
        

        return ChatOpenAI(
            api_key=final_api_key,
            base_url=final_base_url,
            model=final_model or "claude-sonnet-3.7",
            temperature=temperature,
            streaming=True,
            request_timeout=120,
            max_tokens=max_tokens
        )
    

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


def get_configured_llm(state: "AgentState", temperature: float = 0.3):
    """
    Helper to get an LLM instance based on the current AgentState configuration.
    """
    config = state.get("model_config")
    from app.core.logger import logger
    logger.info(f"DEBUG | get_configured_llm | config found: {True if config else False}")
    if config:
        return get_llm(
            model_name=config.get("model_id"),
            api_key=config.get("api_key"),
            base_url=config.get("base_url"),
            temperature=temperature
        )
    return get_llm(temperature=temperature)


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
