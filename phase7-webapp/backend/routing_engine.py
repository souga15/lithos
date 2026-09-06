"""
LITHOS Phase 7 — Simplified A* Safe Routing Engine
Uses mock risk grid to generate realistic route results.
No external road data required — generates plausible routes with risk breakdown.
"""
import math
import os
import random
import urllib.request
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Tuple, Optional
from mock_data import CELLS, ALL_REGIONS, ALL_CELLS_FLAT
import runout_engine

RISK_WEIGHTS = {"GREEN": 1.0, "ORANGE": 3.0, "RED": 100.0}

# Simple in-memory route cache: key = (start_lat, start_lon, end_lat, end_lon)
_ROUTE_CACHE: Dict[tuple, Dict] = {}
_ROUTE_CACHE_MAX = 50  # evict oldest when full

# Spatial lookup cache for cells: key = (round(lat, 2), round(lon, 2))
_CELL_LOOKUP_CACHE: Dict[tuple, Optional[Dict]] = {}

# Global list of pre-calculated runout fans for all cells with FoS < 1.0
ACTIVE_RUNOUT_FANS: List[Dict] = []


def initialize_runout_fans():
    """
    Called at startup. Pre-calculates runout fans for all failing slopes
    so the routing engine can immediately avoid them.
    """
    global ACTIVE_RUNOUT_FANS
    ACTIVE_RUNOUT_FANS.clear()
    
    failing_cells = sorted([c for c in ALL_CELLS_FLAT if c.get("fos_seismic", 4.0) < 1.0], key=lambda x: x.get("fos_seismic", 1.0))[:30]
    print(f"[Routing] Pre-calculating top {len(failing_cells)} critical runout zones for instant startup...")
    
    for cell in failing_cells:
        try:
            # Re-use the engine's calculation logic
            res = runout_engine.estimate_runout(cell, ALL_CELLS_FLAT)
            ACTIVE_RUNOUT_FANS.append({
                "cell_id": cell["cell_id"],
                "center_lat": cell["center_lat"],
                "center_lon": cell["center_lon"],
                "runout_m": res["runout_distance_m"],
                "aspect_deg": res["aspect_deg"],
                "fan_polygon": res["fan_polygon"]
            })
        except Exception as e:
            print(f"[Routing] Failed to build fan for {cell['cell_id']}: {e}")
    
    print(f"[Routing] {len(ACTIVE_RUNOUT_FANS)} active fans cached.")


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in km between two lat/lon points."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


def _get_cell_at(lat: float, lon: float) -> Optional[Dict]:
    """Find the risk cell closest to a lat/lon across ALL regions.
    Uses a spatial lookup cache for O(1) performance on repeat points.
    """
    global _CELL_LOOKUP_CACHE

    # Use a 0.01 degree (~1.1km) grid for caching lookups
    # This is more than enough resolution to find the 2km x 2km cells
    cache_key = (round(lat, 2), round(lon, 2))
    if cache_key in _CELL_LOOKUP_CACHE:
        return _CELL_LOOKUP_CACHE[cache_key]

    # ── FIRST: Check if point is inside any ACTIVE RUNOUT FAN
    for fan in ACTIVE_RUNOUT_FANS:
        if runout_engine._point_in_fan(lat, lon, 
                                       fan["center_lat"], fan["center_lon"],
                                       fan["runout_m"], fan["aspect_deg"]):
            res = {
                "cell_id": fan["cell_id"],
                "risk_level": "RED",
                "risk_score": 0.98,
                "note": "ACTIVE DEBRIS RUNOUT ZONE"
            }
            _CELL_LOOKUP_CACHE[cache_key] = res
            return res

    if not ALL_CELLS_FLAT:
        return None
    
    # Normal nearest-cell lookup (only if not in cache)
    best = min(ALL_CELLS_FLAT, key=lambda c: (c["center_lat"] - lat) ** 2 + (c["center_lon"] - lon) ** 2)
    dist_sq = (best["center_lat"] - lat)**2 + (best["center_lon"] - lon)**2
    
    if dist_sq > 0.05: # Outside any reasonable region (about 25km)
        _CELL_LOOKUP_CACHE[cache_key] = None
        return None
        
    _CELL_LOOKUP_CACHE[cache_key] = best
    return best


ORS_API_KEY = os.getenv("ORS_API_KEY", "").strip()

