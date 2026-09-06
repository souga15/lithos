from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Tuple

import geopandas as gpd
import pandas as pd
import rasterio
from rasterio.errors import RasterioIOError
from shapely.geometry import Point

from src.config import load_project_config


@dataclass
class SarFeatureSet:
    latest: float
    previous: float
    delta: float
    abs_delta: float
    status: str


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _paths() -> Dict[str, Path]:
    config = load_project_config()
    root = _project_root()
    return {
        "normalized_csv": (root / config["paths"]["normalized_events_csv"]).resolve(),
        "seismic_csv": (root / config["paths"]["seismic_enriched_csv"]).resolve(),
        "output_csv": (root / config["paths"]["local_geospatial_enriched_csv"]).resolve(),
        "output_json": (root / config["paths"]["local_geospatial_summary_json"]).resolve(),
        "slope_units_gpkg": (root / config["paths"]["slope_units_gpkg"]).resolve(),
        "sar_dir": (root / config["paths"]["sar_dir"]).resolve(),
    }


def choose_input_csv() -> Path:
    paths = _paths()
    return paths["seismic_csv"] if paths["seismic_csv"].exists() else paths["normalized_csv"]


@lru_cache(maxsize=1)
def load_slope_units() -> gpd.GeoDataFrame:
    gpkg_path = _paths()["slope_units_gpkg"]
    return gpd.read_file(gpkg_path)


def _points_from_dataframe(df: pd.DataFrame) -> gpd.GeoDataFrame:
    geometry = [Point(float(lon), float(lat)) for lat, lon in zip(df["latitude"], df["longitude"])]
    return gpd.GeoDataFrame(df.copy(), geometry=geometry, crs="EPSG:4326")


def _empty_terrain_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["terrain_unit_id"] = ""
    df["terrain_region_source"] = ""
    df["terrain_slope_deg"] = 0.0
    df["terrain_elevation_m"] = 0.0
    df["terrain_area_km2"] = 0.0
    df["terrain_rain_72h"] = 0.0
    df["terrain_fos_proxy"] = 0.0
    df["terrain_risk_level"] = ""
    df["terrain_distance_to_unit_m"] = 0.0
    df["terrain_feature_status"] = "not_attempted"
    return df


def enrich_with_slope_units(df: pd.DataFrame) -> pd.DataFrame:
    slope_gdf = load_slope_units()
    result_frames: list[pd.DataFrame] = []
    df = _empty_terrain_columns(df)
    base_columns = [column for column in df.columns if not column.startswith("terrain_")]

    for region, group in df.groupby("region", dropna=False):
        if region == "external":
            external = group.copy()
            external["terrain_feature_status"] = "out_of_region"
            result_frames.append(external)
            continue

        subset = slope_gdf[slope_gdf["region"] == region].copy()
        if subset.empty:
            missing = group.copy()
            missing["terrain_feature_status"] = "missing_region_units"
            result_frames.append(missing)
            continue

        event_gdf = _points_from_dataframe(group)
        event_gdf = event_gdf.to_crs("EPSG:3857")
        subset = subset.to_crs("EPSG:3857")

        joined = gpd.sjoin_nearest(
            event_gdf,
            subset[
                [
                    "unit_id",
                    "region",
                    "slope_degrees",
                    "elevation_m",
                    "area_km2",
                    "rain_72h",
                    "fos",
                    "risk_level",
                    "geometry",
                ]
            ],
            how="left",
            distance_col="terrain_distance_to_unit_m",
        )

        joined = joined.drop(columns=["index_right"], errors="ignore").to_crs("EPSG:4326")
        if "region_left" in joined.columns:
            joined = joined.rename(columns={"region_left": "region"})
        joined["terrain_unit_id"] = joined["unit_id"].astype(str)
        joined["terrain_region_source"] = joined["region_right"].fillna("").astype(str) if "region_right" in joined.columns else str(region)
        joined["terrain_slope_deg"] = joined["slope_degrees"].fillna(0.0)
        joined["terrain_elevation_m"] = joined["elevation_m"].fillna(0.0)
        joined["terrain_area_km2"] = joined["area_km2"].fillna(0.0)
        joined["terrain_rain_72h"] = joined["rain_72h"].fillna(0.0)
        joined["terrain_fos_proxy"] = joined["fos"].fillna(0.0)
        joined["terrain_risk_level"] = joined["risk_level"].fillna("").astype(str)
        joined["terrain_feature_status"] = "matched"

        keep_columns = list(base_columns) + [
            "terrain_unit_id",
            "terrain_region_source",
            "terrain_slope_deg",
            "terrain_elevation_m",
            "terrain_area_km2",
            "terrain_rain_72h",
            "terrain_fos_proxy",
            "terrain_risk_level",
            "terrain_distance_to_unit_m",
            "terrain_feature_status",
        ]
        result_frames.append(pd.DataFrame(joined[keep_columns]))

    combined = pd.concat(result_frames, ignore_index=True)
    return combined


