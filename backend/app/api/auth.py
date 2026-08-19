import secrets
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import APIKeyHeader

from app.errors import UnauthorizedError

_header = APIKeyHeader(name="X-API-Key", auto_error=False, description="Required when keys are set")


def require_api_key(request: Request, key: Annotated[str | None, Depends(_header)]) -> None:
    allowed: list[str] = request.app.state.settings.api_keys
    if not allowed:
        return
    if key and any(secrets.compare_digest(key, k) for k in allowed):
        return
    raise UnauthorizedError("Missing or invalid API key")
