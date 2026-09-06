from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Tuple

import joblib
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier

from src.config import load_project_config
from src.features.seismic_features import choose_best_usgs_match
from src.features.training_table import build_training_table, prepare_training_dataframe
from src.ingest.usgs_catalog import fetch_usgs_events_global_window


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _paths() -> Dict[str, Path]:
    config = load_project_config()
    root = _project_root()
    return {
        "training_csv": (root / config["paths"]["training_table_csv"]).resolve(),
        "trigger_model": (root / config["model"]["trigger_model_path"]).resolve(),
        "trigger_metadata": (root / config["model"]["trigger_model_metadata_path"]).resolve(),
        "dry_model": (root / config["model"]["dry_shear_model_path"]).resolve(),
        "dry_metadata": (root / config["model"]["dry_shear_model_metadata_path"]).resolve(),
    }


def _metrics(y_true, y_score, y_pred) -> Dict[str, float]:
    metrics = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
    }
    if len(set(y_true)) > 1:
        metrics["roc_auc"] = float(roc_auc_score(y_true, y_score))
    else:
        metrics["roc_auc"] = 0.0
    return metrics


def _safe_training_source() -> pd.DataFrame:
    config = load_project_config()
    root = _project_root()
    source_path = (root / config["paths"]["local_geospatial_enriched_csv"]).resolve()
    return pd.read_csv(source_path)


def _sample_earthquake_case_control(df: pd.DataFrame) -> pd.DataFrame:
    config = load_project_config()
    neg_ratio = int(config["evaluation"]["earthquake_negative_ratio"])
    seed = int(config["evaluation"]["random_seed"])

    work = df.copy()
    work["event_date"] = pd.to_datetime(work["event_date"], errors="coerce")
    work["event_year"] = work["event_date"].dt.year

    positives = work[work["earthquake_triggered"].astype(int) == 1].copy()
    negative_pool = work[(work["earthquake_triggered"].astype(int) == 0) & work["event_year"].notna()].copy()

    sampled_negatives = []
    for year, pos_group in positives.groupby("event_year"):
        year_pool = negative_pool[negative_pool["event_year"] == year]
        if year_pool.empty:
            continue
        sample_n = min(len(year_pool), max(len(pos_group) * neg_ratio, 1))
        sampled_negatives.append(year_pool.sample(n=sample_n, random_state=seed))

    negatives = pd.concat(sampled_negatives, ignore_index=True) if sampled_negatives else negative_pool.head(0).copy()
    candidate = pd.concat([positives, negatives], ignore_index=True).drop_duplicates(subset=["event_id"])
    candidate["event_date"] = candidate["event_date"].dt.date.astype(str)
    enriched_df = _offline_bulk_seismic_match(candidate)
    return prepare_training_dataframe(enriched_df)


def _offline_bulk_seismic_match(candidate: pd.DataFrame) -> pd.DataFrame:
    config = load_project_config()
    seismic_cfg = config["seismic"]
    years = sorted({int(year) for year in pd.to_datetime(candidate["event_date"], errors="coerce").dt.year.dropna().unique()})
    events_by_year: Dict[int, list] = {}

    for year in years:
        events_by_year[year] = fetch_usgs_events_global_window(
            start_date=f"{year}-01-01",
            end_date=f"{year}-12-31",
            min_magnitude=float(seismic_cfg["min_magnitude"]),
            use_cache=True,
        )

    rows = candidate.to_dict(orient="records")
    enriched_rows = []
    time_window_days = int(seismic_cfg["time_window_days"])
    search_radius_km = float(seismic_cfg["search_radius_km"])
    pga_cap_g = float(seismic_cfg["pga_cap_g"])

    for row in rows:
        new_row = dict(row)
        year = pd.to_datetime(row["event_date"], errors="coerce").year
        yearly_events = events_by_year.get(int(year), [])

        row_date = pd.to_datetime(row["event_date"], errors="coerce").date()
        filtered_events = []
        for event in yearly_events:
            event_date = pd.to_datetime(event.time_utc, errors="coerce").date()
            if abs((event_date - row_date).days) <= time_window_days:
                filtered_events.append(event)

        match = choose_best_usgs_match(row=row, events=filtered_events, pga_cap_g=pga_cap_g)
        if match is None or match.distance_km > search_radius_km:
            new_row.update(
                {
                    "matched_eq_event_id": "",
                    "matched_eq_mag": 0.0,
                    "matched_eq_depth_km": 0.0,
                    "matched_eq_distance_km": 999.0,
                    "matched_eq_time_delta_hours": 999.0,
                    "matched_eq_pga_g": 0.0,
                    "matched_eq_pgv_cm_s": 0.0,
                    "matched_eq_mmi_estimate": 0.0,
                    "matched_eq_place": "",
                    "matched_eq_time_utc": "",
                    "seismic_lookup_status": "no_match",
                    "seismic_feature_source": "usgs_bulk",
                    "dry_soil_shear_failure_proxy": 0,
                }
            )
        else:
            new_row.update(
                {
                    "matched_eq_event_id": match.event_id,
                    "matched_eq_mag": round(match.magnitude, 4),
                    "matched_eq_depth_km": round(match.depth_km, 4),
                    "matched_eq_distance_km": round(match.distance_km, 4),
                    "matched_eq_time_delta_hours": round(match.time_delta_hours, 4),
                    "matched_eq_pga_g": round(match.pga_g, 6),
                    "matched_eq_pgv_cm_s": round(match.pgv_cm_s, 6),
                    "matched_eq_mmi_estimate": round(match.mmi_estimate, 4),
                    "matched_eq_place": match.source_place,
                    "matched_eq_time_utc": match.source_time_utc,
                    "seismic_lookup_status": "matched",
                    "seismic_feature_source": "usgs_bulk",
                    "dry_soil_shear_failure_proxy": int(
                        int(float(new_row.get("earthquake_triggered", 0))) == 1
                        and match.pga_g >= 0.12
                    ),
                }
            )
        enriched_rows.append(new_row)

    return pd.DataFrame(enriched_rows)