def _sample_raster_value(dataset: rasterio.io.DatasetReader, longitude: float, latitude: float) -> float | None:
    try:
        row = next(dataset.sample([(longitude, latitude)]))
        value = float(row[0])
        return value
    except (StopIteration, ValueError, RasterioIOError):
        return None


def _compute_sar_features(latest: float | None, previous: float | None) -> SarFeatureSet:
    if latest is None or previous is None:
        return SarFeatureSet(latest=0.0, previous=0.0, delta=0.0, abs_delta=0.0, status="missing_sample")
    delta = latest - previous
    return SarFeatureSet(
        latest=latest,
        previous=previous,
        delta=delta,
        abs_delta=abs(delta),
        status="matched",
    )


def _sar_pair_for_region(region: str) -> Tuple[Path, Path] | None:
    sar_dir = _paths()["sar_dir"]
    latest = sar_dir / f"{region}_latest.tif"
    previous = sar_dir / f"{region}_previous.tif"
    if latest.exists() and previous.exists():
        return latest, previous
    return None


def enrich_with_sar(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["sar_latest_value"] = 0.0
    df["sar_previous_value"] = 0.0
    df["sar_delta"] = 0.0
    df["sar_abs_delta"] = 0.0
    df["sar_feature_status"] = "not_attempted"

    for index, row in df.iterrows():
        region = str(row.get("region", "external"))
        if region == "external":
            df.at[index, "sar_feature_status"] = "out_of_region"
            continue

        pair = _sar_pair_for_region(region)
        if pair is None:
            df.at[index, "sar_feature_status"] = "missing_region_rasters"
            continue

        latest_path, previous_path = pair
        with rasterio.open(latest_path) as latest_ds, rasterio.open(previous_path) as previous_ds:
            latest_value = _sample_raster_value(latest_ds, float(row["longitude"]), float(row["latitude"]))
            previous_value = _sample_raster_value(previous_ds, float(row["longitude"]), float(row["latitude"]))

        features = _compute_sar_features(latest_value, previous_value)
        df.at[index, "sar_latest_value"] = round(features.latest, 6)
        df.at[index, "sar_previous_value"] = round(features.previous, 6)
        df.at[index, "sar_delta"] = round(features.delta, 6)
        df.at[index, "sar_abs_delta"] = round(features.abs_delta, 6)
        df.at[index, "sar_feature_status"] = features.status

    return df


def build_local_geospatial_dataset() -> Dict[str, Any]:
    paths = _paths()
    input_csv = choose_input_csv()
    df = pd.read_csv(input_csv)
    terrain_df = enrich_with_slope_units(df)
    geospatial_df = enrich_with_sar(terrain_df)
    geospatial_df.to_csv(paths["output_csv"], index=False)

    summary = {
        "input_csv_path": str(input_csv),
        "output_csv_path": str(paths["output_csv"]),
        "row_count": int(len(geospatial_df)),
        "terrain_status_counts": geospatial_df["terrain_feature_status"].value_counts(dropna=False).to_dict(),
        "sar_status_counts": geospatial_df["sar_feature_status"].value_counts(dropna=False).to_dict(),
        "internal_region_rows": int((geospatial_df["region"] != "external").sum()),
    }
    with paths["output_json"].open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)
    return summary