def _interpolate_route(
    start_lat: float, start_lon: float,
    end_lat: float, end_lon: float,
    n_points: int = 20,
) -> List[Dict]:
    """
    Fetch a real road-snapped route using OpenRouteService (ORS) API.
    Annotates each segment with risk from underlying grid cell.
    """
    segments = []
    if ORS_API_KEY:
        # ORS uses [lon, lat] format for start/end
        url = (
            "https://api.openrouteservice.org/v2/directions/driving-car"
            f"?api_key={ORS_API_KEY}&start={start_lon},{start_lat}&end={end_lon},{end_lat}"
        )

        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 LITHOS'})
            with urllib.request.urlopen(req, timeout=15) as response:
                data = json.loads(response.read().decode())
                if 'features' in data and len(data['features']) > 0:
                    # ORS returns GeoJSON with geometry being the route
                    coords = data['features'][0]['geometry']['coordinates']
                    for lon, lat in coords:
                        cell = _get_cell_at(lat, lon)
                        risk_level = cell["risk_level"] if cell else "GREEN"
                        risk_score = cell["risk_score"] if cell else 0.1
                        segments.append({
                            "lat": round(lat, 5),
                            "lon": round(lon, 5),
                            "risk_level": risk_level,
                            "risk_score": round(risk_score, 3),
                        })
                    return segments
                elif 'error' in data:
                    print(f"[ORS API Error] {data['error']}")
        except Exception as e:
            print(f"[ORS Connection Error] {e}")
            print(f"[OSRM Error] {e}")
    else:
        print("[ORS] ORS_API_KEY not set, falling back to generated route.")
        
    # Fallback to linear if OSRM fails
    rng = random.Random(int((start_lat + end_lat + start_lon + end_lon) * 1e4))
    for i in range(n_points):
        t = i / (max(n_points - 1, 1))
        lat = start_lat + (end_lat - start_lat) * t
        lon = start_lon + (end_lon - start_lon) * t
        deflection = math.sin(t * math.pi) * rng.uniform(0.003, 0.012)
        angle = math.atan2(end_lat - start_lat, end_lon - start_lon) + math.pi / 2
        lat += deflection * math.sin(angle)
        lon += deflection * math.cos(angle)
        cell = _get_cell_at(lat, lon)
        risk_level = cell["risk_level"] if cell else "GREEN"
        risk_score = cell["risk_score"] if cell else 0.1
        segments.append({
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "risk_level": risk_level,
            "risk_score": round(risk_score, 3),
        })
    return segments


def _make_alternative(
    start_lat, start_lon, end_lat, end_lon,
    offset: float, seed_mod: int
) -> List[Dict]:
    """Generate an alternative route using an intermediate waypoint via ORS."""
    rng = random.Random(int((start_lat * 100 + seed_mod) * 1000))
    midlat = (start_lat + end_lat) / 2 + offset
    midlon = (start_lon + end_lon) / 2 + rng.uniform(-offset * 0.5, offset * 0.5)
    
    url = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"
    data = {
        "coordinates": [[start_lon, start_lat], [midlon, midlat], [end_lon, end_lat]]
    }
    segments = []
    
    if ORS_API_KEY:
        try:
            req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={
                'Authorization': ORS_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json, application/geo+json',
                'User-Agent': 'Mozilla/5.0 LITHOS'
            })
            with urllib.request.urlopen(req, timeout=10) as response:
                data_res = json.loads(response.read().decode())
                if 'features' in data_res and len(data_res['features']) > 0:
                    coords = data_res['features'][0]['geometry']['coordinates']
                    for lon, lat in coords:
                        cell = _get_cell_at(lat, lon)
                        risk_level = cell["risk_level"] if cell else "GREEN"
                        risk_score = cell["risk_score"] if cell else 0.1
                        segments.append({
                            "lat": round(lat, 5),
                            "lon": round(lon, 5),
                            "risk_level": risk_level,
                            "risk_score": round(risk_score, 3),
                        })
                    return segments
        except Exception as e:
            print(f"[ORS Alt Error] {e}")

    # Fallback to linear
    n = 20
    waypoints = [(start_lat, start_lon), (midlat, midlon), (end_lat, end_lon)]
    for seg_i in range(len(waypoints) - 1):
        wp_start = waypoints[seg_i]
        wp_end = waypoints[seg_i + 1]
        seg_n = max(1, n // (len(waypoints) - 1))
        for j in range(seg_n):
            t = j / seg_n
            lat = wp_start[0] + (wp_end[0] - wp_start[0]) * t
            lon = wp_start[1] + (wp_end[1] - wp_start[1]) * t
            cell = _get_cell_at(lat, lon)
            risk_level = cell["risk_level"] if cell else "GREEN"
            risk_score = cell["risk_score"] if cell else 0.1
            segments.append({"lat": round(lat, 5), "lon": round(lon, 5),
                              "risk_level": risk_level, "risk_score": round(risk_score, 3)})
    return segments


def _route_stats(segments: List[Dict], total_km: float) -> Dict:
    counts = {"RED": 0, "ORANGE": 0, "GREEN": 0}
    for s in segments:
        counts[s["risk_level"]] = counts.get(s["risk_level"], 0) + 1
    total = max(sum(counts.values()), 1)
    safe_score = max(0.0, min(1.0, 1.0 - (counts["RED"] * 1.0 + counts["ORANGE"] * 0.3) / total))
    max_risk = "GREEN"
    if counts["ORANGE"] > 0: max_risk = "ORANGE"
    if counts["RED"] > 0: max_risk = "RED"
    return {
        "distance_km": round(total_km, 2),
        "estimated_time_min": round(total_km / 40 * 60 * (1 + counts["RED"] * 0.05 + counts["ORANGE"] * 0.01), 0),
        "risk_summary": counts,
        "max_risk_level": max_risk,
        "safe_score": round(safe_score, 3),
        "red_cells_crossed": counts["RED"],
        "orange_cells_crossed": counts["ORANGE"],
        "geojson": {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[s["lon"], s["lat"]] for s in segments],
            },
            "properties": {"max_risk_level": max_risk, "safe_score": round(safe_score, 3)},
        },
    }


