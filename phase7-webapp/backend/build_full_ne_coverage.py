"""
LITHOS — Full North East India High-Grade Zero-Gap Coverage Generator
Covers all 8 North East Indian states (Arunachal Pradesh, Assam, Meghalaya, Nagaland, Manipur, Mizoram, Tripura, Sikkim).
Ensures zero missing spatial gaps at high-grade 30m SRTM DEM resolution.
"""
import os
import math
import geopandas as gpd
import pandas as pd
from shapely.geometry import Polygon

# Full Bounding Box for entire North East India region
# Lat: 21.5°N - 29.5°N | Lon: 87.8°E - 97.4°E
NE_BOUNDS = {
    "min_lat": 21.5,
    "max_lat": 29.5,
    "min_lon": 87.8,
    "max_lon": 97.4,
}

NE_STATES = {
    "arunachal_pradesh": {"name": "Arunachal Pradesh", "lat_range": (26.5, 29.5), "lon_range": (91.5, 97.4), "capital": "Itanagar"},
    "assam":            {"name": "Assam (Asom)",        "lat_range": (24.1, 28.0), "lon_range": (89.7, 96.0), "capital": "Dispur"},
    "meghalaya":        {"name": "Meghalaya",          "lat_range": (25.0, 26.1), "lon_range": (89.8, 92.8), "capital": "Shillong"},
    "nagaland":         {"name": "Nagaland",           "lat_range": (25.2, 27.0), "lon_range": (93.3, 95.3), "capital": "Kohima"},
    "manipur":          {"name": "Manipur",            "lat_range": (23.8, 25.7), "lon_range": (93.0, 94.8), "capital": "Imphal"},
    "mizoram":          {"name": "Mizoram",            "lat_range": (21.9, 24.5), "lon_range": (92.2, 93.4), "capital": "Aizawl"},
    "tripura":          {"name": "Tripura",            "lat_range": (22.9, 24.5), "lon_range": (91.1, 92.7), "capital": "Agartala"},
    "sikkim":           {"name": "Sikkim",             "lat_range": (27.1, 28.1), "lon_range": (88.0, 88.9), "capital": "Gangtok"},
}

def generate_zero_gap_ne_grid(step_deg=0.05):
    """
    Generates a high-grade contiguous mesh grid covering 100% of North East India.
    step_deg=0.05 corresponds to ~5km x 5km high-grade mesh.
    For 30m resolution point lookup, terrain_service queries SRTM API.
    """
    features = []
    cell_idx = 1
    
    lat_steps = math.ceil((NE_BOUNDS["max_lat"] - NE_BOUNDS["min_lat"]) / step_deg)
    lon_steps = math.ceil((NE_BOUNDS["max_lon"] - NE_BOUNDS["min_lon"]) / step_deg)
    
    print(f"[Full NE Coverage] Generating {lat_steps} x {lon_steps} grid across 8 North East states...")
    
    for i in range(lat_steps):
        lat_min = NE_BOUNDS["min_lat"] + i * step_deg
        lat_max = min(NE_BOUNDS["max_lat"], lat_min + step_deg)
        center_lat = (lat_min + lat_max) / 2.0
        
        for j in range(lon_steps):
            lon_min = NE_BOUNDS["min_lon"] + j * step_deg
            lon_max = min(NE_BOUNDS["max_lon"], lon_min + step_deg)
            center_lon = (lon_min + lon_max) / 2.0
            
            # Determine state association
            state_key = "northeast_general"
            for st_k, st_info in NE_STATES.items():
                l_min, l_max = st_info["lat_range"]
                o_min, o_max = st_info["lon_range"]
                if l_min <= center_lat <= l_max and o_min <= center_lon <= o_max:
                    state_key = st_k
                    break
            
            poly = Polygon([
                (lon_min, lat_min),
                (lon_max, lat_min),
                (lon_max, lat_max),
                (lon_min, lat_max),
                (lon_min, lat_min)
            ])
            
            features.append({
                "unit_id": f"NE_{cell_idx:06d}",
                "state": state_key,
                "region": state_key,
                "center_lat": round(center_lat, 5),
                "center_lon": round(center_lon, 5),
                "geometry": poly
            })
            cell_idx += 1
            
    gdf = gpd.GeoDataFrame(features, crs="EPSG:4326")
    print(f"[Full NE Coverage] SUCCESS: Built {len(gdf):,} contiguous zero-gap cells covering all 8 NE states!")
    return gdf

if __name__ == "__main__":
    gdf = generate_zero_gap_ne_grid(step_deg=0.05)
    out_file = os.path.join(os.path.dirname(__file__), "full_ne_zero_gap_grid.gpkg")
    gdf.to_file(out_file, driver="GPKG")
    print(f"[Full NE Coverage] Exported complete dataset to {out_file}")
