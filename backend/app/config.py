from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="INSIGHTS_", env_file=".env", extra="ignore")

    app_name: str = "Insights BFF"
    supported_languages: dict[str, str] = Field(
        default={"en": "English", "es": "Español", "fr": "Français", "de": "Deutsch"}
    )
    # Gatekeeper thresholds (NEEDS_CLARIFICATION below these, no AI call).
    min_prompt_length: int = 5
    min_prompt_words: int = 2
    # Request body cap, enforced before parsing.
    max_body_bytes: int = 64 * 1024
    default_page_size: int = 10
    max_page_size: int = 50
    request_ttl_seconds: int = 60 * 30
    max_stored_requests: int = 1000
    cors_origins: list[str] = Field(default=["http://localhost:5173", "http://127.0.0.1:5173"])
    # Fault injection for chaos testing. Off (all zero) by default.
    chaos_error_rate: float = Field(default=0.0, ge=0, le=1)
    chaos_drop_rate: float = Field(default=0.0, ge=0, le=1)
    chaos_latency_ms: int = Field(default=0, ge=0)
    chaos_seed: int | None = None

    @property
    def chaos_enabled(self) -> bool:
        return bool(self.chaos_error_rate or self.chaos_drop_rate or self.chaos_latency_ms)


@lru_cache
def get_settings() -> Settings:
    return Settings()
