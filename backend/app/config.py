from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Hackathon AI Backend"
    app_env: str = "dev"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    tinyfish_api_key: str | None = None
    tinyfish_base_url: str = "https://agent.tinyfish.ai"
    cors_origins: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
