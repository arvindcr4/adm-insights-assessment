import time

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.conftest import submit


def test_chaos_is_off_by_default(settings: Settings) -> None:
    assert not settings.chaos_enabled
    app = create_app(settings)
    assert all(m.cls.__name__ != "ChaosMiddleware" for m in app.user_middleware)


def test_injected_errors_are_structured_and_health_is_exempt() -> None:
    client = TestClient(create_app(Settings(chaos_error_rate=1.0)))
    r = submit(client)
    assert r.status_code == 503
    assert r.json() == {"error": "CHAOS_INJECTED", "message": "Injected failure (chaos testing)"}
    assert r.headers["retry-after"] == "1"
    assert client.get("/api/v1/health").status_code == 200


def test_dropped_connections_surface_as_server_error() -> None:
    client = TestClient(create_app(Settings(chaos_drop_rate=1.0)), raise_server_exceptions=False)
    assert submit(client).status_code == 500


def test_partial_rates_are_deterministic_with_seed() -> None:
    def run() -> list[int]:
        client = TestClient(create_app(Settings(chaos_error_rate=0.3, chaos_seed=42)))
        return [submit(client).status_code for _ in range(30)]

    first, second = run(), run()
    assert first == second
    assert 503 in first and 200 in first


def test_latency_is_applied() -> None:
    client = TestClient(create_app(Settings(chaos_latency_ms=50)))
    t0 = time.perf_counter()
    assert submit(client).status_code == 200
    assert (time.perf_counter() - t0) * 1000 >= 50