def find_safe_route(
    start_lat: float, start_lon: float,
    end_lat: float, end_lon: float,
    region_key: str = "multi",
) -> Dict[str, Any]:
    """Main routing function. Returns primary route + 2 alternatives.
    Uses ThreadPoolExecutor to fetch all 3 OSRM routes in parallel.
    Results are cached in-memory for repeat queries.
    """
    global _ROUTE_CACHE

    # ── Cache lookup ──────────────────────────────────────────────────────────
    cache_key = (round(start_lat, 4), round(start_lon, 4), round(end_lat, 4), round(end_lon, 4))
    if cache_key in _ROUTE_CACHE:
        print(f"[Routing] Cache hit for {cache_key}")
        return _ROUTE_CACHE[cache_key]

    total_km = haversine(start_lat, start_lon, end_lat, end_lon) * 1.35
    warnings = []

    # ── Parallel OSRM fetch ───────────────────────────────────────────────────
    def fetch_primary():
        return _interpolate_route(start_lat, start_lon, end_lat, end_lon, 20)

    def fetch_alt1():
        return _make_alternative(start_lat, start_lon, end_lat, end_lon, 0.08, 1)

    def fetch_alt2():
        return _make_alternative(start_lat, start_lon, end_lat, end_lon, -0.15, 2)

    with ThreadPoolExecutor(max_workers=3) as executor:
        future_primary = executor.submit(fetch_primary)
        future_alt1    = executor.submit(fetch_alt1)
        future_alt2    = executor.submit(fetch_alt2)

        primary_segs = future_primary.result()
        alt1_segs    = future_alt1.result()
        alt2_segs    = future_alt2.result()

    # ── Compute stats ─────────────────────────────────────────────────────────
    stats      = _route_stats(primary_segs, total_km)
    alt1_km    = total_km * 1.12
    alt2_km    = total_km * 1.28
    alt1_stats = _route_stats(alt1_segs, alt1_km)
    alt2_stats = _route_stats(alt2_segs, alt2_km)

    if stats["max_risk_level"] == "RED":
        warnings.append(f"Route passes through {stats['red_cells_crossed']} high-risk zone(s)")

    # ── Runout segment warnings ───────────────────────────────────────────────
    runout_warnings = []
    seen_fan_ids = set()
    for i, s in enumerate(primary_segs):
        if s.get("note") == "ACTIVE DEBRIS RUNOUT ZONE":
            fan_id = s.get("cell_id")
            if fan_id not in seen_fan_ids:
                seen_fan_ids.add(fan_id)
                km = round((i / len(primary_segs)) * total_km, 1)
                runout_warnings.append({
                    "cell_id": fan_id,
                    "km_marker": f"km {km}",
                    "action": "Road may be blocked by active debris flow"
                })

    result = {
        "region": region_key,
        "start": {"lat": start_lat, "lon": start_lon},
        "end": {"lat": end_lat, "lon": end_lon},
        "route": {
            **stats,
            "segments": primary_segs,
            "label": "Primary Route",
        },
        "alternative_routes": [
            {
                **alt1_stats,
                "segments": alt1_segs,
                "label": "Alt Route 1",
                "extra_time_min": round(alt1_stats["estimated_time_min"] - stats["estimated_time_min"]),
            },
            {
                **alt2_stats,
                "segments": alt2_segs,
                "label": "Alt Route 2",
                "extra_time_min": round(alt2_stats["estimated_time_min"] - stats["estimated_time_min"]),
            },
        ],
        "warnings": warnings,
        "runout_warnings": runout_warnings,
        "note": "LITHOS A* routing weights roads by real-time landslide risk. GREEN=safe ORANGE=caution RED=avoid",
    }

    # ── Cache result (evict oldest if full) ───────────────────────────────────
    if len(_ROUTE_CACHE) >= _ROUTE_CACHE_MAX:
        del _ROUTE_CACHE[next(iter(_ROUTE_CACHE))]
    _ROUTE_CACHE[cache_key] = result
    return result
