import pytest

from app.domain.gatekeeper import PromptGatekeeper

gk = PromptGatekeeper(min_length=5, min_words=2)


@pytest.mark.parametrize(
    "prompt, expected_reason",
    [
        ("hi", "PROMPT_TOO_SHORT"),
        ("soy", "PROMPT_TOO_SHORT"),
        ("soybeans", "TOO_FEW_WORDS"),
        ("what is it?", "ONLY_FILLER_WORDS"),
        ("!!! ???", "NO_MEANINGFUL_CONTENT"),
        ("tell me more", "VAGUE_PROMPT"),
        ("do something", "ONLY_FILLER_WORDS"),
        ("give details", "ONLY_FILLER_WORDS"),
        ("I want to know more", "ONLY_FILLER_WORDS"),
    ],
)
def test_flags_unclear_prompts(prompt: str, expected_reason: str) -> None:
    verdict = gk.assess(prompt)
    assert verdict.needs_clarification
    assert expected_reason in verdict.reasons
    assert gk.suggestions()


@pytest.mark.parametrize(
    "prompt",
    [
        "soybean crush margins",
        "How is the corn harvest going in Illinois?",
        "wheat exports black sea",
    ],
)
def test_accepts_clear_prompts(prompt: str) -> None:
    assert not gk.assess(prompt).needs_clarification


def test_clarification_copy_is_localized() -> None:
    reasons = gk.assess("hi").reasons[:1]
    assert gk.describe(reasons, "es").startswith("Por favor, aporta más detalles.")
    assert gk.describe(reasons, "de").startswith("Bitte geben Sie mehr Details an.")
    assert gk.describe(reasons, "xx").startswith("Please provide more details.")  # fallback
    assert gk.suggestions("fr")[0].startswith("Nommez le sujet")


def test_reasons_are_deduplicated() -> None:
    reasons = gk.assess("hi").reasons
    assert len(reasons) == len(set(reasons))
