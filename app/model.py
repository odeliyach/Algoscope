"""
Toxicity classifier using the AlgoShield-Algospeak-Detection HuggingFace model.
"""

from typing import Any
import logging

logger = logging.getLogger(__name__)


class ToxicityClassifier:
    """
    Wrapper around the fine-tuned DistilBERT toxicity model.

    WHY lazy loading: calling _load_model() inside __init__ triggers a 250MB
    model download at import time, before uvicorn binds to port 7860.
    HuggingFace Spaces sees no response and kills the container with no logs.
    Instead, main.py calls _load_model() explicitly inside lifespan(), after
    the server is already up and logging.
    """

    def __init__(self) -> None:
        self._pipeline = None

    def _load_model(self) -> None:
        """Load the HuggingFace pipeline. Called once by lifespan() in main.py."""
        if self._pipeline is not None:
            return

        try:
            import torch  # noqa: F401
            from transformers import pipeline

            logger.info("Loading AlgoShield-Algospeak-Detection model...")
            self._pipeline = pipeline(
                "text-classification",
                model="odeliyach/AlgoShield-Algospeak-Detection",
            )
            logger.info("Model loaded successfully")
        except Exception as exc:
            logger.error("Failed to load model: %s", exc, exc_info=True)
            self._pipeline = None

    def predict(self, text: str) -> dict[str, Any]:
        """Classify a single text as toxic or non-toxic."""
        default: dict[str, Any] = {"label": "non-toxic", "score": 0.0}

        if not text or not text.strip():
            return default

        try:
            if self._pipeline is None:
                logger.error("Pipeline is None — model was not loaded correctly")
                return default

            results = self._pipeline(text, truncation=True, max_length=512)
            if not results:
                return default

            raw = results[0]
            raw_label = str(raw.get("label", "")).lower()
            raw_score = float(raw.get("score", 0.0))

            if "toxic" in raw_label or raw_label in ("1", "label_1", "positive"):
                label = "toxic"
            else:
                label = "non-toxic"

            return {"label": label, "score": raw_score}

        except Exception as exc:
            logger.error("predict() failed: %s", exc, exc_info=True)
            return default

    def predict_batch(self, texts: list[str]) -> list[dict[str, Any]]:
        """Classify a list of texts in a single forward pass."""
        if not texts:
            return []

        cleaned = [t for t in texts if isinstance(t, str) and t.strip()]
        if not cleaned or self._pipeline is None:
            return []

        try:
            outputs = self._pipeline(cleaned, truncation=True, max_length=512)
        except Exception as exc:
            logger.error("predict_batch() failed: %s", exc, exc_info=True)
            return []

        results: list[dict[str, Any]] = []
        for raw in outputs:
            raw_label = str(raw.get("label", "")).lower()
            raw_score = float(raw.get("score", 0.0))

            if "toxic" in raw_label or raw_label in ("1", "label_1", "positive"):
                label = "toxic"
            else:
                label = "non-toxic"

            results.append({"label": label, "score": raw_score})

        logger.info("predict_batch: classified %d texts", len(results))
        return results
