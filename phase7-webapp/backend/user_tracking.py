"""
user_tracking.py
Anonymous real-time vehicle position tracking via WebSocket broadcast.
Stores positions with 10-minute TTL. No user IDs — fully anonymous.
"""
import asyncio
import time
from typing import Dict, Tuple

# In-memory store: session_id -> {lat, lon, risk, timestamp}
_positions: Dict[str, dict] = {}
_TTL_SECONDS = 600  # 10 minutes


def update_position(session_id: str, lat: float, lon: float, risk: str = "GREEN"):
    _positions[session_id] = {
        "lat":  lat,
        "lon":  lon,
        "risk": risk,
        "ts":   time.time(),
    }


def get_active_positions() -> list:
    now    = time.time()
    active = []
    stale  = []
    for sid, pos in _positions.items():
        if now - pos["ts"] < _TTL_SECONDS:
            active.append({"lat": pos["lat"], "lon": pos["lon"], "risk": pos["risk"]})
        else:
            stale.append(sid)
    for sid in stale:
        _positions.pop(sid, None)
    return active


def get_zone_counts() -> dict:
    """Count active users per risk zone — for admin dashboard."""
    active = get_active_positions()
    counts = {"RED": 0, "ORANGE": 0, "GREEN": 0, "total": len(active)}
    for p in active:
        counts[p.get("risk", "GREEN")] += 1
    return counts
