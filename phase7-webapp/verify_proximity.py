import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_proximity(lat, lon, radius=6.0):
    print(f"\n--- Testing Proximity Alerts at {lat}, {lon} (Radius: {radius}km) ---")
    try:
        resp = requests.get(f"{BASE_URL}/proximity-alerts?lat={lat}&lon={lon}&radius={radius}")
        resp.raise_for_status()
        data = resp.json()
        print(f"Found {data['hazard_count']} hazards.")
        for h in data['hazards'][:3]:
            print(f"- Hazard {h['cell_id']}: {h['distance_km']}km to the {h['direction']} (FoS: {h['fos_seismic']}, Aspect: {h['bearing_deg']}°)")
    except Exception as e:
        print(f"Error: {e}")

def test_runout(cell_id):
    print(f"\n--- Testing Runout for {cell_id} ---")
    try:
        resp = requests.get(f"{BASE_URL}/runout/{cell_id}")
        resp.raise_for_status()
        data = resp.json()
        print(f"Aspect: {data['aspect_deg']}°, Known: {data.get('aspect_known', 'N/A')}")
        poly_type = data['fan_polygon']['type']
        coords_count = len(data['fan_polygon']['coordinates'][0])
        print(f"Fan Polygon: {poly_type} with {coords_count} points")
        if coords_count > 30:
            print("  (Detected circular fallback for unknown aspect)")
        else:
            print("  (Detected directional fan)")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Example coordinates in Cherrapunji area where we know there are RED cells
    # We can get a cell_id from the regions list
    try:
        regions_resp = requests.get(f"{BASE_URL}/regions")
        regions = regions_resp.json()["regions"]
        cherra_center = regions[0]["center"]
        test_proximity(cherra_center[0], cherra_center[1])
        
        # Get a specific cell
        grid_resp = requests.get(f"{BASE_URL}/risk-grid?region=cherrapunji")
        cells = grid_resp.json()["features"]
        if cells:
            test_runout(cells[0]["properties"]["cell_id"])
    except Exception as e:
        print(f"Pre-test error: {e}")
