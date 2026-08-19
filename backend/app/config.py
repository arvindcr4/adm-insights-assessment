from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


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

    # Request store: "memory" (per process) or "sqlite" (survives restarts, shared by workers).
    store_backend: Literal["memory", "sqlite"] = "memory"
    sqlite_path: str = "data/insights.db"

    # Auth: when non-empty, /api/v1/* (except /health) requires X-API-Key. Comma-separated env.
    api_keys: Annotated[list[str], NoDecode] = Field(default_factory=list)
    # Rate limiting per client IP (token bucket); 0 = off. Per process.
    rate_limit_per_minute: int = 0
    rate_limit_burst: int = 20
    # Use X-Forwarded-For for the client IP (only behind a trusted proxy such as the bundled nginx).
    trust_proxy_headers: bool = False

    # AI provider behind the AIService seam.
    ai_provider: Literal["dummy", "openai_compatible"] = "dummy"
    ai_base_url: str = "https://api.deepseek.com"
    ai_api_key: SecretStr | None = None
    ai_model: str = "deepseek-chat"
    ai_timeout_seconds: float = 40.0
    # On upstream failure answer from the dummy catalogue instead of a 502.
    ai_fallback_to_dummy: bool = True

    @field_validator("api_keys", mode="before")
    @classmethod
    def _split_keys(cls, v: object) -> object:
        if isinstance(v, str):
            return [k.strip() for k in v.split(",") if k.strip()]
        return v

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