def _make_pipeline(scale_pos_weight: float) -> Pipeline:
    return Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            (
                "model",
                XGBClassifier(
                    n_estimators=180,
                    max_depth=4,
                    learning_rate=0.06,
                    subsample=0.9,
                    colsample_bytree=0.9,
                    reg_lambda=1.0,
                    objective="binary:logistic",
                    eval_metric="logloss",
                    random_state=42,
                    scale_pos_weight=max(scale_pos_weight, 1.0),
                ),
            ),
        ]
    )


def _numeric_feature_columns(df: pd.DataFrame) -> list[str]:
    excluded_columns = {
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
        "earthquake_triggered",
        "dry_soil_shear_failure",
        "dry_soil_shear_failure_proxy",
        "landslide_occurrence",
        "terrain_unit_id",
        "target_earthquake_triggered",
        "target_dry_shear",
    }
    return [
        column
        for column in df.columns
        if column not in excluded_columns and pd.api.types.is_numeric_dtype(df[column])
    ]


def _group_split(df: pd.DataFrame, groups: pd.Series, test_size: float = 0.2) -> tuple[pd.DataFrame, pd.DataFrame]:
    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=42)
    train_idx, test_idx = next(splitter.split(df, groups=groups))
    return df.iloc[train_idx].copy(), df.iloc[test_idx].copy()


def _train_one(df: pd.DataFrame, target_column: str, groups: pd.Series | None = None) -> Tuple[Pipeline, Dict[str, Any]]:
    feature_columns = _numeric_feature_columns(df)
    x = df[feature_columns]
    y = df[target_column].astype(int)

    if groups is not None:
        grouped = df.copy()
        grouped["_target"] = y
        train_df, test_df = _group_split(grouped, groups=groups)
        x_train = train_df[feature_columns]
        y_train = train_df["_target"].astype(int)
        x_test = test_df[feature_columns]
        y_test = test_df["_target"].astype(int)
    else:
        x_train, x_test, y_train, y_test = train_test_split(
            x,
            y,
            test_size=0.2,
            random_state=42,
            stratify=y if len(set(y)) > 1 else None,
        )

    positives = max(int(y_train.sum()), 1)
    negatives = max(len(y_train) - positives, 1)
    pipeline = _make_pipeline(scale_pos_weight=negatives / positives)
    pipeline.fit(x_train, y_train)

    probabilities = pipeline.predict_proba(x_test)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    metadata = {
        "target_column": target_column,
        "feature_columns": feature_columns,
        "train_rows": int(len(x_train)),
        "test_rows": int(len(x_test)),
        "positive_rows": int(y.sum()),
        "metrics": _metrics(y_test, probabilities, predictions),
    }
    return pipeline, metadata


def train_hybrid_models() -> Dict[str, Any]:
    build_training_table()
    paths = _paths()
    training_df = pd.read_csv(paths["training_csv"])
    earthquake_case_control_df = _sample_earthquake_case_control(_safe_training_source())
    earthquake_groups = earthquake_case_control_df["event_date"].astype(str).fillna("unknown")
    dry_df = earthquake_case_control_df[earthquake_case_control_df["target_earthquake_triggered"] == 1].copy()
    dry_groups = dry_df["event_date"].astype(str).fillna("unknown")

    trigger_model, trigger_meta = _train_one(
        earthquake_case_control_df,
        "target_earthquake_triggered",
        groups=earthquake_groups,
    )
    dry_model, dry_meta = _train_one(
        dry_df,
        "target_dry_shear",
        groups=dry_groups,
    )
    trigger_meta["evaluation_mode"] = "grouped_case_control_by_event_date"
    trigger_meta["candidate_rows"] = int(len(earthquake_case_control_df))
    dry_meta["evaluation_mode"] = "grouped_earthquake_only_by_event_date"
    dry_meta["candidate_rows"] = int(len(dry_df))

    paths["trigger_model"].parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(trigger_model, paths["trigger_model"])
    joblib.dump(dry_model, paths["dry_model"])

    with paths["trigger_metadata"].open("w", encoding="utf-8") as handle:
        json.dump(trigger_meta, handle, indent=2)
    with paths["dry_metadata"].open("w", encoding="utf-8") as handle:
        json.dump(dry_meta, handle, indent=2)

    return {
        "trigger_model_path": str(paths["trigger_model"]),
        "dry_model_path": str(paths["dry_model"]),
        "trigger_metrics": trigger_meta["metrics"],
        "dry_metrics": dry_meta["metrics"],
    }
