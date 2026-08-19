"""Decides, *before* any downstream AI call, whether a prompt needs clarification."""

from __future__ import annotations

from dataclasses import dataclass

from app.domain.models import ClarificationVerdict, _tokenize

# Small English stop-word list; enough to catch "what is it?"-style prompts.
STOPWORDS: frozenset[str] = frozenset(
    """
    a an the and or but of to in on at for from by with about as into like through after
    over between out against during without before under around among is are was were be
    been being am do does did doing have has had having i me my we our you your he him his
    she her it its they them their this that these those what which who whom when where why
    how all any both each few more most other some such no nor not only own same so than too
    very can will just should now please tell give show explain help hi hello hey thanks
    thank ok okay yes yeah something anything everything nothing stuff thing things details
    detail info information want need know let us get find see look make use
    el la los las un una unos unas y o de del en con por para al lo que es son como
    le les des une et ou du au aux sur dans pour par est sont que qui
    der die das ein eine und oder von zu mit auf für im am ist sind wie
    """.split()  # noqa: SIM905 - readable word list
)

VAGUE_PHRASES: frozenset[str] = frozenset(
    {
        "help",
        "help me",
        "info",
        "more info",
        "tell me more",
        "anything",
        "something",
        "test",
        "asdf",
    }
)

REASON_MESSAGES: dict[str, str] = {
    "PROMPT_TOO_SHORT": "The prompt is too short to be understood.",
    "TOO_FEW_WORDS": "A single word is not enough context.",
    "NO_MEANINGFUL_CONTENT": "The prompt contains no meaningful words.",
    "ONLY_FILLER_WORDS": "The prompt only contains filler words (e.g. 'what is it?').",
    "VAGUE_PROMPT": "The prompt is too vague to act on.",
}

DEFAULT_SUGGESTIONS: tuple[str, ...] = (
    "Name the subject you are interested in (e.g. a commodity, a market, a process).",
    "Add a region or time frame if relevant.",
    "Say what kind of answer you expect (trend, comparison, explanation).",
)


@dataclass(frozen=True, slots=True)
class PromptGatekeeper:
    min_length: int = 5
    min_words: int = 2

    def assess(self, prompt: str) -> ClarificationVerdict:
        text = prompt.strip()
        reasons: list[str] = []

        if len(text) < self.min_length:
            reasons.append("PROMPT_TOO_SHORT")

        words = _tokenize(text)
        if not words:
            reasons.append("NO_MEANINGFUL_CONTENT")
        else:
            if len(words) < self.min_words:
                reasons.append("TOO_FEW_WORDS")
            if all(w in STOPWORDS for w in words):
                reasons.append("ONLY_FILLER_WORDS")
            if text.lower().rstrip("?!.") in VAGUE_PHRASES:
                reasons.append("VAGUE_PROMPT")

        # De-duplicate while preserving order (e.g. "hi" trips both TOO_SHORT and TOO_FEW_WORDS).
        unique = tuple(dict.fromkeys(reasons))
        if not unique:
            return ClarificationVerdict(needs_clarification=False)
        return ClarificationVerdict(
            needs_clarification=True, reasons=unique, suggestions=DEFAULT_SUGGESTIONS
        )

    @staticmethod
    def describe(reasons: tuple[str, ...]) -> str:
        return " ".join(REASON_MESSAGES.get(r, r) for r in reasons)
