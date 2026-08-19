import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.errors import AIUpstreamError
from app.main import create_app
from app.repositories.insight_repo import JsonInsightRepository
from app.services.ai_service import DummyAIService
from app.services.llm_service import OpenAICompatibleAIService
from tests.conftest import submit

GOOD = {
    "insights": [
        {
            "title": f"Insight {i}",
            "content": "Soybean crush margins widened in Brazil.",
            "category": "Oilseeds",
            "tags": ["soybean", "brazil"],
            "confidence": 0.8,
        }
        for i in range(12)
    ]
}


def _transport(handler):
    return httpx.MockTransport(handler)


def _chat_response(content: str, status: int = 200) -> httpx.Response:
    return httpx.Response(status, json={"choices": [{"message": {"content": content}}]})


def _service(handler, fallback=None) -> OpenAICompatibleAIService:
    return OpenAICompatibleAIService(
        base_url="https://llm.test",
        api_key="k",
        model="test-model",
        fallback=fallback,
        transport=_transport(handler),
    )


def test_maps_model_json_to_insights_and_sends_language() -> None:
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return _chat_response(json.dumps(GOOD))

    result = _service(handler).generate_insights(
        prompt="soybean crush margins brazil", target_language="es", context_id=uuid4()
    )
    assert seen["auth"] == "Bearer k"
    assert seen["body"]["model"] == "test-model"
    assert seen["body"]["response_format"] == {"type": "json_object"}
    assert '"es"' in seen["body"]["messages"][0]["content"]
    assert len(result.insights) == 12
    assert result.model == "test-model"
    assert result.insights[0].language == "es"
    assert result.insights[0].metadata.source == "test-model"
    assert "soybean" in result.matched_keywords
    ids = [i.id for i in result.insights]
    assert len(set(ids)) == 12


@pytest.mark.parametrize(
    "handler",
    [
        lambda _r: _chat_response("not json at all"),
        lambda _r: _chat_response(json.dumps({"insights": []})),
        lambda _r: httpx.Response(500, text="boom"),
        lambda _r: (_ for _ in ()).throw(httpx.ConnectError("down")),
    ],
)
def test_upstream_failures_fall_back_to_dummy(handler) -> None:
    dummy = DummyAIService(JsonInsightRepository())
    result = _service(handler, fallback=dummy).generate_insights(
        prompt="soybean crush margins brazil", target_language="en", context_id=uuid4()
    )
    assert result.insights
    assert result.model.startswith("dummy-insights-v1 (fallback:")


def test_upstream_failure_without_fallback_is_502() -> None:
    svc = _service(lambda _r: httpx.Response(503, text="nope"))
    with pytest.raises(AIUpstreamError):
        svc.generate_insights(
            prompt="soybean crush margins", target_language="en", context_id=uuid4()
        )


def test_app_returns_structured_502_when_ai_down_and_no_fallback() -> None:
    svc = _service(lambda _r: httpx.Response(503, text="nope"))
    client = TestClient(create_app(Settings(), ai_service=svc))
    r = submit(client)
    assert r.status_code == 502
    assert r.json()["error"] == "AI_UPSTREAM_ERROR"


def test_gatekeeper_still_runs_before_the_llm() -> None:
    calls = []

    def handler(_r):
        calls.append(1)
        return _chat_response(json.dumps(GOOD))

    client = TestClient(create_app(Settings(), ai_service=_service(handler)))
    assert submit(client, prompt="hi").json()["status"] == "NEEDS_CLARIFICATION"
    assert calls == []


def test_provider_config_requires_key() -> None:
    with pytest.raises(RuntimeError):
        create_app(Settings(ai_provider="openai_compatible"))
