"""Interactive morning affirmation generator."""

from __future__ import annotations

import re
from textwrap import dedent

# Keywords grouped by the intensity of the emotion they convey.
STRONG_POSITIVE = {
    "amazing",
    "fantastic",
    "wonderful",
    "excellent",
    "awesome",
    "ecstatic",
    "thrilled",
    "overjoyed",
    "energised",
    "energized",
    "blessed",
    "grateful",
}
MILD_POSITIVE = {
    "good",
    "great",
    "fine",
    "okay",
    "ok",
    "alright",
    "well",
    "steady",
    "calm",
    "content",
}
MILD_NEGATIVE = {
    "tired",
    "meh",
    "so-so",
    "not great",
    "not good",
    "not ok",
    "down",
    "low",
    "stressed",
    "anxious",
    "worried",
    "drained",
    "flat",
}
STRONG_NEGATIVE = {
    "terrible",
    "awful",
    "horrible",
    "miserable",
    "depressed",
    "exhausted",
    "overwhelmed",
    "frustrated",
    "burned out",
    "burnt out",
    "hopeless",
}

LEVEL_NAMES = {
    -2: "running on empty",
    -1: "regrouping",
    0: "steady",
    1: "cheerful",
    2: "radiant",
}

AFFIRMATIONS = {
    -1: [
        "You deserve kindness today, especially from yourself.",
        "Every breath is a reset button—take one and feel it nourish you.",
        "Your presence matters more than any checklist.",
        "Courage is showing up, and you already did that.",
        "Small steps forward still move you toward the light.",
    ],
    0: [
        "You’re steadier than you give yourself credit for.",
        "Your calm focus is a quiet kind of superpower.",
        "You have room to welcome little sparks of joy today.",
        "Trust that you can handle what’s on your plate.",
        "Your balance inspires confidence in those around you.",
    ],
    1: [
        "Your optimism is contagious—let it flow freely.",
        "The energy you bring lights up the spaces you enter.",
        "You’re aligned with good things unfolding today.",
        "Your smile has the power to ripple positivity outward.",
        "Excitement is building, and you’re ready to ride the wave.",
    ],
    2: [
        "Your joy is a beacon that elevates everyone nearby.",
        "You’re overflowing with brilliance—let it shine without limits.",
        "The universe is cheering right alongside you.",
        "You radiate possibility, turning dreams into plans.",
        "Your gratitude multiplies the good already on its way.",
    ],
}

WORD_RE = re.compile(r"[\w']+")


def _score_keywords(response: str) -> int:
    score = 0
    text = response.lower()
    tokens = WORD_RE.findall(text)
    remaining_tokens = set(tokens)

    def apply_phrases(phrases: set[str], value: int) -> None:
        nonlocal score, remaining_tokens

        for phrase in phrases:
            if " " in phrase:
                if phrase in text:
                    score += value
                    for part in phrase.split():
                        remaining_tokens.discard(part)
            else:
                if phrase in remaining_tokens:
                    score += value
                    remaining_tokens.discard(phrase)

    apply_phrases(STRONG_NEGATIVE, -2)
    apply_phrases(MILD_NEGATIVE, -1)
    apply_phrases(STRONG_POSITIVE, 2)
    apply_phrases(MILD_POSITIVE, 1)

    return score


def evaluate_enthusiasm(response: str) -> int:
    """Return an enthusiasm score between -2 (low) and 2 (high)."""

    if not response:
        return 0

    score = _score_keywords(response)

    exclamations = response.count("!")
    score += min(exclamations, 2)

    uppercase_tokens = [
        token
        for token in WORD_RE.findall(response)
        if token.isupper() and len(token) > 1
    ]
    score += min(len(uppercase_tokens), 2)

    return max(-2, min(2, score))


def next_level(score: int) -> int:
    return min(2, score + 1)


def present_affirmations(target_level: int) -> None:
    lines = AFFIRMATIONS.get(target_level, AFFIRMATIONS[2])
    for index, line in enumerate(lines, start=1):
        print(f"{index}. {line}")


def main() -> None:
    greeting = dedent(
        """
        Good morning! How are you doing today?
        Share a sentence or two so I can cheer you on.
        """
    ).strip()
    print(greeting)
    response = input("> ")

    score = evaluate_enthusiasm(response)
    target = next_level(score)

    print()
    print(
        f"I hear that you're feeling {LEVEL_NAMES[score]}. "
        f"Let's lift you toward feeling {LEVEL_NAMES[target]}!"
    )
    print("Here are five affirmations for you:")
    present_affirmations(target)


if __name__ == "__main__":
    main()
