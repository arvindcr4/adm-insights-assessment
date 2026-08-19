from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.conftest import submit

# ---------- validation ----------


def test_missing_prompt_is_422_structured(client: TestClient) -> None:
    r = client.post("/api/v1/prompts", json={"targetLanguage": "en"})
    assert r.status_code == 422
    body = r.json()
    assert body["error"] == "VALIDATION_ERROR"
    assert any(d["field"] == "prompt" for d in body["details"])


def test_empty_prompt_is_422(client: TestClient) -> None:
    r = submit(client, prompt="   ")
    assert r.status_code == 422
    assert r.json()["error"] == "VALIDATION_ERROR"


def test_unsupported_language_is_400(client: TestClient) -> None:
    r = submit(client, targetLanguage="xx")
    assert r.status_code == 400
    body = r.json()
    assert body["error"] == "INVALID_LANGUAGE"
    assert body["message"] == "Target language is not supported"
    assert "en" in body["details"]["supportedLanguages"]


def test_malformed_language_codes_are_also_invalid_language(client: TestClient) -> None:
    for code in ("eng", "123", "e"):
        r = submit(client, targetLanguage=code)
        assert r.status_code == 400, code
        assert r.json()["error"] == "INVALID_LANGUAGE"


def test_unknown_route_and_method_use_error_envelope(client: TestClient) -> None:
    r = client.get("/api/v1/nope")
    assert r.status_code == 404
    assert r.json() == {"error": "NOT_FOUND", "message": "Not Found"}
    r = client.delete("/api/v1/prompts")
    assert r.status_code == 405
    assert r.json()["error"] == "METHOD_NOT_ALLOWED"


def test_language_is_case_insensitive(client: TestClient) -> None:
    r = submit(client, targetLanguage="EN")
    assert r.status_code == 200
    assert r.json()["targetLanguage"] == "en"


def test_bad_context_id_is_422(client: TestClient) -> None:
    r = submit(client, contextId="not-a-uuid")
    assert r.status_code == 422
    assert any(d["field"] == "contextId" for d in r.json()["details"])


def test_unknown_fields_rejected(client: TestClient) -> None:
    r = submit(client, extra="nope")
    assert r.status_code == 422


# ---------- clarification (no AI call) ----------


def test_short_prompt_needs_clarification_without_calling_ai(settings: Settings) -> None:
    calls = []

    class SpyAI:
        def generate_insights(self, **kwargs):
            calls.append(kwargs)
            raise AssertionError("AI must not be called")

    client = TestClient(create_app(settings, ai_service=SpyAI()))
    r = submit(client, prompt="hi")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "NEEDS_CLARIFICATION"
    assert body["message"].startswith("Please provide more details")
    assert "PROMPT_TOO_SHORT" in body["reasons"]
    UUID(body["contextId"])
    assert calls == []


def test_clarification_preserves_context_id_and_counts_as_a_turn(client: TestClient) -> None:
    ctx = str(uuid4())
    r = submit(client, prompt="what is it", contextId=ctx)
    assert r.json()["contextId"] == ctx
    assert r.json()["turn"] == 1
    assert submit(client, contextId=ctx).json()["turn"] == 2


# ---------- success + pagination ----------


def test_success_returns_first_page_and_metadata(client: TestClient) -> None:
    r = submit(client)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "SUCCESS"
    assert len(body["insights"]) <= 10
    p = body["pagination"]
    assert p["page"] == 1 and p["pageSize"] == 10
    assert p["totalItems"] > 10  # this prompt matches many dummy insights
    assert p["hasNextPage"] is True
    assert body["insights"][0]["language"] == "en"
    assert "soybean" in body["meta"]["matchedKeywords"]


def test_pages_are_navigable_and_disjoint(client: TestClient) -> None:
    first = submit(client).json()
    rid = first["requestId"]
    total = first["pagination"]["totalPages"]
    seen: list[str] = []
    for page in range(1, total + 1):
        r = client.get(f"/api/v1/prompts/{rid}/insights", params={"page": page, "pageSize": 10})
        assert r.status_code == 200
        seen.extend(i["id"] for i in r.json()["insights"])
    assert len(seen) == len(set(seen)) == first["pagination"]["totalItems"]


def test_page_beyond_range_is_empty_not_error(client: TestClient) -> None:
    rid = submit(client).json()["requestId"]
    r = client.get(f"/api/v1/prompts/{rid}/insights", params={"page": 999})
    assert r.status_code == 200
    assert r.json()["insights"] == []


def test_page_size_bounds_enforced(client: TestClient) -> None:
    rid = submit(client).json()["requestId"]
    assert client.get(f"/api/v1/prompts/{rid}/insights", params={"pageSize": 0}).status_code == 422
    r = client.get(f"/api/v1/prompts/{rid}/insights", params={"pageSize": 999})
    assert r.status_code == 422
    assert r.json()["error"] == "VALIDATION_ERROR"
    assert r.json()["details"][0]["field"] == "pageSize"


def test_page_size_bounds_come_from_injected_settings() -> None:
    client = TestClient(create_app(Settings(default_page_size=3, max_page_size=4)))
    first = submit(client).json()
    assert first["pagination"]["pageSize"] == 3
    rid = first["requestId"]
    assert client.get(f"/api/v1/prompts/{rid}/insights").json()["pagination"]["pageSize"] == 3
    assert client.get(f"/api/v1/prompts/{rid}/insights", params={"pageSize": 4}).status_code == 200
    assert client.get(f"/api/v1/prompts/{rid}/insights", params={"pageSize": 5}).status_code == 422


def test_unknown_request_is_404(client: TestClient) -> None:
    r = client.get(f"/api/v1/prompts/{uuid4()}/insights")
    assert r.status_code == 404
    assert r.json()["error"] == "REQUEST_NOT_FOUND"


def test_same_prompt_is_deterministic(client: TestClient) -> None:
    a = submit(client, prompt="zzz qqq unmatched words").json()
    b = submit(client, prompt="zzz qqq unmatched words").json()
    assert [i["id"] for i in a["insights"]] == [i["id"] for i in b["insights"]]
    assert a["meta"]["matchedKeywords"] == []


def test_context_turn_increments(client: TestClient) -> None:
    ctx = str(uuid4())
    assert submit(client, contextId=ctx).json()["turn"] == 1
    assert submit(client, contextId=ctx, prompt="wheat exports black sea").json()["turn"] == 2


def test_languages_endpoint(client: TestClient) -> None:
    r = client.get("/api/v1/languages")
    assert r.status_code == 200
    codes = [lang["code"] for lang in r.json()["languages"]]
    assert codes == sorted(codes) and "en" in codes
