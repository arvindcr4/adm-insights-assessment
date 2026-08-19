from __future__ import annotations

from dataclasses import dataclass

from app.domain.models import ClarificationVerdict, _tokenize

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

PREFIX: dict[str, str] = {
    "en": "Please provide more details.",
    "es": "Por favor, aporta más detalles.",
    "fr": "Veuillez donner plus de détails.",
    "de": "Bitte geben Sie mehr Details an.",
}

REASON_MESSAGES: dict[str, dict[str, str]] = {
    "en": {
        "PROMPT_TOO_SHORT": "The prompt is too short to be understood.",
        "TOO_FEW_WORDS": "A single word is not enough context.",
        "NO_MEANINGFUL_CONTENT": "The prompt contains no meaningful words.",
        "ONLY_FILLER_WORDS": "The prompt only contains filler words (e.g. 'what is it?').",
        "VAGUE_PROMPT": "The prompt is too vague to act on.",
    },
    "es": {
        "PROMPT_TOO_SHORT": "La consulta es demasiado corta para entenderse.",
        "TOO_FEW_WORDS": "Una sola palabra no da suficiente contexto.",
        "NO_MEANINGFUL_CONTENT": "La consulta no contiene palabras con significado.",
        "ONLY_FILLER_WORDS": "La consulta solo contiene palabras de relleno (p. ej. «¿qué es?»).",
        "VAGUE_PROMPT": "La consulta es demasiado vaga para actuar.",
    },
    "fr": {
        "PROMPT_TOO_SHORT": "La requête est trop courte pour être comprise.",
        "TOO_FEW_WORDS": "Un seul mot ne donne pas assez de contexte.",
        "NO_MEANINGFUL_CONTENT": "La requête ne contient aucun mot significatif.",
        "ONLY_FILLER_WORDS": "La requête ne contient que des mots vides (ex. « c’est quoi ? »).",
        "VAGUE_PROMPT": "La requête est trop vague pour y donner suite.",
    },
    "de": {
        "PROMPT_TOO_SHORT": "Die Anfrage ist zu kurz, um verstanden zu werden.",
        "TOO_FEW_WORDS": "Ein einzelnes Wort liefert nicht genug Kontext.",
        "NO_MEANINGFUL_CONTENT": "Die Anfrage enthält keine aussagekräftigen Wörter.",
        "ONLY_FILLER_WORDS": "Die Anfrage besteht nur aus Füllwörtern (z. B. „was ist das?“).",
        "VAGUE_PROMPT": "Die Anfrage ist zu vage, um darauf zu reagieren.",
    },
}

SUGGESTIONS: dict[str, tuple[str, ...]] = {
    "en": (
        "Name the subject you are interested in (e.g. a commodity, a market, a process).",
        "Add a region or time frame if relevant.",
        "Say what kind of answer you expect (trend, comparison, explanation).",
    ),
    "es": (
        "Indica el tema que te interesa (p. ej. una materia prima, un mercado, un proceso).",
        "Añade una región o un periodo si procede.",
        "Di qué tipo de respuesta esperas (tendencia, comparación, explicación).",
    ),
    "fr": (
        "Nommez le sujet qui vous intéresse (ex. une matière première, un marché, un procédé).",
        "Ajoutez une région ou une période si pertinent.",
        "Précisez le type de réponse attendu (tendance, comparaison, explication).",
    ),
    "de": (
        "Nennen Sie das Thema, das Sie interessiert (z. B. Rohstoff, Markt, Prozess).",
        "Ergänzen Sie ggf. eine Region oder einen Zeitraum.",
        "Sagen Sie, welche Art Antwort Sie erwarten (Trend, Vergleich, Erklärung).",
    ),
}

DEFAULT_LANGUAGE = "en"


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

        # order-preserving dedupe
        unique = tuple(dict.fromkeys(reasons))
        if not unique:
            return ClarificationVerdict(needs_clarification=False)
        return ClarificationVerdict(needs_clarification=True, reasons=unique)

    @staticmethod
    def describe(reasons: tuple[str, ...], language: str = DEFAULT_LANGUAGE) -> str:
        lang = language if language in REASON_MESSAGES else DEFAULT_LANGUAGE
        table = REASON_MESSAGES[lang]
        detail = " ".join(
            table.get(r, REASON_MESSAGES[DEFAULT_LANGUAGE].get(r, r)) for r in reasons
        )
        return f"{PREFIX[lang]} {detail}".strip()

    @staticmethod
    def suggestions(language: str = DEFAULT_LANGUAGE) -> tuple[str, ...]:
        return SUGGESTIONS.get(language, SUGGESTIONS[DEFAULT_LANGUAGE])
