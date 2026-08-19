from fastapi.testclient import TestClient

from app.repositories.insight_repo import JsonInsightRepository
from tests.conftest import submit

SUPPORTED = ("en", "es", "fr", "de")


def test_catalogue_has_every_supported_language() -> None:
    for insight in JsonInsightRepository().all():
        assert insight.available_languages() >= set(SUPPORTED), insight.id


def test_localized_returns_translated_text_and_tags_language() -> None:
    insight = JsonInsightRepository().all()[0]
    es = insight.localized("es")
    assert es.language == "es"
    assert es.title != insight.title and es.content != insight.content
    assert es.id == insight.id and es.metadata.tags == insight.metadata.tags
    assert es.metadata.category == "Oleaginosas"
    # Unknown language: source text, honestly tagged as the source language.
    xx = insight.localized("xx")
    assert xx.language == "en" and xx.title == insight.title


def test_api_returns_insights_in_the_target_language(client: TestClient) -> None:
    en = submit(client, targetLanguage="en").json()["insights"][0]
    de = submit(client, targetLanguage="de").json()["insights"][0]
    assert en["id"] == de["id"]
    assert de["language"] == "de"
    assert de["title"] != en["title"]
    assert de["metadata"]["category"] != en["metadata"]["category"]
    assert de["metadata"]["tags"] == en["metadata"]["tags"]  # tags are machine identifiers


def test_clarification_is_in_the_target_language(client: TestClient) -> None:
    body = submit(client, prompt="hi", targetLanguage="fr").json()
    assert body["status"] == "NEEDS_CLARIFICATION"
    assert body["message"].startswith("Veuillez donner plus de détails.")
    assert body["suggestions"][0].startswith("Nommez le sujet")
    assert "PROMPT_TOO_SHORT" in body["reasons"]


def test_prompts_in_other_languages_match_too(client: TestClient) -> None:
    r = submit(client, prompt="márgenes de molienda de soja en Brasil", targetLanguage="es")
    body = r.json()
    assert body["status"] == "SUCCESS"
    assert "soja" in body["meta"]["matchedKeywords"]
    assert body["insights"][0]["language"] == "es"
