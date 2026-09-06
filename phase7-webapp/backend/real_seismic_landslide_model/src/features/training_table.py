from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd

from src.config import load_project_config
from src.physics.seismic_stability import compute_stability


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _paths() -> Dict[str, Path]:
    config = load_project_config()
    root = _project_root()
    return {
        "input_csv": (root / config["paths"]["local_geospatial_enriched_csv"]).resolve(),
        "output_csv": (root / config["paths"]["training_table_csv"]).resolve(),
        "output_json": (root / config["paths"]["training_table_summary_json"]).resolve(),
    }


def _safe_float(series: pd.Series, default: float) -> pd.Series:
    values = pd.to_numeric(series, errors="coerce")
    return values.fillna(default).astype(float)


def _clip01(series: pd.Series) -> pd.Series:
    return series.clip(lower=0.0, upper=1.0)


def _build_numeric_defaults(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["terrain_slope_deg"] = _safe_float(out.get("terrain_slope_deg"), 25.0)
    out["terrain_elevation_m"] = _safe_float(out.get("terrain_elevation_m"), 300.0)
    out["terrain_area_km2"] = _safe_float(out.get("terrain_area_km2"), 1.0)
    out["terrain_rain_72h"] = _safe_float(out.get("terrain_rain_72h"), 0.0)
    out["terrain_fos_proxy"] = _safe_float(out.get("terrain_fos_proxy"), 1.5)
    out["terrain_distance_to_unit_m"] = _safe_float(out.get("terrain_distance_to_unit_m"), 10000.0)

    out["matched_eq_mag"] = _safe_float(out.get("matched_eq_mag"), 0.0)
    out["matched_eq_depth_km"] = _safe_float(out.get("matched_eq_depth_km"), 0.0)
    out["matched_eq_distance_km"] = _safe_float(out.get("matched_eq_distance_km"), 999.0)
    out["matched_eq_time_delta_hours"] = _safe_float(out.get("matched_eq_time_delta_hours"), 999.0)
    out["matched_eq_pga_g"] = _safe_float(out.get("matched_eq_pga_g"), 0.0)
    out["matched_eq_pgv_cm_s"] = _safe_float(out.get("matched_eq_pgv_cm_s"), 0.0)
    out["matched_eq_mmi_estimate"] = _safe_float(out.get("matched_eq_mmi_estimate"), 0.0)

    out["sar_latest_value"] = _safe_float(out.get("sar_latest_value"), 0.0)
    out["sar_previous_value"] = _safe_float(out.get("sar_previous_value"), 0.0)
    out["sar_delta"] = _safe_float(out.get("sar_delta"), 0.0)
    out["sar_abs_delta"] = _safe_float(out.get("sar_abs_delta"), 0.0)

    out["fatality_count"] = _safe_float(out.get("fatality_count"), 0.0)
    out["injury_count"] = _safe_float(out.get("injury_count"), 0.0)
    out["earthquake_triggered"] = _safe_float(out.get("earthquake_triggered"), 0.0)
    out["dry_soil_shear_failure"] = _safe_float(out.get("dry_soil_shear_failure"), 0.0)
    out["dry_soil_shear_failure_proxy"] = _safe_float(out.get("dry_soil_shear_failure_proxy"), 0.0)
    return out


def _derive_material_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["cohesion_kpa"] = np.where(
        out["terrain_risk_level"].astype(str).str.upper().eq("RED"),
        8.0,
        np.where(out["terrain_risk_level"].astype(str).str.upper().eq("ORANGE"), 12.0, 18.0),
    )
    out["friction_angle_deg"] = np.where(
        out["terrain_slope_deg"] >= 30.0,
        24.0,
        np.where(out["terrain_slope_deg"] >= 20.0, 28.0, 32.0),
    )
    out["failure_depth_m"] = np.where(
        out["terrain_area_km2"] > 1.5,
        4.0,
        np.where(out["terrain_area_km2"] > 0.5, 3.0, 2.0),
    )
    out["saturation_ratio"] = _clip01(out["terrain_rain_72h"] / 150.0)
    return out


def _derive_physics_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    results = [
        compute_stability(
            slope_deg=float(row["terrain_slope_deg"]),
            cohesion_kpa=float(row["cohesion_kpa"]),
            friction_angle_deg=float(row["friction_angle_deg"]),
            failure_depth_m=float(row["failure_depth_m"]),
            saturation_ratio=float(row["saturation_ratio"]),
            pga_g=float(row["matched_eq_pga_g"]),
        )
        for _, row in out.iterrows()
    ]
    out["physics_fos_static"] = [item.fos_static for item in results]
    out["physics_fos_pseudostatic"] = [item.fos_pseudostatic for item in results]
    out["physics_critical_acceleration_g"] = [item.critical_acceleration_g for item in results]
    out["physics_newmark_displacement_cm"] = [item.newmark_displacement_cm for item in results]
    out["physics_dry_shear_probability"] = [item.dry_soil_shear_failure_probability for item in results]
    return out


def _derive_ml_targets(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["target_earthquake_triggered"] = (out["earthquake_triggered"] > 0).astype(int)
    category = out["landslide_category"].astype(str).str.lower()
    setting = out["landslide_setting"].astype(str).str.lower()

    inferred_dry_shear = (
        (out["target_earthquake_triggered"] == 1)
        & (out["saturation_ratio"] <= 0.35)
        & (
            (out["matched_eq_pga_g"] >= 0.008)
            | (out["matched_eq_mag"] >= 5.5)
            | (out["physics_newmark_displacement_cm"] >= 0.001)
        )
        & (
            category.isin(["rock_fall", "landslide", "complex", "unknown"])
            | setting.isin(["natural_slope", "above_road", "unknown"])
        )
    )

    out["target_dry_shear"] = np.where(
        out["dry_soil_shear_failure"] > 0,
        1,
        np.where(
            (out["dry_soil_shear_failure_proxy"] > 0) | inferred_dry_shear,
            1,
            0,
        ),
    )
    return out


def prepare_training_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df = _build_numeric_defaults(df)
    df = _derive_material_features(df)
    df = _derive_physics_features(df)
    df = _derive_ml_targets(df)
    return df


def build_training_table() -> Dict[str, Any]:
    paths = _paths()
    df = pd.read_csv(paths["input_csv"])
    df = prepare_training_dataframe(df)

    feature_columns: List[str] = [
        "terrain_slope_deg",
        "terrain_elevation_m",
        "terrain_area_km2",
        "terrain_rain_72h",
        "terrain_fos_proxy",
        "terrain_distance_to_unit_m",
        "matched_eq_mag",
        "matched_eq_depth_km",
        "matched_eq_distance_km",
        "matched_eq_time_delta_hours",
        "matched_eq_pga_g",
        "matched_eq_pgv_cm_s",
        "matched_eq_mmi_estimate",
        "sar_latest_value",
        "sar_previous_value",
        "sar_delta",
        "sar_abs_delta",
        "cohesion_kpa",
        "friction_angle_deg",
        "failure_depth_m",
        "saturation_ratio",
        "physics_fos_static",
        "physics_fos_pseudostatic",
        "physics_critical_acceleration_g",
        "physics_newmark_displacement_cm",
        "physics_dry_shear_probability",
        "fatality_count",
        "injury_count",
    ]

    keep_columns = [
        "event_id",
        "event_date",
        "region",
        "trigger",
        "trigger_group",
        "landslide_category",
        "landslide_size",
        "landslide_setting",
        "terrain_feature_status",
        "sar_feature_status",
        "seismic_lookup_status",
        "target_earthquake_triggered",
        "target_dry_shear",
    ] + feature_columns

    training_df = df[keep_columns].copy()
    training_df.to_csv(paths["output_csv"], index=False)

    summary = {
        "input_rows": int(len(df)),
        "training_rows": int(len(training_df)),
        "feature_columns": feature_columns,
        "earthquake_positive_count": int(training_df["target_earthquake_triggered"].sum()),
        "dry_shear_positive_count": int(training_df["target_dry_shear"].sum()),
        "rows_with_terrain_match": int((training_df["terrain_feature_status"] == "matched").sum()),
        "rows_with_sar_match": int((training_df["sar_feature_status"] == "matched").sum()),
        "rows_with_seismic_match": int((training_df["seismic_lookup_status"] == "matched").sum()),
        "output_csv_path": str(paths["output_csv"]),
    }
    with paths["output_json"].open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)
    return summary
