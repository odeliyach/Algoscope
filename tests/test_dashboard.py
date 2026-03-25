from __future__ import annotations

import importlib


def test_dashboard_imports(monkeypatch) -> None:
    # Avoid heavy model load during import by stubbing the classifier
    from app import model as model_module

    class DummyClassifier:
        @staticmethod
        def _get_default_response() -> dict:
            return {"label": "non-toxic", "score": 0.0}

        def __init__(self) -> None:
            pass

        def predict(self, text: str) -> dict:
            return self._get_default_response()

        def predict_batch(self, texts: list[str]) -> list[dict]:
            return [self._get_default_response() for _ in texts]

    monkeypatch.setattr(model_module, "ToxicityClassifier", DummyClassifier)

    dashboard = importlib.import_module("dashboard")
    assert dashboard is not None
