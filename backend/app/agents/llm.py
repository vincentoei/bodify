from langchain_openai import ChatOpenAI
from app.core.config import get_settings
from langchain_core.language_models.chat_models import BaseChatModel


def get_llm(temperature: float = 0.2) -> BaseChatModel:
    """
    Returns the configured LLM via OpenRouter.

    OpenRouter provides model-agnostic routing — you can swap models by changing
    the OPENROUTER_MODEL env var without touching code. Examples:
      - meta-llama/llama-3.3-70b-instruct
      - anthropic/claude-3.5-sonnet
      - google/gemini-2.0-flash-exp

    The "route: fallback" extra_body tells OpenRouter to automatically fail over
    to another provider if the primary one is rate-limited or down.
    """
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise ValueError("OpenRouter API key not configured")
    return ChatOpenAI(
        model=settings.openrouter_model,
        openai_api_key=settings.openrouter_api_key,
        openai_api_base=settings.openrouter_base_url,
        temperature=temperature,
        max_tokens=8192,
        extra_body={"route": "fallback"},
    )
