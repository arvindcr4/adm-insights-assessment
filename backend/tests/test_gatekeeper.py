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
    ],
)
def test_flags_unclear_prompts(prompt: str, expected_reason: str) -> None:
    verdict = gk.assess(prompt)
    assert verdict.needs_clarification
    assert expected_reason in verdict.reasons
    assert verdict.suggestions


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


def test_reasons_are_deduplicated() -> None:
    reasons = gk.assess("hi").reasons
    assert len(reasons) == len(set(reasons))
