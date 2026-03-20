"""
SQLite database for storing post classification results.
"""

import os
import sqlite3
from typing import Any

# Project root is parent of app/
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_DB_PATH = os.path.join(_PROJECT_ROOT, "algoscope.db")


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
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


def save_post(text: str, label: str, score: float, platform: str) -> None:
    """Insert a classified post into the posts table."""
    _init_db()
    with _get_connection() as conn:
        conn.execute(
            "INSERT INTO posts (text, label, score, platform) VALUES (?, ?, ?, ?)",
            (text, label, score, platform),
        )
        conn.commit()


def get_recent_posts(limit: int = 100) -> list[dict[str, Any]]:
    """Return the most recent posts as a list of dicts, newest first."""
    _init_db()
    with _get_connection() as conn:
        cursor = conn.execute(
            "SELECT id, text, label, score, platform, created_at FROM posts ORDER BY created_at DESC LIMIT ?",
            (limit,),
        )
        rows = cursor.fetchall()
    return [dict(row) for row in rows]
