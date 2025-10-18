"""Simple Codex demonstration script.

This script provides a short example of how a Python program can
process text and produce a few basic analytics.  It is intentionally
concise so that it can be used as a quick demonstration in tutorials or
during live coding sessions.
"""

from __future__ import annotations

import argparse
from collections import Counter
import re
from textwrap import dedent


WORD_PATTERN = re.compile(r"[\w']+")


def _tokenise_words(text: str) -> list[str]:
    """Return a list of word-like tokens extracted from *text*.

    Splitting purely on whitespace means punctuation such as ``easy!`` would be
    treated as a distinct word.  Using a small regular expression keeps the
    demonstration simple while producing counts that better match intuition.
    """

    return WORD_PATTERN.findall(text)


def analyse_text(text: str) -> dict[str, int]:
    """Return a dictionary describing the supplied text.

    The metrics are deliberately basic; the goal is to keep the example
    easy to understand so that it can be typed out in a live session or
    referenced when demonstrating Codex.
    """

    words = _tokenise_words(text)
    normalised_words = [word.casefold() for word in words]
    letters = [char.casefold() for char in text if char.isalpha()]

    return {
        "characters": len(text),
        "words": len(words),
        "unique_words": len(set(normalised_words)),
        "most_common_letter": Counter(letters).most_common(1)[0][0]
        if letters
        else "-",
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate a simple report for a snippet of text.",
        epilog=dedent(
            """
            Example:
              python codex_demo.py "Codex makes writing helper scripts easy!"
            """
        ),
    )
    parser.add_argument(
        "text",
        nargs="*",
        help="Text to analyse. Provide words directly on the command line.",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if not args.text:
        parser.error("Please provide a short piece of text to analyse.")

    text = " ".join(args.text)
    stats = analyse_text(text)

    print("Text analysis report")
    print("=" * 22)
    print(f"Input: {text}")
    print()
    for key, value in stats.items():
        print(f"{key.replace('_', ' ').title():>18}: {value}")


if __name__ == "__main__":
    main()
