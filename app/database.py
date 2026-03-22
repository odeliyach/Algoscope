"""
SQLite database for storing post classification results.
"""

import os
import sqlite3
from typing import Any

# Project root is parent of app/
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# WHY public DB_PATH: tests need to override this with a temp path.
# WHY /tmp fallback: on HuggingFace Spaces the app runs as a non-root user
# who has no write permission to /app. /tmp is always writable in any
# container environment. Data resets on Space restart — acceptable for a
# portfolio demo where data is re-fetched on demand anyway.
DB_PATH = os.environ.get(
    "ALGOSCOPE_DB_PATH",
    os.path.join(os.environ.get("TMPDIR", "/tmp"), "algoscope.db")
)

# WHY module-level flag: _init_db() was called on every save/read.
# At 1000 posts/session that's 2000 redundant CREATE TABLE IF NOT EXISTS
# SQL round-trips. One boolean check per call is much cheaper.
_db_initialized = False


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create the posts table if it does not exist."""
    with _get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                label TEXT NOT NULL,
                score REAL NOT NULL,
                platform TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()


def _ensure_init() -> None:
    """Initialize DB once per process, not on every call."""
    global _db_initialized
    if not _db_initialized:
        init_db()
        _db_initialized = True


def save_post(text: str, label: str, score: float, platform: str) -> None:
    """Insert a classified post into the posts table."""
    _ensure_init()
    with _get_connection() as conn:
        conn.execute(
            "INSERT INTO posts (text, label, score, platform) VALUES (?, ?, ?, ?)",
            (text, label, score, platform),
        )
        conn.commit()


def get_recent_posts(limit: int = 100) -> list[dict[str, Any]]:
    """Return the most recent posts as a list of dicts, newest first."""
    _ensure_init()
    with _get_connection() as conn:
        cursor = conn.execute(
            "SELECT id, text, label, score, platform, created_at FROM posts ORDER BY created_at DESC LIMIT ?",
            (limit,),
        )
        rows = cursor.fetchall()
    return [dict(row) for row in rows]
