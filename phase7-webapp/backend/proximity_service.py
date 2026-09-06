import math
from typing import List, Dict
from mock_data import ALL_CELLS_FLAT

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in km between two lat/lon points."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))

def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the bearing from point 1 to point 2 in degrees."""
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    diff_lon = math.radians(lon2 - lon1)

    x = math.sin(diff_lon) * math.cos(lat2_rad)
    y = math.cos(lat1_rad) * math.sin(lat2_rad) - (math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(diff_lon))

    initial_bearing = math.atan2(x, y)
    initial_bearing = math.degrees(initial_bearing)
    compass_bearing = (initial_bearing + 360) % 360
    return compass_bearing

def bearing_to_compass(bearing: float) -> str:
    """Convert bearing in degrees to compass direction string."""
    dirs = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West']
    idx = int((bearing + 22.5) / 45) % 8
    return dirs[idx]

def get_nearby_critical_slopes(lat: float, lon: float, radius_km: float = 6.0) -> List[Dict]:
    """Find critical slopes within radius and return distance and direction."""
    hazards = []
    
    # We define 'critical' as RED cells or cells with FoS < 1.0
    critical_cells = [c for c in ALL_CELLS_FLAT if (c.get("risk_level") == "RED" or c.get("fos_seismic", 4.0) < 1.0)]
    
    for cell in critical_cells:
        dist = haversine(lat, lon, cell["center_lat"], cell["center_lon"])
        if dist <= radius_km:
            bearing = calculate_bearing(lat, lon, cell["center_lat"], cell["center_lon"])
            hazards.append({
                "cell_id": cell["cell_id"],
                "distance_km": round(dist, 2),
                "bearing_deg": round(bearing, 1),
                "direction": bearing_to_compass(bearing),
                "risk_level": cell["risk_level"],
                "fos_seismic": cell.get("fos_seismic", 0.0),
                "slope_mean": cell.get("slope_mean", 0.0),
                "lat": cell["center_lat"],
                "lon": cell["center_lon"]
            })
    
    # Sort by distance
    hazards.sort(key=lambda x: x["distance_km"])
    return hazards
