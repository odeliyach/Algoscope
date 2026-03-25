from __future__ import annotations

import importlib


def test_dashboard_imports(monkeypatch) -> None:
    # Avoid heavy model load during import by stubbing the classifier
    from app import model as model_module

    class DummyClassifier:
        def __init__(self) -> None: ...

        def predict(self, text: str) -> dict:
            return {"label": "non-toxic", "score": 0.0}

        def predict_batch(self, texts: list[str]) -> list[dict]:
            return [{"label": "non-toxic", "score": 0.0} for _ in texts]

    monkeypatch.setattr(model_module, "ToxicityClassifier", DummyClassifier)

    dashboard = importlib.import_module("dashboard")
    assert dashboard is not None
