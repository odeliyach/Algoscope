"""
FastAPI backend for AlgoScope toxicity detection.

ARCHITECTURE NOTE (interview talking point):
This file is the boundary between the ML layer and the outside world.
The React frontend talks exclusively to these endpoints — it has no direct
access to the database, the model, or the Bluesky client. That separation
means you can swap any layer (swap SQLite for Postgres, swap the model,
swap the frontend framework) without touching the others.
"""

import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

from app.database import get_post_count, get_recent_posts, save_post, seed_if_empty
from app.graph import build_cooccurrence_graph
from app.ingestion import ALGOSPEAK_QUERIES, fetch_posts
from app.model import ToxicityClassifier

logger = logging.getLogger(__name__)

# Load local environment variables for Bluesky credentials in development.
load_dotenv()

# WHY None here: initializing ToxicityClassifier() at module scope triggers
# a 250MB model download before uvicorn binds to port 7860. HuggingFace Spaces
# sees no response on the port and kills the container with no logs.
# We initialize inside lifespan() instead, after the server is already up.
classifier: ToxicityClassifier | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global classifier
    logger.info("AlgoScope API starting up")
    try:
        classifier = ToxicityClassifier()
        logger.info("ToxicityClassifier ready")
    except Exception as exc:
        logger.warning("Model load failed — predictions will return defaults: %s", exc)
        classifier = None
    try:
        seed_if_empty()
        logger.info("DB seed check complete")
    except Exception as exc:
        logger.warning("Seed skipped (likely missing credentials): %s", exc)
    yield
    logger.info("AlgoScope API shutting down")


