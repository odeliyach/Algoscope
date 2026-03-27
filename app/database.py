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

# WHY /tmp fallback:
# HuggingFace Spaces runs as a non-root user with no write permission to /app.
# /tmp is always writable in any container environment.
#
# WHY this doesn't fully solve the persistence problem:
# /tmp is ephemeral — it resets every time the Space restarts (which happens
# after every period of inactivity on the free tier). This is why we have
# seed_if_empty() below: it re-fetches a small dataset on cold start so the
# dashboard is never completely blank.
#
# Windows compatibility: Use proper temp directory detection for all platforms.
_temp_dir = os.environ.get("TMPDIR")
if not _temp_dir:
    _temp_dir = os.environ.get("TEMP") or os.environ.get("TMP") or "/tmp"
DB_PATH = os.environ.get(
    "ALGOSCOPE_DB_PATH",
    os.path.join(_temp_dir, "algoscope.db"),
)

# WHY module-level flag instead of calling init_db() every time:
# _ensure_init() was previously called on every save/read. At 1000 posts/session
# that's 2000 redundant CREATE TABLE IF NOT EXISTS round-trips. One boolean
# check per call costs a nanosecond instead of a SQLite lock acquisition.
_db_initialized = False


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    # WHY row_factory: makes fetchall() return dict-like objects instead of
    # plain tuples, so callers can write row["label"] instead of row[1].
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
        # WHY run this migration separately:
        # The original schema didn't have query_term. Users who already have
        # a DB on disk (local dev) would crash without this ALTER TABLE.
        # SQLite doesn't support IF NOT EXISTS on ALTER TABLE, so we catch
        # the "duplicate column" error and ignore it — that's the standard
        # SQLite migration pattern for adding a single column.
        try:
            conn.execute("ALTER TABLE posts ADD COLUMN query_term TEXT NOT NULL DEFAULT ''")
        except sqlite3.OperationalError:
            pass  # Column already exists — expected on all non-fresh DBs

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
    """Return total number of posts in the DB. Used by seed_if_empty."""
    _ensure_init()
    with _get_connection() as conn:
        return conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]


def seed_if_empty() -> None:
    """
    Fetch a small seed batch from Bluesky if the DB is empty.

    WHY this exists:
    HuggingFace Spaces free tier has an ephemeral filesystem. Every cold start
    wipes /tmp and the SQLite DB with it. Without seeding, every new visitor
    sees a blank dashboard and has to manually click 'Fetch & Analyze'.

    WHY we import inside the function:
    Importing fetch_posts and ToxicityClassifier at module level would create
    a circular import (database.py <- ingestion.py uses database.py).
    Deferred imports inside the function body avoid this entirely.

    WHY we catch Exception broadly:
    If Bluesky credentials aren't set (local dev without .env, or the Space
    hasn't been configured yet), the fetch will fail. We log the warning and
    continue — the app still starts, the dashboard just begins empty.
    """
    if get_post_count() > 0:
        logger.info("seed_if_empty: DB already has posts, skipping")
        return

    logger.info("seed_if_empty: DB is empty, fetching seed posts from Bluesky")

    try:
        from app.ingestion import ALGOSPEAK_QUERIES, fetch_posts
        from app.model import ToxicityClassifier

        classifier = ToxicityClassifier()

        seed_posts = fetch_posts(
            query=ALGOSPEAK_QUERIES[0],
            limit=30,
            queries=ALGOSPEAK_QUERIES[:4],
        )

        if not seed_posts:
            logger.warning("seed_if_empty: Bluesky returned no posts")
            return

        predictions = classifier.predict_batch(seed_posts)

        for text, pred in zip(seed_posts, predictions):
            score = float(pred.get("score", 0.0) or 0.0)
            label = "toxic" if score >= 0.70 else "non-toxic"
            matched_term = next(
                (t for t in ALGOSPEAK_QUERIES[:4] if t.lower() in text.lower()),
                ALGOSPEAK_QUERIES[0],
            )
            save_post(
                text=text,
                label=label,
                score=score,
                platform="bluesky",
                query_term=matched_term,
            )

        logger.info("seed_if_empty: seeded %d posts", len(seed_posts))

    except Exception as exc:
        logger.warning("seed_if_empty: failed (%s) — app will start with empty DB", exc)
