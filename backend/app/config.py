"""Application settings.

Every tunable lives here so behaviour is configurable without code changes.
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="INSIGHTS_", env_file=".env", extra="ignore")

    app_name: str = "Insights BFF"
    # ISO 639-1 codes the (dummy) AI service can answer in.
    supported_languages: dict[str, str] = Field(
        default={"en": "English", "es": "Español", "fr": "Français", "de": "Deutsch"}
    )
    # Gatekeeper thresholds: below these we answer NEEDS_CLARIFICATION without touching the AI.
    min_prompt_length: int = 5
    min_prompt_words: int = 2
    # Hard cap on request bodies (bytes); enforced before parsing.
    max_body_bytes: int = 64 * 1024
    # Pagination bounds.
    default_page_size: int = 10
    max_page_size: int = 50
    # How long an answered request stays addressable for page navigation.
    request_ttl_seconds: int = 60 * 30
    max_stored_requests: int = 1000
    cors_origins: list[str] = Field(default=["http://localhost:5173", "http://127.0.0.1:5173"])


@lru_cache
def get_settings() -> Settings:
    return Settings()
