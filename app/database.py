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
    Intentionally disabled — auto-seeding on startup caused the container
    to crash before uvicorn could bind to port 7860, resulting in no logs
    on HuggingFace Spaces. The frontend fetches data on demand instead.
    """
    logger.info("seed_if_empty: skipped (disabled for HF Spaces stability)")
