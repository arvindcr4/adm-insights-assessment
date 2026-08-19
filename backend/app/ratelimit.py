"""Per-client token bucket (pure ASGI). Per process; put a shared limiter in front for fleets."""

from __future__ import annotations

import json
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable, MutableMapping
from typing import Any

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]

EXEMPT_PATHS = ("/api/v1/health", "/docs", "/openapi.json", "/redoc")
MAX_TRACKED_CLIENTS = 10_000


class RateLimitMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        *,
        per_minute: int,
        burst: int,
        trust_proxy_headers: bool = False,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.app = app
        self.rate = per_minute / 60.0
        self.burst = max(1, burst)
        self.trust_proxy = trust_proxy_headers
        self._clock = clock
        self._buckets: OrderedDict[str, tuple[float, float]] = OrderedDict()  # ip -> (tokens, ts)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("path", "").startswith(EXEMPT_PATHS):
            await self.app(scope, receive, send)
            return
        client = self._client_ip(scope)
        allowed, retry_after = self._take(client)
        if not allowed:
            payload = json.dumps(
                {"error": "RATE_LIMITED", "message": "Too many requests; slow down"}
            ).encode()
            await send(
                {
                    "type": "http.response.start",
                    "status": 429,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"content-length", str(len(payload)).encode()),
                        (b"retry-after", str(retry_after).encode()),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": payload})
            return
        await self.app(scope, receive, send)

    def _client_ip(self, scope: Scope) -> str:
        if self.trust_proxy:
            for name, value in scope.get("headers", []):
                if name == b"x-forwarded-for":
                    return value.decode().split(",")[0].strip()
        client = scope.get("client")
        return client[0] if client else "unknown"

    def _take(self, key: str) -> tuple[bool, int]:
        now = self._clock()
        tokens, ts = self._buckets.get(key, (float(self.burst), now))
        tokens = min(self.burst, tokens + (now - ts) * self.rate)
        if tokens >= 1:
            self._buckets[key] = (tokens - 1, now)
            self._buckets.move_to_end(key)
            while len(self._buckets) > MAX_TRACKED_CLIENTS:
                self._buckets.popitem(last=False)
            return True, 0
        self._buckets[key] = (tokens, now)
        retry_after = max(1, int((1 - tokens) / self.rate + 0.999)) if self.rate else 60
        return False, retry_after
