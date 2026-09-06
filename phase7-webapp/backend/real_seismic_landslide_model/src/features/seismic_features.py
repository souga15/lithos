from __future__ import annotations

import csv
import json
import math
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from requests import RequestException

from src.config import load_project_config
from src.ingest.usgs_catalog import UsgsEvent, fetch_usgs_events


@dataclass
class SeismicMatch:
    event_id: str
    magnitude: float
    depth_km: float
    distance_km: float
    time_delta_hours: float
    pga_g: float
    pgv_cm_s: float
    mmi_estimate: float
    source_place: str
    source_time_utc: str
    lookup_status: str


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _paths() -> Dict[str, Path]:
    config = load_project_config()
    root = _project_root()
    return {
        "input_csv": (root / config["paths"]["normalized_events_csv"]).resolve(),
        "output_csv": (root / config["paths"]["seismic_enriched_csv"]).resolve(),
        "output_json": (root / config["paths"]["seismic_enriched_summary_json"]).resolve(),
    }


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2.0) ** 2
    )
    return 2.0 * radius_km * math.asin(math.sqrt(a))


def estimate_pga_g(magnitude: float, distance_km: float, depth_km: float, pga_cap_g: float = 1.5) -> float:
    effective_distance = math.sqrt(max(distance_km, 1.0) ** 2 + max(depth_km, 1.0) ** 2)
    raw = 0.12 * (10 ** (0.32 * (magnitude - 5.0))) / ((effective_distance + 5.0) ** 0.95)
    return max(0.0, min(pga_cap_g, raw))


def estimate_pgv_cm_s(magnitude: float, distance_km: float) -> float:
    return max(0.0, 18.0 * (10 ** (0.23 * (magnitude - 5.0))) / ((max(distance_km, 1.0) + 5.0) ** 0.7))


def estimate_mmi(pga_g: float) -> float:
    if pga_g <= 0.0:
        return 0.0
    return max(1.0, min(12.0, 3.0 + 3.0 * math.log10((pga_g * 980.665) + 1.0)))


def _time_delta_hours(event_date: str, event_time_utc: str) -> float:
    observed = datetime.fromisoformat(event_date)
    seismic = datetime.fromisoformat(event_time_utc)
    return abs((seismic - observed).total_seconds()) / 3600.0


def choose_best_usgs_match(
    *,
    row: Dict[str, Any],
    events: Iterable[UsgsEvent],
    pga_cap_g: float,
) -> Optional[SeismicMatch]:
    candidates: List[SeismicMatch] = []
    row_lat = float(row["latitude"])
    row_lon = float(row["longitude"])
    row_date = row["event_date"]

    for event in events:
        distance_km = haversine_km(row_lat, row_lon, event.latitude, event.longitude)
        time_delta_hours = _time_delta_hours(row_date, event.time_utc[:19])
        pga_g = estimate_pga_g(event.magnitude, distance_km, event.depth_km, pga_cap_g=pga_cap_g)
        candidates.append(
            SeismicMatch(
                event_id=event.event_id,
                magnitude=event.magnitude,
                depth_km=event.depth_km,
                distance_km=distance_km,
                time_delta_hours=time_delta_hours,
                pga_g=pga_g,
                pgv_cm_s=estimate_pgv_cm_s(event.magnitude, distance_km),
                mmi_estimate=estimate_mmi(pga_g),
                source_place=event.place,
                source_time_utc=event.time_utc,
                lookup_status="matched",
            )
        )

    if not candidates:
        return None

    return max(
        candidates,
        key=lambda candidate: (
            candidate.pga_g,
            candidate.magnitude,
            -candidate.time_delta_hours,
            -candidate.distance_km,
        ),
    )


def _default_seismic_columns() -> Dict[str, Any]:
    return {
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
        "seismic_lookup_status": "not_attempted",
        "seismic_feature_source": "none",
        "dry_soil_shear_failure_proxy": 0,
    }


def _parse_bool(value: Any) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes"}


def enrich_rows_with_seismic_features(rows: List[Dict[str, Any]], force_lookup: bool = False) -> List[Dict[str, Any]]:
    config = load_project_config()
    seismic_cfg = config["seismic"]
    enriched: List[Dict[str, Any]] = []

    for row in rows:
        new_row = dict(row)
        new_row.update(_default_seismic_columns())

        should_lookup = force_lookup or _parse_bool(row.get("earthquake_triggered", 0)) or seismic_cfg["fallback_lookup_for_nonearthquake_rows"]
        if not should_lookup or not row.get("event_date"):
            if _parse_bool(row.get("earthquake_triggered", 0)):
                new_row["seismic_lookup_status"] = "missing_date"
            enriched.append(new_row)
            continue

        try:
            events = fetch_usgs_events(
                latitude=float(row["latitude"]),
                longitude=float(row["longitude"]),
                event_date=str(row["event_date"]),
                radius_km=float(seismic_cfg["search_radius_km"]),
                min_magnitude=float(seismic_cfg["min_magnitude"]),
                time_window_days=int(seismic_cfg["time_window_days"]),
                use_cache=True,
            )
            match = choose_best_usgs_match(row=row, events=events, pga_cap_g=float(seismic_cfg["pga_cap_g"]))
            if match is None:
                new_row["seismic_lookup_status"] = "no_match"
                enriched.append(new_row)
                continue

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
                    "seismic_lookup_status": match.lookup_status,
                    "seismic_feature_source": "usgs",
                    "dry_soil_shear_failure_proxy": int(
                        _parse_bool(row.get("earthquake_triggered", 0))
                        and float(match.pga_g) >= 0.12
                        and str(row.get("trigger_group", "")).strip().lower() == "earthquake"
                    ),
                }
            )
        except (RequestException, ValueError):
            new_row["seismic_lookup_status"] = "lookup_error"

        enriched.append(new_row)

    return enriched


def _read_csv(path: Path) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def _write_csv(path: Path, rows: List[Dict[str, Any]]) -> None:
    if not rows:
        raise ValueError("Cannot write empty seismic enrichment output.")
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def build_seismic_enriched_dataset() -> Dict[str, Any]:
    paths = _paths()
    rows = _read_csv(paths["input_csv"])
    enriched_rows = enrich_rows_with_seismic_features(rows)
    _write_csv(paths["output_csv"], enriched_rows)

    matched = sum(1 for row in enriched_rows if row["seismic_lookup_status"] == "matched")
    summary = {
        "input_row_count": len(rows),
        "output_row_count": len(enriched_rows),
        "matched_rows": matched,
        "lookup_status_counts": {
            status: sum(1 for row in enriched_rows if row["seismic_lookup_status"] == status)
            for status in sorted({row["seismic_lookup_status"] for row in enriched_rows})
        },
        "proxy_dry_soil_shear_failures": sum(int(row["dry_soil_shear_failure_proxy"]) for row in enriched_rows),
        "output_csv_path": str(paths["output_csv"]),
    }
    _write_json(paths["output_json"], summary)
    return summary
