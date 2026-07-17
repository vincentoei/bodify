from langchain_openai import ChatOpenAI
from app.core.config import get_settings
from langchain_core.language_models.chat_models import BaseChatModel


def get_llm(temperature: float = 0.2, max_tokens: int = 2048) -> BaseChatModel:
    """Returns the configured LLM via OpenRouter with a small token cap.

    Used by specialists, fact extractor, and recovery coordinator — structured
    small-call agents. 2048 default leaves headroom for JSON envelope (field
    names, quotes, braces) above the ~200-word rationale / 100-word evidence
    guideline; specialists rarely emit more than ~1k tokens.
    """
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise ValueError("OpenRouter API key not configured")
    return ChatOpenAI(
        model=settings.openrouter_model,
        openai_api_key=settings.openrouter_api_key,
        openai_api_base=settings.openrouter_base_url,
        temperature=temperature,
        max_tokens=max_tokens,
        extra_body={"route": "fallback"},
    )


def get_llm_large(temperature: float = 0.2, max_tokens: int = 16384) -> BaseChatModel:
    """Returns the configured LLM with a large token cap for plan generation.

    The main Coordinator (onboarding/regenerate) emits full meal_plan (7×3) and
    workout_plan lists — needs the higher cap. Keep specialists on get_llm().
    """
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise ValueError("OpenRouter API key not configured")
    return ChatOpenAI(
        model=settings.openrouter_model,
        openai_api_key=settings.openrouter_api_key,
        openai_api_base=settings.openrouter_base_url,
        temperature=temperature,
        max_tokens=max_tokens,
        extra_body={"route": "fallback"},
    )
