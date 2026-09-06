"""
LITHOS Phase 9 — Runout Zone & Cascade Impact Engine
Uses the empirical fahrböschung (travel-angle) model to estimate
debris runout from a failing slope unit (FoS < 1.0).

No external API calls needed — uses ALL_CELLS_FLAT elevations.
"""
import math
from typing import List, Dict, Any, Optional, Tuple

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SEARCH_RADIUS_KM   = 5.0   # radius used to find valley floor elevation
TRAVEL_ANGLE_SOFT  = 8.0   # debris flow (alluvial / colluvium) — degrees
TRAVEL_ANGLE_ROCK  = 11.0  # soil slide / residual              — degrees
FAN_HALF_ANGLE     = 20.0  # ± degrees either side of downslope aspect
CHAIN_FOS_THRESH   = 1.5   # cells with FoS < this are already marginal
CHAIN_SLOPE_MIN    = 20.0  # chain slope threshold (degrees)
ROAD_ELEV_DROP_MIN = 50.0  # minimum elevation drop (m) for road-risk flag

HIGHWAY_REGIONS = {"manipur_nh2", "arunachal_w", "assam_hills", "nagaland"}

# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in km between two lat/lon points."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return 6371.0 * 2 * math.asin(math.sqrt(a))


def _compute_aspect(cell: Dict) -> Optional[float]:
    """
    Estimate downslope aspect (degrees, N=0 clockwise) from the 4-point
    DEM gradient already cached in terrain_service.
    Returns None if elevations aren't cached for this cell.
    """
    try:
        from terrain_service import terrain_service
        lat, lon = cell["center_lat"], cell["center_lon"]
        step = 0.009  # ~1 km

        def cached(la, lo):
            key = f"{round(la, 5)},{round(lo, 5)}"
            v = terrain_service.cache.get(key)
            return float(v) if v is not None else None

        n = cached(lat + step, lon)
        s = cached(lat - step, lon)
        e = cached(lat, lon + step)
        w = cached(lat, lon - step)

        if any(v is None for v in [n, s, e, w]):
            return None

        dz_dx = (e - w) / (2 * step * 111000)   # E−W gradient
        dz_dy = (n - s) / (2 * step * 111000)   # N−S gradient

        # Aspect: direction water flows downhill
        aspect_rad = math.atan2(-dz_dx, -dz_dy)   # downslope
        aspect_deg = math.degrees(aspect_rad) % 360
        return round(aspect_deg, 1)
    except Exception:
        return None


def _deg_to_rad(deg: float) -> float:
    return math.radians(deg)


def _offset_point(lat: float, lon: float,
                  bearing_deg: float, dist_m: float) -> Tuple[float, float]:
    """Return (lat, lon) offset from origin by dist_m along bearing_deg."""
    R = 6371000.0
    d = dist_m / R
    b = _deg_to_rad(bearing_deg)
    lat1 = _deg_to_rad(lat)
    lon1 = _deg_to_rad(lon)

    lat2 = math.asin(math.sin(lat1) * math.cos(d)
                     + math.cos(lat1) * math.sin(d) * math.cos(b))
    lon2 = lon1 + math.atan2(math.sin(b) * math.sin(d) * math.cos(lat1),
                              math.cos(d) - math.sin(lat1) * math.sin(lat2))
    return (math.degrees(lat2), math.degrees(lon2))


def _build_fan(lat: float, lon: float,
               runout_m: float, aspect_deg: Optional[float],
               half_angle: float = FAN_HALF_ANGLE,
               n_arc: int = 12) -> Dict:
    """
    Build a GeoJSON Polygon representing the debris fan.
    If aspect_deg is None, returns a 360-degree circle (worst-case influence).
    """
    if aspect_deg is None:
        coords = []
        for i in range(32):
            bearing = (i / 32.0) * 360.0
            pt_lat, pt_lon = _offset_point(lat, lon, bearing, runout_m)
            coords.append([pt_lon, pt_lat])
        coords.append(coords[0])
        return {"type": "Polygon", "coordinates": [coords]}

    coords = [[lon, lat]]  # apex

    # Arc across the fan toe
    left_bearing  = (aspect_deg - half_angle) % 360
    right_bearing = (aspect_deg + half_angle) % 360

    for i in range(n_arc + 1):
        frac = i / n_arc
        bearing = left_bearing + frac * 2 * half_angle
        bearing = bearing % 360
        pt_lat, pt_lon = _offset_point(lat, lon, bearing, runout_m)
        coords.append([pt_lon, pt_lat])

    coords.append([lon, lat])  # close polygon back to apex

    return {
        "type": "Polygon",
        "coordinates": [coords],
    }


