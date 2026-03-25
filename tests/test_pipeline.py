from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from dotenv import load_dotenv

if TYPE_CHECKING:
    from app.model import ToxicityClassifier


@pytest.fixture()
def classifier(monkeypatch) -> "ToxicityClassifier":
    # Ensure environment variables are available before loading the model
    load_dotenv()
    from app.model import ToxicityClassifier

    # Avoid external downloads during tests by stubbing the model loader
    def _fake_load(self: "ToxicityClassifier") -> None:
        self._pipeline = lambda text, truncation=True, max_length=512: [
            {"label": "toxic", "score": 0.5}
        ]

    monkeypatch.setattr(ToxicityClassifier, "_load_model", _fake_load)

    # Function-scoped so each test gets the stubbed loader without sharing state
    return ToxicityClassifier()


def test_classifier_predicts(classifier: ToxicityClassifier) -> None:
    result = classifier.predict("Test text to check pipeline.")
    assert "label" in result and "score" in result
