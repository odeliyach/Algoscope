import pytest
from dotenv import load_dotenv

from app.model import ToxicityClassifier

load_dotenv()


@pytest.fixture(scope="session")
def classifier() -> ToxicityClassifier:
    # Session-scoped to avoid multiple heavy model loads during collection
    return ToxicityClassifier()


def test_classifier_predicts(classifier: ToxicityClassifier) -> None:
    result = classifier.predict("Test text to check pipeline.")
    assert "label" in result and "score" in result