def _point_in_fan(pt_lat: float, pt_lon: float,
                  apex_lat: float, apex_lon: float,
                  runout_m: float, aspect_deg: float,
                  half_angle: float = FAN_HALF_ANGLE) -> bool:
    """Check whether a point falls inside the debris fan."""
    dist_km = _haversine(apex_lat, apex_lon, pt_lat, pt_lon)
    if dist_km * 1000 > runout_m:
        return False

    # Bearing from apex to point
    dlat = pt_lat - apex_lat
    dlon = pt_lon - apex_lon
    bearing = math.degrees(math.atan2(dlon, dlat)) % 360

    # Angular distance from aspect
    diff = abs((bearing - aspect_deg + 180) % 360 - 180)
    return diff <= half_angle


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------

def estimate_runout(cell: Dict, all_cells: List[Dict]) -> Dict:
    """
    Estimate the runout zone for a failing slope unit.

    Returns a dict with:
        H_m, travel_angle_deg, runout_distance_m, aspect_deg,
        debris_volume_m3, fan_polygon (GeoJSON)
    """
    lat = cell["center_lat"]
    lon = cell["center_lon"]
    cell_elev = cell.get("elevation_mean", 500.0)
    soil_type = cell.get("soil_type", "")

    # ── Passing 1: Initial H estimate using 3km radius
    initial_radius = 3.0
    neighbours = [
        c["elevation_mean"]
        for c in all_cells
        if (_haversine(lat, lon, c["center_lat"], c["center_lon"]) < initial_radius
            and c["cell_id"] != cell["cell_id"]
            and c.get("elevation_mean", cell_elev) < cell_elev)
    ]
    valley_elev_initial = min(neighbours) if neighbours else max(0.0, cell_elev - 100.0)
    H_initial = max(10.0, cell_elev - valley_elev_initial)

    # ── Travel angle
    if soil_type in ("alluvial", "colluvium"):
        travel_angle = TRAVEL_ANGLE_SOFT
    else:
        travel_angle = TRAVEL_ANGLE_ROCK

    # Initial L_m to refine radius
    L_initial = H_initial / math.tan(math.radians(travel_angle))
    
    # ── Passing 2: Refined H using L_m / 1000.0 (dynamic zone)
    refined_radius = max(1.0, L_initial / 1000.0)
    neighbours_refined = [
        c["elevation_mean"]
        for c in all_cells
        if (_haversine(lat, lon, c["center_lat"], c["center_lon"]) < refined_radius
            and c["cell_id"] != cell["cell_id"]
            and c.get("elevation_mean", cell_elev) < cell_elev)
    ]
    valley_elev = min(neighbours_refined) if neighbours_refined else valley_elev_initial
    H_m = max(10.0, cell_elev - valley_elev)
    L_m = H_m / math.tan(math.radians(travel_angle))
    L_m = min(L_m, 15000.0)  # cap at 15 km

    # ── Aspect from DEM cache or None fallback
    raw_aspect = _compute_aspect(cell)
    aspect_deg = raw_aspect  # can be None
    aspect_known = raw_aspect is not None

    # ── Debris volume: area × failure depth (using requested field name)
    area_km2      = cell.get("area_km2", 0.04) 
    failure_depth = max(1.0, cell.get("failure_depth_m", 2.0))
    debris_volume_m3 = area_km2 * failure_depth * 1e6

    # ── Fan polygon
    fan_polygon = _build_fan(lat, lon, L_m, aspect_deg)

    return {
        "H_m":               round(H_m, 1),
        "travel_angle_deg":  travel_angle,
        "runout_distance_m": round(L_m, 0),
        "aspect_deg":        round(aspect_deg, 1) if aspect_deg is not None else 180.0,
        "aspect_known":      aspect_known,
        "debris_volume_m3":  round(debris_volume_m3, 0),
        "fan_polygon":       fan_polygon,
    }


