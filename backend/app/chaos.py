"""Opt-in fault injection (Settings.chaos_*): error_rate -> 503 CHAOS_INJECTED, drop_rate ->
raise before responding (bare 500, like a crashed upstream), latency_ms -> fixed delay.
/health and docs are exempt."""

from __future__ import annotations

import asyncio
import json
import logging
import random
from collections.abc import Awaitable, Callable, MutableMapping
from typing import Any

log = logging.getLogger(__name__)

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]

EXEMPT_PATHS = ("/api/v1/health", "/docs", "/openapi.json", "/redoc")


class ChaosInjectedError(RuntimeError):
    pass


class ChaosMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        *,
        error_rate: float = 0.0,
        drop_rate: float = 0.0,
        latency_ms: int = 0,
        seed: int | None = None,
    ) -> None:
        self.app = app
        self.error_rate = error_rate
        self.drop_rate = drop_rate
        self.latency_ms = latency_ms
        self._rng = random.Random(seed)
        log.warning(
            "CHAOS MODE ON: error_rate=%.2f drop_rate=%.2f latency_ms=%d",
            error_rate,
            drop_rate,
            latency_ms,
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("path", "").startswith(EXEMPT_PATHS):
            await self.app(scope, receive, send)
            return
        if self.latency_ms:
            await asyncio.sleep(self.latency_ms / 1000)
        roll = self._rng.random()
        if roll < self.drop_rate:
            raise ChaosInjectedError("chaos: dropped connection")
        if roll < self.drop_rate + self.error_rate:
            payload = json.dumps(
                {"error": "CHAOS_INJECTED", "message": "Injected failure (chaos testing)"}
            ).encode()
            await send(
                {
                    "type": "http.response.start",
                    "status": 503,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"content-length", str(len(payload)).encode()),
                        (b"retry-after", b"1"),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": payload})
            return
        await self.app(scope, receive, send)
