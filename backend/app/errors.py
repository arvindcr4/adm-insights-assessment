"""Structured error model.

Every non-2xx response has the same envelope:
    {"error": "<MACHINE_CODE>", "message": "<human text>", "details": <optional>}
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger(__name__)


class AppError(Exception):
    status_code: int = 400
    code: str = "BAD_REQUEST"

    def __init__(self, message: str, *, details: Any = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details

    def to_payload(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"error": self.code, "message": self.message}
        if self.details is not None:
            payload["details"] = self.details
        return payload


class UnsupportedLanguageError(AppError):
    status_code = 400
    code = "INVALID_LANGUAGE"


class RequestNotFoundError(AppError):
    status_code = 404
    code = "REQUEST_NOT_FOUND"


class InvalidPageSizeError(AppError):
    status_code = 422
    code = "VALIDATION_ERROR"


_HTTP_CODES = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 413: "PAYLOAD_TOO_LARGE"}


def _format_validation_issue(issue: dict[str, Any]) -> dict[str, Any]:
    # pydantic loc looks like ("body", "prompt") or ("query", "page"); drop the source segment.
    loc = [str(p) for p in issue.get("loc", ()) if p not in ("body", "query", "path")]
    return {
        "field": ".".join(loc) or "body",
        "code": issue.get("type", "invalid"),
        "message": issue.get("msg", "Invalid value"),
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.to_payload())

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [_format_validation_issue(e) for e in exc.errors()]
        return JSONResponse(
            status_code=422,
            content={
                "error": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": details,
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        # Framework-raised errors (unknown route, wrong method, ...) use the same envelope.
        code = _HTTP_CODES.get(exc.status_code, f"HTTP_{exc.status_code}")
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": code, "message": str(exc.detail)},
            headers=dict(exc.headers or {}),
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("Unhandled error", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={"error": "INTERNAL_ERROR", "message": "An unexpected error occurred"},
        )