def find_cascade_impacts(source_cell: Dict,
                         all_cells: List[Dict],
                         fan_polygon: Dict,
                         runout_m: float,
                         aspect_deg: float) -> Dict:
    """
    Classify cells within the runout fan into:
      - road_risk_cells   : in fan + elev drop > 50m + highway region
      - chain_slope_cells : in fan + fos_seismic < 1.5 + slope > 20°
      - river_risk        : in fan + very low elevation (< 15% of H above valley)
    """
    apex_lat = source_cell["center_lat"]
    apex_lon = source_cell["center_lon"]
    source_elev = source_cell.get("elevation_mean", 500.0)
    source_region = source_cell.get("region", "")

    road_risk: List[Dict] = []
    chain_slopes: List[Dict] = []
    river_risk = False

    for c in all_cells:
        if c["cell_id"] == source_cell["cell_id"]:
            continue

        if not _point_in_fan(c["center_lat"], c["center_lon"],
                             apex_lat, apex_lon, runout_m, aspect_deg):
            continue

        elev_drop = source_elev - c.get("elevation_mean", source_elev)
        fos = c.get("fos_seismic", 4.0)
        slope = c.get("slope_mean", 0.0)
        region = c.get("region", "")

        # ── Issue 3 fix: strict road_risk criteria
        is_road_risk = (
            elev_drop > ROAD_ELEV_DROP_MIN
            and region in HIGHWAY_REGIONS
        )
        # Also mark any region that has a significant drop (general road damage)
        if not is_road_risk and elev_drop > ROAD_ELEV_DROP_MIN * 1.5:
            is_road_risk = True

        # ── Strict chain_slope criteria
        is_chain = fos < CHAIN_FOS_THRESH and slope > CHAIN_SLOPE_MIN

        # ── River risk: very low elevation in valley
        H_m = source_elev - min((x.get("elevation_mean", source_elev)
                                  for x in all_cells
                                  if x["cell_id"] != source_cell["cell_id"]),
                                 default=source_elev - 100)
        river_threshold = source_elev - 0.85 * H_m
        if c.get("elevation_mean", source_elev) < river_threshold:
            river_risk = True

        if is_road_risk:
            road_risk.append({
                "cell_id":    c["cell_id"],
                "region":     region,
                "risk_score": c.get("risk_score", 0),
                "elev_drop_m": round(elev_drop, 1),
            })

        if is_chain:
            chain_slopes.append({
                "cell_id":    c["cell_id"],
                "fos_seismic": round(fos, 2),
                "slope_mean":  round(slope, 1),
                "risk_score":  c.get("risk_score", 0),
            })

    # De-duplicate (a cell can be both road and chain)
    total = len({c["cell_id"] for c in road_risk + chain_slopes})

    # Cascade risk level
    n_chain = len(chain_slopes)
    n_road  = len(road_risk)
    if n_chain >= 3 or (n_chain >= 1 and n_road >= 2):
        cascade_risk = "HIGH"
    elif n_chain >= 1 or n_road >= 2:
        cascade_risk = "MODERATE"
    elif n_road >= 1 or river_risk:
        cascade_risk = "LOW"
    else:
        cascade_risk = "NEGLIGIBLE"

    return {
        "road_risk_cells":   road_risk,
        "chain_slope_cells": chain_slopes,
        "river_risk":        river_risk,
        "total_affected":    total,
        "cascade_risk":      cascade_risk,
    }


def recommended_action(runout_m: float, impacts: Dict,
                        cell: Dict) -> str:
    risk = impacts["cascade_risk"]
    n_chain = len(impacts["chain_slope_cells"])
    n_road  = len(impacts["road_risk_cells"])
    dist_m  = int(runout_m)
    region  = cell.get("region", "area").replace('_', ' ').upper()

    if risk == "HIGH":
        highway = next((c["region"].replace('_', ' ').upper() for c in impacts["road_risk_cells"]), region)
        return (f"IMMEDIATE evacuation — {dist_m}m corridor. "
                f"{n_chain} slopes at cascade risk. "
                f"Close {highway} at nearest checkpoint.")
    
    elif risk == "MODERATE":
        return (f"Monitor closely. Restrict traffic within {dist_m}m of failure zone.")
    
    elif risk == "LOW":
        return f"Low cascade risk. Standard monitoring protocol applies across {dist_m}m zone."
    
    else:
        return f"No immediate downstream assets in {dist_m}m runout path. Monitor remotely."
