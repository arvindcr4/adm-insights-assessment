from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.conftest import submit


def test_auth_off_when_no_keys(client: TestClient) -> None:
    assert submit(client).status_code == 200


def test_api_key_required_when_configured() -> None:
    client = TestClient(create_app(Settings(api_keys=["k1", "k2"])))
    r = submit(client)
    assert r.status_code == 401
    assert r.json() == {"error": "UNAUTHORIZED", "message": "Missing or invalid API key"}
    assert r.headers["www-authenticate"] == "ApiKey"
    assert client.get("/api/v1/languages", headers={"X-API-Key": "nope"}).status_code == 401
    assert client.get("/api/v1/languages", headers={"X-API-Key": "k2"}).status_code == 200
    assert (
        client.post(
            "/api/v1/prompts",
            json={"prompt": "corn yields illinois", "targetLanguage": "en"},
            headers={"X-API-Key": "k1"},
        ).status_code
        == 200
    )
    assert client.get("/api/v1/health").status_code == 200  # always open


def test_api_keys_env_accepts_comma_list(monkeypatch) -> None:
    monkeypatch.setenv("INSIGHTS_API_KEYS", "a, b")
    assert Settings().api_keys == ["a", "b"]


def test_rate_limit_bursts_then_429_with_retry_after() -> None:
    client = TestClient(create_app(Settings(rate_limit_per_minute=60, rate_limit_burst=3)))
    codes = [submit(client).status_code for _ in range(5)]
    assert codes[:3] == [200, 200, 200]
    assert codes[3] == 429
    r = submit(client)
    assert r.json()["error"] == "RATE_LIMITED"
    assert int(r.headers["retry-after"]) >= 1
    assert client.get("/api/v1/health").status_code == 200


def test_rate_limit_uses_forwarded_ip_only_when_trusted() -> None:
    trusted = TestClient(
        create_app(Settings(rate_limit_per_minute=60, rate_limit_burst=1, trust_proxy_headers=True))
    )
    assert submit(trusted).status_code == 200
    assert submit(trusted).status_code == 429
    # a different forwarded client gets its own bucket
    r = trusted.post(
        "/api/v1/prompts",
        json={"prompt": "corn yields illinois", "targetLanguage": "en"},
        headers={"X-Forwarded-For": "203.0.113.9"},
    )
    assert r.status_code == 200
