from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


@dataclass
class FeatureVector:
    slope_deg: float
    cohesion_kpa: float
    friction_angle_deg: float
    failure_depth_m: float
    saturation_ratio: float
    pga_g: float
    magnitude: float
    epicentral_distance_km: float
    deformation_proxy: float


def build_feature_vector(raw: Dict[str, float | int | str]) -> FeatureVector:
    """Map a raw sample into the core hybrid-model feature set."""
    return FeatureVector(
        slope_deg=float(raw.get("slope_deg", raw.get("slope", 25.0))),
        cohesion_kpa=float(raw.get("cohesion_kpa", 12.0)),
        friction_angle_deg=float(raw.get("friction_angle_deg", 28.0)),
        failure_depth_m=float(raw.get("failure_depth_m", 3.0)),
        saturation_ratio=float(raw.get("saturation_ratio", 0.3)),
        pga_g=float(raw.get("pga_g", 0.0)),
        magnitude=float(raw.get("magnitude", 0.0)),
        epicentral_distance_km=float(raw.get("epicentral_distance_km", 999.0)),
        deformation_proxy=float(raw.get("deformation_proxy", 0.0)),
    )


def feature_dict(vector: FeatureVector) -> Dict[str, float]:
    return {
        "slope_deg": vector.slope_deg,
        "cohesion_kpa": vector.cohesion_kpa,
        "friction_angle_deg": vector.friction_angle_deg,
        "failure_depth_m": vector.failure_depth_m,
        "saturation_ratio": vector.saturation_ratio,
        "pga_g": vector.pga_g,
        "magnitude": vector.magnitude,
        "epicentral_distance_km": vector.epicentral_distance_km,
        "deformation_proxy": vector.deformation_proxy,
    }
