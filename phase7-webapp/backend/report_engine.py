"""
LITHOS Phase 7 — Community Report Engine
Handles trust scoring, verification rules, and report management.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any
from mock_data import CELLS, ALL_REPORTS, _iso, _now

# In-memory report store (extends mock data)
_report_store: List[Dict] = list(ALL_REPORTS)
_user_report_counts: Dict[str, List[datetime]] = {}  # user_id -> list of report timestamps

REPORT_TYPES = [
    "active_landslide", "road_blocked", "debris_on_road",
    "cracks_visible", "mudflow", "warning_leaving_area"
]
SEVERITIES = ["minor", "serious", "life_threatening"]


def _haversine_km(lat1, lon1, lat2, lon2):
    import math
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return 6371 * 2 * math.asin(math.sqrt(a))


def _find_region(lat: float, lon: float) -> Optional[str]:
    from mock_data import ALL_REGIONS
    for key, reg in ALL_REGIONS.items():
        lon_min, lat_min, lon_max, lat_max = reg["bbox"]
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            return key
    return None


def _verify_report(report: Dict, region_cells: List[Dict]) -> bool:
    """
    Verification rules:
    1. Cell already RED → verify immediately
    2. 2+ reports same cell within 30 min → verify
    3. trust_score >= 4 → verify immediately
    """
    if report.get("trust_score", 1) >= 4.0:
        return True
    # Check if underlying cell is RED
    cell = None
    for c in region_cells:
        if c["cell_id"] == report.get("cell_id"):
            cell = c
            break
    if cell and cell["risk_level"] == "RED":
        return True
    # Check 2+ reports at same cell in last 30 min
    cutoff = _now() - timedelta(minutes=30)
    same_cell_reports = [
        r for r in _report_store
        if r.get("cell_id") == report.get("cell_id")
        and r["report_id"] != report["report_id"]
        and datetime.fromisoformat(r["timestamp"].replace("Z", "+00:00")) > cutoff
    ]
    if len(same_cell_reports) >= 1:
        return True
    return False


def check_rate_limit(user_id: str) -> bool:
    """Max 3 reports per user per hour. Returns True if allowed."""
    now = _now()
    cutoff = now - timedelta(hours=1)
    times = _user_report_counts.get(user_id, [])
    times = [t for t in times if t > cutoff]
    _user_report_counts[user_id] = times
    return len(times) < 3


def submit_report(
    lat: float, lon: float,
    report_type: str, severity: str,
    user_id: str,
    photo_base64: Optional[str] = None,
    description: Optional[str] = None,
) -> Dict[str, Any]:
    if report_type not in REPORT_TYPES:
        return {"error": f"Invalid report type. Choose from: {REPORT_TYPES}"}
    if severity not in SEVERITIES:
        return {"error": f"Invalid severity. Choose from: {SEVERITIES}"}
    if not check_rate_limit(user_id):
        return {"error": "Rate limit: max 3 reports per hour per user"}

    region_key = _find_region(lat, lon)
    if not region_key:
        return {"error": "Location is outside any monitored LITHOS region"}

    region_cells = CELLS.get(region_key, [])
    # Find nearest cell
    if region_cells:
        nearest_cell = min(region_cells, key=lambda c: _haversine_km(lat, lon, c["center_lat"], c["center_lon"]))
        cell_id = nearest_cell["cell_id"]
        lithos_score = nearest_cell["risk_score"]
        lithos_level = nearest_cell["risk_level"]
    else:
        cell_id = f"{region_key}_0000"
        lithos_score = 0.5
        lithos_level = "ORANGE"

    # Create report
    report_id = f"RPT_{uuid.uuid4().hex[:8].upper()}"
    trust_score = 1.0
    report = {
        "report_id": report_id,
        "user_id": user_id,
        "trust_score": trust_score,
        "type": report_type,
        "severity": severity,
        "lat": round(lat, 5),
        "lon": round(lon, 5),
        "region": region_key,
        "region_name": _find_region_name(region_key),
        "cell_id": cell_id,
        "timestamp": _iso(_now()),
        "confirmed_by": [],
        "confirm_count": 0,
        "verified": False,
        "resolved": False,
        "lithos_score": round(lithos_score, 3),
        "lithos_level": lithos_level,
        "users_alerted": 0,
        "description": description or report_type.replace("_", " ").title(),
        "has_photo": photo_base64 is not None,
    }

    # Check verification
    report["verified"] = _verify_report(report, region_cells)
    if report["verified"]:
        report["users_alerted"] = 150 if severity == "life_threatening" else 50

    _report_store.append(report)
    _user_report_counts.setdefault(user_id, []).append(_now())

    return {
        "report_id": report_id,
        "verified": report["verified"],
        "message": (
            "✅ Report verified! Alerting nearby users."
            if report["verified"]
            else "📍 Report submitted. Awaiting confirmation from other users."
        ),
        "lithos_agreement": lithos_level,
        "region": region_key,
    }


def confirm_report(report_id: str, user_id: str) -> Dict[str, Any]:
    for r in _report_store:
        if r["report_id"] == report_id:
            if user_id in r["confirmed_by"]:
                return {"message": "Already confirmed"}
            r["confirmed_by"].append(user_id)
            r["confirm_count"] += 1
            if r["confirm_count"] >= 2 and not r["verified"]:
                r["verified"] = True
                r["users_alerted"] = 200
            return {"report_id": report_id, "confirm_count": r["confirm_count"], "verified": r["verified"]}
    return {"error": "Report not found"}


def resolve_report(report_id: str) -> Dict[str, Any]:
    for r in _report_store:
        if r["report_id"] == report_id:
            r["resolved"] = True
            return {"report_id": report_id, "resolved": True}
    return {"error": "Report not found"}


def get_nearby_reports(lat: float, lon: float, radius_km: float = 10) -> List[Dict]:
    return [
        r for r in _report_store
        if not r["resolved"]
        and _haversine_km(lat, lon, r["lat"], r["lon"]) <= radius_km
    ]


def get_all_reports() -> List[Dict]:
    return sorted(_report_store, key=lambda r: r["timestamp"], reverse=True)


def _find_region_name(region_key: str) -> str:
    from mock_data import ALL_REGIONS
    return ALL_REGIONS.get(region_key, {}).get("name", region_key)
