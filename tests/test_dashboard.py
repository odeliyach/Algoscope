from __future__ import annotations

import importlib


def test_dashboard_imports(monkeypatch) -> None:
    # Avoid heavy model load during import by stubbing the classifier
    from app import model as model_module

    class DummyClassifier:
        def __init__(self) -> None: ...

    monkeypatch.setattr(model_module, "ToxicityClassifier", DummyClassifier)

    dashboard = importlib.reload(importlib.import_module("dashboard"))
    assert dashboard is not None
