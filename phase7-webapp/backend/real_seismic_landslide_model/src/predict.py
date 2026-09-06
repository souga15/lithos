from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.models.hybrid_model import prediction_to_dict, predict_hybrid_trained


def demo_prediction() -> None:
    sample = {
        "slope_deg": 38.0,
        "cohesion_kpa": 9.0,
        "friction_angle_deg": 24.0,
        "failure_depth_m": 4.0,
        "saturation_ratio": 0.15,
        "pga_g": 0.32,
        "magnitude": 6.7,
        "epicentral_distance_km": 22.0,
        "matched_eq_depth_km": 12.0,
        "matched_eq_time_delta_hours": 1.0,
        "terrain_elevation_m": 1100.0,
        "terrain_area_km2": 1.4,
        "terrain_rain_72h": 24.0,
        "terrain_fos_proxy": 0.95,
        "terrain_distance_to_unit_m": 50.0,
        "sar_latest_value": -8.2,
        "sar_previous_value": -6.0,
        "fatality_count": 0.0,
        "injury_count": 0.0,
    }
    print(prediction_to_dict(predict_hybrid_trained(sample)))


if __name__ == "__main__":
    demo_prediction()
