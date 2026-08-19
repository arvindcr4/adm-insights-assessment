from app.repositories.insight_repo import JsonInsightRepository


def test_index_is_precomputed_at_load() -> None:
    insight = JsonInsightRepository().all()[0]
    assert insight.terms and insight.prefixes
    assert "soybean" in insight.terms
    # Prefix matching: "export" should match "exports"; 2-char junk should not prefix-match.
    assert any(i.matches("export") for i in JsonInsightRepository().all())
    assert not insight.matches("so")


def test_index_spans_all_languages() -> None:
    insight = JsonInsightRepository().all()[0]
    assert "soja" in insight.terms  # es/fr/de rendition tokens are indexed too
