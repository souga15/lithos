"""
sos_service.py
Handles SOS emergency broadcasts via WebSocket + logs to JSON file.
No SMS — WebSocket broadcast only (SMS skipped per user request).
"""
import json
import os
from datetime import datetime, timezone

SOS_LOG_PATH = os.path.join(os.path.dirname(__file__), "sos_log.json")


def _load_log():
    if os.path.exists(SOS_LOG_PATH):
        try:
            with open(SOS_LOG_PATH) as f:
                return json.load(f)
        except Exception:
            pass
    return []


def _save_log(log):
    try:
        with open(SOS_LOG_PATH, "w") as f:
            json.dump(log[-200:], f, indent=2)  # keep last 200 entries
    except Exception as e:
        print(f"⚠️  SOS log write failed: {e}")


def log_sos_event(lat: float, lon: float, region: str, message: str) -> dict:
    """Log SOS to disk and return the event dict for WebSocket broadcast."""
    event = {
        "sos_id":    f"sos_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        "lat":       lat,
        "lon":       lon,
        "region":    region,
        "message":   message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status":    "active",
    }
    log = _load_log()
    log.append(event)
    _save_log(log)
    print(f"🆘 SOS EVENT: {event['sos_id']} @ ({lat:.4f}, {lon:.4f}) — {region}")
    return event


def get_sos_log(limit: int = 50) -> list:
    """Return most recent SOS events for admin dashboard."""
    return list(reversed(_load_log()))[:limit]
