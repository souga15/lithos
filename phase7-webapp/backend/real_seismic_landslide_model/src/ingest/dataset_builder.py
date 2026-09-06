from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

from src.config import load_project_config
from src.ingest.catalogs import (
    deduplicate_events,
    events_to_rows,
    load_local_event_catalogs,
    summarize_datasets,
    summarize_regions,
    summarize_trigger_groups,
    summarize_triggers,
)


@dataclass
class DatasetBuildResult:
    raw_event_count: int
    deduplicated_event_count: int
    output_csv_path: Path
    output_json_path: Path
    summary: Dict[str, Any]


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _processed_dir() -> Path:
    config = load_project_config()
    path = _project_root() / config["paths"]["processed_dir"]
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def _write_csv(rows: List[Dict[str, Any]], output_path: Path) -> None:
    if not rows:
        raise ValueError("Cannot write an empty dataset.")

    fieldnames = list(rows[0].keys())
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _write_json(summary: Dict[str, Any], output_path: Path) -> None:
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)


def build_local_training_dataset() -> DatasetBuildResult:
    events = load_local_event_catalogs()
    unique_events = deduplicate_events(events)
    rows = events_to_rows(unique_events)

    processed_dir = _processed_dir()
    output_csv_path = processed_dir / "normalized_landslide_events.csv"
    output_json_path = processed_dir / "normalized_landslide_events_summary.json"

    summary: Dict[str, Any] = {
        "raw_event_count": len(events),
        "deduplicated_event_count": len(unique_events),
        "datasets": summarize_datasets(unique_events),
        "triggers": summarize_triggers(unique_events),
        "trigger_groups": summarize_trigger_groups(unique_events),
        "regions": summarize_regions(unique_events),
        "label_counts": {
            "landslide_occurrence": sum(row["landslide_occurrence"] for row in rows),
            "earthquake_triggered": sum(row["earthquake_triggered"] for row in rows),
            "dry_soil_shear_failure": sum(row["dry_soil_shear_failure"] for row in rows),
        },
        "columns": list(rows[0].keys()) if rows else [],
    }

    _write_csv(rows, output_csv_path)
    _write_json(summary, output_json_path)

    return DatasetBuildResult(
        raw_event_count=len(events),
        deduplicated_event_count=len(unique_events),
        output_csv_path=output_csv_path,
        output_json_path=output_json_path,
        summary=summary,
    )
