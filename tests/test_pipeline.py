from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from _pytest.monkeypatch import MonkeyPatch
from dotenv import load_dotenv

if TYPE_CHECKING:
    from app.model import ToxicityClassifier


@pytest.fixture(scope="session")
def classifier() -> "ToxicityClassifier":
    # Ensure environment variables are available before loading the model
    load_dotenv()
    from app.model import ToxicityClassifier

    # Session-scoped patch so we don't need the function-scoped monkeypatch fixture.
    mp = MonkeyPatch()

    # Avoid external downloads during tests by stubbing the model loader
    def _fake_load(self: "ToxicityClassifier") -> None:
        # Minimal stub: fixed response is sufficient for the smoke test and avoids HF downloads.
        def fake_pipeline(text, **kwargs):
            _ = kwargs  # mirror transformers pipeline signature
            if isinstance(text, (list, tuple)):
                return [{"label": "toxic", "score": 0.5} for _ in text]
            if isinstance(text, str):
                return [{"label": "toxic", "score": 0.5}]
            return []

        self._pipeline = fake_pipeline

    mp.setattr(ToxicityClassifier, "_load_model", _fake_load)

    instance = ToxicityClassifier()
    yield instance
    mp.undo()


def test_classifier_predicts(classifier: ToxicityClassifier) -> None:
    result = classifier.predict("Test text to check pipeline.")
    assert "label" in result and "score" in result
