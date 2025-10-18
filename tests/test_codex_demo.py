import subprocess
import sys
from pathlib import Path

import codex_demo


def test_analyse_text_counts_basic():
    text = "Codex makes writing helper scripts easy!"
    stats = codex_demo.analyse_text(text)

    assert stats["characters"] == len(text)
    assert stats["words"] == 6
    assert stats["unique_words"] == 6
    assert stats["most_common_letter"] == "e"


def test_analyse_text_collapses_punctuation_and_case():
    text = "Hello hello HELLO!"
    stats = codex_demo.analyse_text(text)

    assert stats["words"] == 3
    assert stats["unique_words"] == 1
    assert stats["most_common_letter"] == "l"


def test_analyse_text_handles_non_letters():
    text = "123 456"
    stats = codex_demo.analyse_text(text)

    assert stats["characters"] == len(text)
    assert stats["words"] == 2
    assert stats["unique_words"] == 2
    assert stats["most_common_letter"] == "-"


def test_script_output_snapshot():
    text = "Codex Codex Codex"
    script_path = Path(codex_demo.__file__).resolve()
    result = subprocess.run(
        [sys.executable, str(script_path), text],
        check=True,
        capture_output=True,
        text=True,
    )

    assert result.stderr == ""
    assert result.stdout.splitlines() == [
        "Text analysis report",
        "======================",
        "Input: Codex Codex Codex",
        "",
        "        Characters: 17",
        "             Words: 3",
        "      Unique Words: 1",
        "Most Common Letter: c",
    ]
