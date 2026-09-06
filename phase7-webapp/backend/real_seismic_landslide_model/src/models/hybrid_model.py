from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Dict

import joblib
import pandas as pd

from src.config import load_project_config
from src.features.feature_builder import FeatureVector
from src.features.seismic_features import estimate_mmi, estimate_pgv_cm_s
from src.physics.seismic_stability import StabilityResult, compute_stability


@dataclass
class HybridPrediction:
    landslide_probability: float
    earthquake_triggered_probability: float
    dry_soil_shear_failure_probability: float
    dominant_trigger: str
    stability_margin: float
    critical_acceleration_g: float
    newmark_displacement_cm: float
    model_status: str


def _clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


def empirical_placeholder_probability(features: FeatureVector) -> float:
    """
    Starter empirical score.

    This is intentionally simple and should be replaced by a trained model once
    the dataset builder is ready.
    """
    slope_term = min(features.slope_deg / 60.0, 1.0) * 0.35
    shaking_term = min(features.pga_g / 0.5, 1.0) * 0.30
    wetness_term = min(features.saturation_ratio, 1.0) * 0.20
    deformation_term = min(features.deformation_proxy, 1.0) * 0.15
    return _clamp(slope_term + shaking_term + wetness_term + deformation_term)


def predict_hybrid(features: FeatureVector) -> HybridPrediction:
    stability: StabilityResult = compute_stability(
        slope_deg=features.slope_deg,
        cohesion_kpa=features.cohesion_kpa,
        friction_angle_deg=features.friction_angle_deg,
        failure_depth_m=features.failure_depth_m,
        saturation_ratio=features.saturation_ratio,
        pga_g=features.pga_g,
    )

    empirical_prob = empirical_placeholder_probability(features)
    physics_prob = _clamp(
        0.5 * max(1.0 - stability.fos_pseudostatic, 0.0)
        + 0.3 * min(stability.newmark_displacement_cm / 10.0, 1.0)
        + 0.2 * stability.dry_soil_shear_failure_probability
    )

    landslide_probability = _clamp(0.6 * empirical_prob + 0.4 * physics_prob)
    earthquake_triggered_probability = _clamp(
        0.55 * min(features.pga_g / 0.5, 1.0)
        + 0.25 * min(stability.newmark_displacement_cm / 10.0, 1.0)
        + 0.20 * stability.dry_soil_shear_failure_probability
    )

    if earthquake_triggered_probability >= 0.55 and features.saturation_ratio < 0.4:
        dominant_trigger = "earthquake_dry_shear"
    elif earthquake_triggered_probability >= 0.55:
        dominant_trigger = "earthquake"
    elif features.saturation_ratio >= 0.6:
        dominant_trigger = "rainfall"
    else:
        dominant_trigger = "mixed_or_unknown"

    return HybridPrediction(
        landslide_probability=landslide_probability,
        earthquake_triggered_probability=earthquake_triggered_probability,
        dry_soil_shear_failure_probability=stability.dry_soil_shear_failure_probability,
        dominant_trigger=dominant_trigger,
        stability_margin=stability.fos_pseudostatic - 1.0,
        critical_acceleration_g=stability.critical_acceleration_g,
        newmark_displacement_cm=stability.newmark_displacement_cm,
        model_status="physics_fallback",
    )


def prediction_to_dict(prediction: HybridPrediction) -> Dict[str, float | str]:
    return {
        "landslide_probability": round(prediction.landslide_probability, 4),
        "earthquake_triggered_probability": round(prediction.earthquake_triggered_probability, 4),
        "dry_soil_shear_failure_probability": round(prediction.dry_soil_shear_failure_probability, 4),
        "dominant_trigger": prediction.dominant_trigger,
        "stability_margin": round(prediction.stability_margin, 4),
        "critical_acceleration_g": round(prediction.critical_acceleration_g, 4),
        "newmark_displacement_cm": round(prediction.newmark_displacement_cm, 4),
        "model_status": prediction.model_status,
    }


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _model_paths() -> Dict[str, Path]:
    config = load_project_config()
    root = _project_root()
    return {
        "trigger_model": (root / config["model"]["trigger_model_path"]).resolve(),
        "trigger_meta": (root / config["model"]["trigger_model_metadata_path"]).resolve(),
        "dry_model": (root / config["model"]["dry_shear_model_path"]).resolve(),
        "dry_meta": (root / config["model"]["dry_shear_model_metadata_path"]).resolve(),
    }


@lru_cache(maxsize=1)
def _load_model_bundle() -> Dict[str, object] | None:
    paths = _model_paths()
    if not all(path.exists() for path in paths.values()):
        return None

    with paths["trigger_meta"].open("r", encoding="utf-8") as handle:
        trigger_meta = json.load(handle)
    with paths["dry_meta"].open("r", encoding="utf-8") as handle:
        dry_meta = json.load(handle)

    return {
        "trigger_model": joblib.load(paths["trigger_model"]),
        "trigger_meta": trigger_meta,
        "dry_model": joblib.load(paths["dry_model"]),
        "dry_meta": dry_meta,
    }


