"""
FastAPI backend for AlgoScope toxicity detection.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AlgoScope API",
    description="Real-time algospeak and toxicity detection for Bluesky posts.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WHY module-level: ToxicityClassifier uses the singleton pattern so the
# model loads once at startup and stays in memory for all requests.
# Without this, every /predict call would reload 250MB from disk (~2s latency).
from app.model import ToxicityClassifier
classifier = ToxicityClassifier()
logger.info("ToxicityClassifier loaded and ready")


class PredictRequest(BaseModel):
    text: str


class PredictResponse(BaseModel):
    label: str
    score: float


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness check — used by HuggingFace Spaces and load balancers."""
    return {"status": "ok"}


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest) -> dict[str, str | float]:
    """
    Classify a single text as toxic or non-toxic.

    Args:
        request: PredictRequest with a text field.

    Returns:
        label ("toxic" or "non-toxic") and score (float 0-1).
    """
    logger.info("Predicting for text (len=%d)", len(request.text))
    result = classifier.predict(request.text)
    logger.info("Result: label=%s score=%.3f", result["label"], result["score"])
    return {"label": result["label"], "score": result["score"]}