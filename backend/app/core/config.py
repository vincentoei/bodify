from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""
    openrouter_api_key: str = ""
    openrouter_model: str = "meta-llama/llama-3.3-70b-instruct"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    deepgram_api_key: str = ""
    chroma_host: str = "localhost"
    chroma_port: int = 8001
    chroma_collection: str = "bodify_guidelines"
    app_env: str = "development"
    frontend_url: str = "http://localhost:3000"
    database_url: str = "sqlite:///./bodify.db"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