def _payload_to_training_row(payload: Dict[str, float | int]) -> tuple[pd.DataFrame, StabilityResult]:
    slope_deg = float(payload.get("slope_deg", 25.0))
    cohesion_kpa = float(payload.get("cohesion_kpa", 12.0))
    friction_angle_deg = float(payload.get("friction_angle_deg", 28.0))
    failure_depth_m = float(payload.get("failure_depth_m", 3.0))
    saturation_ratio = float(payload.get("saturation_ratio", 0.3))
    pga_g = float(payload.get("pga_g", 0.0))
    magnitude = float(payload.get("magnitude", 0.0))
    epicentral_distance_km = float(payload.get("epicentral_distance_km", 999.0))
    matched_eq_depth_km = float(payload.get("matched_eq_depth_km", 10.0))
    matched_eq_time_delta_hours = float(payload.get("matched_eq_time_delta_hours", 0.0))
    terrain_elevation_m = float(payload.get("terrain_elevation_m", 300.0))
    terrain_area_km2 = float(payload.get("terrain_area_km2", 1.0))
    terrain_rain_72h = float(payload.get("terrain_rain_72h", saturation_ratio * 150.0))
    terrain_distance_to_unit_m = float(payload.get("terrain_distance_to_unit_m", 0.0))
    sar_latest_value = float(payload.get("sar_latest_value", 0.0))
    sar_previous_value = float(payload.get("sar_previous_value", 0.0))
    sar_delta = sar_latest_value - sar_previous_value
    sar_abs_delta = abs(sar_delta)
    fatality_count = float(payload.get("fatality_count", 0.0))
    injury_count = float(payload.get("injury_count", 0.0))

    stability = compute_stability(
        slope_deg=slope_deg,
        cohesion_kpa=cohesion_kpa,
        friction_angle_deg=friction_angle_deg,
        failure_depth_m=failure_depth_m,
        saturation_ratio=saturation_ratio,
        pga_g=pga_g,
    )

    row = {
        "terrain_slope_deg": slope_deg,
        "terrain_elevation_m": terrain_elevation_m,
        "terrain_area_km2": terrain_area_km2,
        "terrain_rain_72h": terrain_rain_72h,
        "terrain_fos_proxy": float(payload.get("terrain_fos_proxy", stability.fos_static)),
        "terrain_distance_to_unit_m": terrain_distance_to_unit_m,
        "matched_eq_mag": magnitude,
        "matched_eq_depth_km": matched_eq_depth_km,
        "matched_eq_distance_km": epicentral_distance_km,
        "matched_eq_time_delta_hours": matched_eq_time_delta_hours,
        "matched_eq_pga_g": pga_g,
        "matched_eq_pgv_cm_s": estimate_pgv_cm_s(magnitude, epicentral_distance_km),
        "matched_eq_mmi_estimate": estimate_mmi(pga_g),
        "sar_latest_value": sar_latest_value,
        "sar_previous_value": sar_previous_value,
        "sar_delta": sar_delta,
        "sar_abs_delta": sar_abs_delta,
        "cohesion_kpa": cohesion_kpa,
        "friction_angle_deg": friction_angle_deg,
        "failure_depth_m": failure_depth_m,
        "saturation_ratio": saturation_ratio,
        "physics_fos_static": stability.fos_static,
        "physics_fos_pseudostatic": stability.fos_pseudostatic,
        "physics_critical_acceleration_g": stability.critical_acceleration_g,
        "physics_newmark_displacement_cm": stability.newmark_displacement_cm,
        "physics_dry_shear_probability": stability.dry_soil_shear_failure_probability,
        "fatality_count": fatality_count,
        "injury_count": injury_count,
    }
    return pd.DataFrame([row]), stability


def predict_hybrid_trained(payload: Dict[str, float | int]) -> HybridPrediction:
    bundle = _load_model_bundle()
    if bundle is None:
        return predict_hybrid(
            FeatureVector(
                slope_deg=float(payload.get("slope_deg", 25.0)),
                cohesion_kpa=float(payload.get("cohesion_kpa", 12.0)),
                friction_angle_deg=float(payload.get("friction_angle_deg", 28.0)),
                failure_depth_m=float(payload.get("failure_depth_m", 3.0)),
                saturation_ratio=float(payload.get("saturation_ratio", 0.3)),
                pga_g=float(payload.get("pga_g", 0.0)),
                magnitude=float(payload.get("magnitude", 0.0)),
                epicentral_distance_km=float(payload.get("epicentral_distance_km", 999.0)),
                deformation_proxy=float(payload.get("deformation_proxy", 0.0)),
            )
        )

    feature_frame, stability = _payload_to_training_row(payload)
    trigger_columns = bundle["trigger_meta"]["feature_columns"]
    dry_columns = bundle["dry_meta"]["feature_columns"]

    trigger_prob = float(bundle["trigger_model"].predict_proba(feature_frame[trigger_columns])[:, 1][0])
    dry_prob = float(bundle["dry_model"].predict_proba(feature_frame[dry_columns])[:, 1][0])
    landslide_probability = _clamp(
        0.45 * trigger_prob
        + 0.35 * dry_prob
        + 0.20 * _clamp(
            0.5 * max(1.0 - stability.fos_pseudostatic, 0.0)
            + 0.5 * min(stability.newmark_displacement_cm / 10.0, 1.0)
        )
    )

    if trigger_prob >= 0.55 and dry_prob >= 0.5 and float(payload.get("saturation_ratio", 0.3)) < 0.4:
        dominant_trigger = "earthquake_dry_shear"
    elif trigger_prob >= 0.55:
        dominant_trigger = "earthquake"
    elif float(payload.get("saturation_ratio", 0.3)) >= 0.6:
        dominant_trigger = "rainfall"
    else:
        dominant_trigger = "mixed_or_unknown"

    return HybridPrediction(
        landslide_probability=landslide_probability,
        earthquake_triggered_probability=trigger_prob,
        dry_soil_shear_failure_probability=dry_prob,
        dominant_trigger=dominant_trigger,
        stability_margin=stability.fos_pseudostatic - 1.0,
        critical_acceleration_g=stability.critical_acceleration_g,
        newmark_displacement_cm=stability.newmark_displacement_cm,
        model_status="trained_hybrid",
    )
