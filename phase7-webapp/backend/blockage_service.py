"""
blockage_service.py
Crowd-sourced road blockage reports.
Stores blockages with auto-expiry (4 hours).
Provides GeoJSON output for map overlay.
"""
import json
import os
from datetime import datetime, timezone, timedelta

BLOCKAGE_PATH = os.path.join(os.path.dirname(__file__), "blockages.json")
EXPIRY_HOURS  = 4


def _load() -> list:
    if os.path.exists(BLOCKAGE_PATH):
        try:
            with open(BLOCKAGE_PATH) as f:
                return json.load(f)
        except Exception:
            pass
    return []


def _save(data: list):
    try:
        with open(BLOCKAGE_PATH, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"⚠️  Blockage save error: {e}")


def _is_active(b: dict) -> bool:
    try:
        expires = datetime.fromisoformat(b["expires_at"])
        return datetime.now(timezone.utc) < expires
    except Exception:
        return False


def add_blockage(lat: float, lon: float, message: str = "Road blocked") -> dict:
    now     = datetime.now(timezone.utc)
    expires = now + timedelta(hours=EXPIRY_HOURS)
    entry   = {
        "id":         f"blk_{now.strftime('%Y%m%d_%H%M%S')}",
        "lat":        lat,
        "lon":        lon,
        "message":    message,
        "reported_at":now.isoformat(),
        "expires_at": expires.isoformat(),
        "confirm_count": 1,
    }
    data = [b for b in _load() if _is_active(b)]  # prune expired
    data.append(entry)
    _save(data)
    print(f"🚧 BLOCKAGE reported at ({lat:.4f}, {lon:.4f}) — expires {expires.strftime('%H:%M')}")
    return entry


def get_active_blockages() -> list:
    return [b for b in _load() if _is_active(b)]


def get_blockages_geojson() -> dict:
    blockages = get_active_blockages()
    features  = []
    for b in blockages:
        features.append({
            "type": "Feature",
            "geometry": {
                "type":        "Point",
                "coordinates": [b["lon"], b["lat"]],
            },
            "properties": {
                "id":            b["id"],
                "message":       b["message"],
                "reported_at":   b["reported_at"],
                "expires_at":    b["expires_at"],
                "confirm_count": b.get("confirm_count", 1),
            },
        })
    return {"type": "FeatureCollection", "features": features}


def confirm_blockage(blockage_id: str) -> bool:
    data = _load()
    for b in data:
        if b["id"] == blockage_id and _is_active(b):
            b["confirm_count"] = b.get("confirm_count", 1) + 1
            _save(data)
            return True
    return False
