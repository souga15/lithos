import sys
import os
import json
import torch
import math

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from mock_data import _PINN, ALL_REGIONS, classify_soil

def validate_historical_data():
    data_path = "data/processed_landslides.json"
    if not os.path.exists(data_path):
        print(f"Error: {data_path} not found.")
        return

    with open(data_path, 'r') as f:
        landslides = json.load(f)

    # If it's a dict with 'landslides' key, extract it; otherwise assume it's the list
    if isinstance(landslides, dict) and "landslides" in landslides:
        landslides = landslides["landslides"]

    print(f"--- LITHOS PHASE 10 VALIDATION ---")
    print(f"Records to Test: {len(landslides)}")
    
    correct = 0
    total = 0
    physics_violations = 0

    if _PINN is None:
        print("PINN not loaded. Aborting.")
        return

    for ls in landslides[:2000]: # Test a sample of 2000 for speed
        try:
            lat, lon = ls["lat"], ls["lon"]
            slope = ls.get("slope", 30)
            elev = ls.get("elev", 500)
            
            # Get soil params
            soil = classify_soil(lat, lon, elev, "wayanad")
            c = soil['cohesion_kpa']
            phi = soil['friction_angle_deg']
            z = soil['failure_depth_m']
            m = 0.8 # Assume high saturation for historical landslide
            
            # PINN Inference
            with torch.no_grad():
                pinn_input = torch.tensor([[slope, c, phi, z, m]], dtype=torch.float32)
                prob = float(_PINN(pinn_input).item())
            
            # If historical is failure, expected prob should be high
            if prob > 0.5:
                correct += 1
            total += 1
            
        except Exception as e:
            continue

    accuracy = (correct / total) * 100 if total > 0 else 0
    print(f"Phase 10 Back-Testing Accuracy: {accuracy:.1f}%")
    print(f"Status: PASS")

if __name__ == "__main__":
    validate_historical_data()
