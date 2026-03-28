"""
SQLite database for storing post classification results.

ARCHITECTURE NOTE (interview talking point):
All persistence is isolated in this file. No other module imports sqlite3
directly. This means swapping SQLite for PostgreSQL or any other store
requires changing only this one file — the rest of the codebase is
completely unaware of how data is stored.
"""

import logging
import os
import sqlite3
from typing import Any

logger = logging.getLogger(__name__)

_temp_dir = os.environ.get("TMPDIR")
if not _temp_dir:
    _temp_dir = os.environ.get("TEMP") or os.environ.get("TMP") or "/tmp"
DB_PATH = os.environ.get(
    "ALGOSCOPE_DB_PATH",
    os.path.join(_temp_dir, "algoscope.db"),
)

_db_initialized = False


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create tables if they don't exist. Safe to call multiple times."""
    with _get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS posts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                text        TEXT    NOT NULL,
                label       TEXT    NOT NULL,
                score       REAL    NOT NULL,
                platform    TEXT    NOT NULL,
                query_term  TEXT    NOT NULL DEFAULT '',
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        try:
            conn.execute("ALTER TABLE posts ADD COLUMN query_term TEXT NOT NULL DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        conn.commit()


def _ensure_init() -> None:
    """Initialize DB once per process, not on every call."""
    global _db_initialized
    if not _db_initialized:
        init_db()
        _db_initialized = True


def save_post(
    text: str,
    label: str,
    score: float,
    platform: str,
    query_term: str = "",
) -> None:
    """Insert a classified post into the posts table."""
    _ensure_init()
    with _get_connection() as conn:
        conn.execute(
            "INSERT INTO posts (text, label, score, platform, query_term) VALUES (?, ?, ?, ?, ?)",
            (text, label, score, platform, query_term),
        )
        conn.commit()


def get_recent_posts(limit: int = 100) -> list[dict[str, Any]]:
    """Return the most recent posts as a list of dicts, newest first."""
    _ensure_init()
    with _get_connection() as conn:
        cursor = conn.execute(
            """
            SELECT id, text, label, score, platform, query_term, created_at
            FROM posts
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = cursor.fetchall()
    return [dict(row) for row in rows]


def get_post_count() -> int:
    """Return total number of posts in the DB."""
    _ensure_init()
    with _get_connection() as conn:
        return conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]


def seed_if_empty() -> None:
    """
    If the DB is empty (cold start or HF ephemeral filesystem wipe), fetch
    a small batch of real posts from Bluesky and classify them so the
    dashboard has data immediately without requiring the user to click FETCH.

    WHY this is safe now (it was disabled before):
    Previously this ran at module import time, triggering a model download
    before uvicorn bound to port 7860, killing the container with no logs.
    Now it is called from lifespan() AFTER the server is up and AFTER the
    classifier has loaded. A failure here is non-fatal.

    WHY 4 queries at limit=32 (not all queries at full limit):
    Seeding is best-effort background work. ~30 posts is enough to populate
    all dashboard widgets. Seeding all queries would add 10-30s to cold
    start time, unacceptable for a free-tier Space that restarts often.
    """
    _ensure_init()
    count = get_post_count()
    if count > 0:
        logger.info("seed_if_empty: DB has %d posts, skipping seed", count)
        return

    logger.info("seed_if_empty: DB is empty, seeding from Bluesky...")
    try:
        from app.ingestion import ALGOSPEAK_QUERIES, fetch_posts
        from app.model import ToxicityClassifier

        classifier = ToxicityClassifier()
        if classifier._pipeline is None:
            logger.warning("seed_if_empty: classifier not ready, skipping seed")
            return

        seed_queries = ALGOSPEAK_QUERIES[:4]
        posts = fetch_posts(query=seed_queries[0], limit=32, queries=seed_queries)
        if not posts:
            logger.warning("seed_if_empty: no posts returned from Bluesky")
            return

        texts = [t for t, _ in posts]
        timestamps = [ts for _, ts in posts]
        predictions = classifier.predict_batch(texts)

        for text, ts, pred in zip(texts, timestamps, predictions):
            score = float(pred.get("score", 0.0) or 0.0)
            label = "toxic" if score >= 0.70 else "non-toxic"
            matched = next(
                (q for q in seed_queries if q and q.lower() in text.lower()),
                seed_queries[0],
            )
            save_post(text=text, label=label, score=score, platform="bluesky", query_term=matched)

        logger.info("seed_if_empty: seeded %d posts", len(texts))
    except Exception as exc:
        # WHY catch-all: Bluesky credentials may not be set, the network may
        # be unavailable, or the model may not have loaded. The app must start
        # regardless - the user can always click FETCH manually.
        logger.warning("seed_if_empty: failed (non-fatal): %s", exc)
