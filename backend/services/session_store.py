"""In-memory session storage for uploaded DataFrames.

Each session is keyed by a UUID and holds the parsed DataFrame plus the
profile metadata produced by services.data_profiler. Sessions expire after
SESSION_TTL_MINUTES (lazy sweep on every create/get).
"""

import os
import threading
import uuid
from datetime import datetime, timedelta, timezone

import pandas as pd

_SESSIONS: dict[str, dict] = {}
_LOCK = threading.Lock()


def _ttl() -> timedelta:
    return timedelta(minutes=int(os.getenv("SESSION_TTL_MINUTES", "60")))


def _sweep_expired() -> None:
    # Caller must hold _LOCK.
    cutoff = datetime.now(timezone.utc) - _ttl()
    for sid in [sid for sid, s in _SESSIONS.items() if s["created_at"] < cutoff]:
        del _SESSIONS[sid]


def create_session(df: pd.DataFrame, filename: str, profile: dict) -> str:
    session_id = str(uuid.uuid4())
    with _LOCK:
        _sweep_expired()
        _SESSIONS[session_id] = {
            "df": df,
            "filename": filename,
            "column_meta": profile["column_meta"],
            "data_context": profile["data_context"],
            "created_at": datetime.now(timezone.utc),
        }
    return session_id


def get_session(session_id: str) -> dict | None:
    with _LOCK:
        _sweep_expired()
        return _SESSIONS.get(session_id)


def delete_session(session_id: str) -> None:
    with _LOCK:
        _SESSIONS.pop(session_id, None)


def session_count() -> int:
    with _LOCK:
        _sweep_expired()
        return len(_SESSIONS)