app = FastAPI(
    title="AlgoScope API",
    description="Real-time algospeak and toxicity detection for Bluesky posts.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    text: str


class PredictResponse(BaseModel):
    label: str
    score: float


class FetchRequest(BaseModel):
    queries: list[str] = ALGOSPEAK_QUERIES
    limit: int = 25
    threshold: float = 0.70


class PostOut(BaseModel):
    id: int
    text: str
    label: str
    score: float
    platform: str
    created_at: str
    query_term: str = ""


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness check — used by HuggingFace Spaces and load balancers."""
    return {"status": "ok"}


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest) -> dict[str, str | float]:
    """Classify a single text as toxic or non-toxic."""
    if classifier is None:
        return {"label": "non-toxic", "score": 0.0}
    logger.info("Predicting for text (len=%d)", len(request.text))
    result = classifier.predict(request.text)
    logger.info("Result: label=%s score=%.3f", result["label"], result["score"])
    return {"label": result["label"], "score": result["score"]}


@app.get("/posts")
def get_posts(
    limit: int = Query(default=100, ge=1, le=10000),
) -> dict[str, Any]:
    """Return recent posts from the database for the React frontend."""
    rows = get_recent_posts(limit=limit)
    for row in rows:
        if "query_term" not in row:
            row["query_term"] = ""
        if not row.get("created_at"):
            row["created_at"] = ""
    # WHY get_post_count() instead of len(rows):
    # rows is capped at `limit`, so len(rows) always equals min(limit, n_posts).
    # The frontend calls GET /posts?limit=1 to get the true total for the
    # "Posts Analyzed" counter — returning len(rows)=1 there was causing
    # the counter to reset to 1 after every fetch.
    return {"posts": rows, "total": get_post_count()}


@app.post("/fetch-and-analyze")
def fetch_and_analyze(request: FetchRequest) -> dict[str, Any]:
    """
    Fetch posts from Bluesky, run batch inference, save to DB, return results.
    """
    if classifier is None:
        return {"posts": [], "fetch_time": 0.0, "infer_time": 0.0, "count": 0,
                "message": "Model not loaded yet, please try again in a moment."}

    logger.info(
        "fetch-and-analyze: queries=%s limit=%d threshold=%.2f",
        request.queries, request.limit, request.threshold,
    )

    t0 = time.time()
    posts_text = fetch_posts(
        query=request.queries[0] if request.queries else "unalive",
        limit=request.limit,
        queries=request.queries or None,
    )
    fetch_time = time.time() - t0

    if not posts_text:
        return {
            "posts": [],
            "fetch_time": fetch_time,
            "infer_time": 0.0,
            "count": 0,
            "message": "No posts fetched. Check Bluesky credentials or try again.",
        }

    texts_only = [text for text, _ts in posts_text]
    timestamps = [ts for _text, ts in posts_text]

    t1 = time.time()
    predictions = classifier.predict_batch(texts_only)
    infer_time = time.time() - t1

    batch_ts_iso = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())
    result_posts: list[dict[str, Any]] = []

    for i, (text, post_ts, pred) in enumerate(zip(texts_only, timestamps, predictions)):
        score = float(pred.get("score", 0.0) or 0.0)
        label = "toxic" if score >= request.threshold else "non-toxic"
        matched_term = next(
            (t for t in request.queries if t and t.lower() in text.lower()),
            request.queries[0] if request.queries else "",
        )
        save_post(text=text, label=label, score=score, platform="bluesky", query_term=matched_term)
        result_posts.append({
            "id": int(time.time() * 1000) + i,
            "text": text,
            "label": label,
            "score": score,
            "platform": "bluesky",
            "created_at": post_ts or batch_ts_iso,
            "query_term": matched_term,
        })

    logger.info(
        "fetch-and-analyze: %d posts, fetch=%.2fs infer=%.2fs",
        len(result_posts), fetch_time, infer_time,
    )

    return {
        "posts": result_posts,
        "fetch_time": fetch_time,
        "infer_time": infer_time,
        "count": len(result_posts),
    }


@app.get("/graph-data")
def graph_data(
    min_cooccurrence: int = Query(default=2, ge=1, le=20),
    toxic_only: bool = Query(default=False),
) -> dict[str, Any]:
    """Return co-occurrence graph as JSON nodes + edges."""
    graph = build_cooccurrence_graph(min_cooccurrence=min_cooccurrence)

    nodes = []
    for node, data in graph.nodes(data=True):
        count = int(data.get("count", 1) or 1)
        toxic_count = int(data.get("toxic_count", 0) or 0)
        toxic_ratio = toxic_count / count if count else 0.0
        if toxic_only and toxic_count == 0:
            continue
        nodes.append({
            "id": node,
            "count": count,
            "toxic_count": toxic_count,
            "toxic_ratio": round(toxic_ratio, 3),
        })

    included = {n["id"] for n in nodes}
    edges = [
        {"source": u, "target": v, "weight": int(data.get("weight", 1) or 1)}
        for u, v, data in graph.edges(data=True)
        if u in included and v in included
    ]

    return {"nodes": nodes, "edges": edges, "node_count": len(nodes), "edge_count": len(edges)}


@app.get("/stats")
def stats() -> dict[str, Any]:
    """Aggregate statistics for the Overview tab metric cards."""
    rows = get_recent_posts(limit=100_000)
    total = len(rows)
    toxic = sum(1 for r in rows if (r.get("label") or "").lower() == "toxic")
    term_counts: dict[str, int] = {}
    for row in rows:
        term = row.get("query_term") or ""
        if term:
            term_counts[term] = term_counts.get(term, 0) + 1
    return {
        "total_posts": total,
        "toxic_posts": toxic,
        "toxic_rate": round(toxic / total * 100, 2) if total else 0.0,
        "term_counts": term_counts,
    }


# ── Static file serving (React build) ─────────────────────────────────────────
_FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(_FRONTEND_DIST):
    _assets_dir = os.path.join(_FRONTEND_DIST, "assets")
    if os.path.exists(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/", response_class=FileResponse, include_in_schema=False)
    def serve_frontend_root():
        return FileResponse(os.path.join(_FRONTEND_DIST, "index.html"))

    @app.get("/{full_path:path}", response_class=FileResponse, include_in_schema=False)
    def serve_frontend_spa(full_path: str):
        """Catch-all for React Router — prevents 404 on page refresh."""
        return FileResponse(os.path.join(_FRONTEND_DIST, "index.html"))
