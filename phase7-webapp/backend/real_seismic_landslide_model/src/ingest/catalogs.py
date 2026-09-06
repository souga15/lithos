from __future__ import annotations

import csv
import json
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from src.config import load_project_config


@dataclass
class EventRecord:
    event_id: str
    source: str
    source_dataset: str
    latitude: float
    longitude: float
    trigger: str
    trigger_group: str
    event_date: str
    region: str
    location_accuracy: str
    landslide_category: str
    landslide_size: str
    landslide_setting: str
    country_name: str
    admin_division_name: str
    fatality_count: int
    injury_count: int
    landslide_occurrence: int
    earthquake_triggered: int
    dry_soil_shear_failure: int
    payload: Dict[str, Any]


def _resolve_path(base_dir: Path, relative_path: str) -> Path:
    return (base_dir / relative_path).resolve()


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value in ("", None):
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _normalize_text(value: Any, default: str = "unknown") -> str:
    text = str(value).strip().lower() if value not in (None, "") else default
    return text or default


def _normalize_date(value: Any) -> str:
    raw = str(value).strip()
    if not raw:
        return ""

    formats = (
        "%m/%d/%Y %I:%M:%S %p",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y",
        "%Y-%m-%d",
        "%d/%m/%Y %I:%M:%S %p",
        "%d/%m/%Y",
    )
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return raw


def _trigger_group(trigger: str) -> str:
    trigger = _normalize_text(trigger)
    rainfall_triggers = {"rain", "downpour", "monsoon", "tropical_cyclone", "storm", "cloudburst"}
    earthquake_triggers = {"earthquake", "seismic"}
    if trigger in rainfall_triggers:
        return "rainfall"
    if trigger in earthquake_triggers:
        return "earthquake"
    if trigger in {"rain_and_earthquake", "complex"}:
        return "mixed"
    return "unknown"


def _infer_region(latitude: float, longitude: float) -> str:
    region_boxes = {
        "cherrapunji": (25.0, 25.6, 91.4, 92.2),
        "sikkim": (27.0, 28.1, 88.0, 88.9),
        "manipur_nh2": (24.5, 25.5, 93.0, 94.5),
        "arunachal_w": (26.5, 28.0, 92.5, 94.0),
        "nagaland": (25.5, 27.0, 93.5, 95.0),
        "assam_hills": (25.5, 26.5, 91.5, 93.5),
        "wayanad": (11.4, 12.0, 75.7, 76.4),
        "idukki": (9.8, 10.4, 76.7, 77.4),
        "munnar": (10.0, 10.3, 77.0, 77.4),
    }
    for region, (lat_min, lat_max, lon_min, lon_max) in region_boxes.items():
        if lat_min <= latitude <= lat_max and lon_min <= longitude <= lon_max:
            return region
    return "external"


def _dry_shear_label(trigger: str, payload: Dict[str, Any]) -> int:
    trigger = _normalize_text(trigger)
    category = _normalize_text(payload.get("landslide_category"))
    setting = _normalize_text(payload.get("landslide_setting"))
    description = " ".join(
        [
            str(payload.get("event_title", "")),
            str(payload.get("event_description", "")),
            str(payload.get("notes", "")),
        ]
    ).lower()

    if trigger == "earthquake" and any(token in description for token in ("dry", "rock", "bluff", "collapse", "shear")):
        return 1
    if trigger == "earthquake" and category in {"rock_fall", "landslide", "complex"} and setting in {"natural_slope", "above_road", "unknown"}:
        return 1
    return 0


def _make_event_record(
    *,
    source_dataset: str,
    source: str,
    latitude: float,
    longitude: float,
    trigger: str,
    event_date: str,
    payload: Dict[str, Any],
    event_id: Optional[str] = None,
) -> EventRecord:
    normalized_trigger = _normalize_text(trigger)
    trigger_group = _trigger_group(normalized_trigger)
    region = _infer_region(latitude, longitude)
    earthquake_triggered = 1 if trigger_group == "earthquake" or normalized_trigger == "earthquake" else 0
    dry_shear = _dry_shear_label(normalized_trigger, payload)

    return EventRecord(
        event_id=event_id or f"{source_dataset}:{payload.get('event_import_id') or payload.get('event_id') or payload.get('date') or payload.get('event_date') or 'unknown'}:{latitude:.4f}:{longitude:.4f}",
        source=source,
        source_dataset=source_dataset,
        latitude=latitude,
        longitude=longitude,
        trigger=normalized_trigger,
        trigger_group=trigger_group,
        event_date=_normalize_date(event_date),
        region=region,
        location_accuracy=_normalize_text(payload.get("location_accuracy")),
        landslide_category=_normalize_text(payload.get("landslide_category")),
        landslide_size=_normalize_text(payload.get("landslide_size")),
        landslide_setting=_normalize_text(payload.get("landslide_setting")),
        country_name=str(payload.get("country_name", "unknown")).strip() or "unknown",
        admin_division_name=str(payload.get("admin_division_name", "unknown")).strip() or "unknown",
        fatality_count=_safe_int(payload.get("fatality_count")),
        injury_count=_safe_int(payload.get("injury_count")),
        landslide_occurrence=1,
        earthquake_triggered=earthquake_triggered,
        dry_soil_shear_failure=dry_shear,
        payload=payload,
    )


def load_json_events(json_path: Path) -> List[EventRecord]:
    with json_path.open("r", encoding="utf-8") as handle:
        records = json.load(handle)

    if isinstance(records, dict):
        records = records.get("landslides", [])

    events: List[EventRecord] = []
    for record in records:
        try:
            events.append(
                _make_event_record(
                    source_dataset=json_path.stem,
                    source=str(record.get("source", json_path.name)),
                    latitude=float(record["lat"]),
                    longitude=float(record["lon"]),
                    trigger=str(record.get("trigger", "unknown")),
                    event_date=str(record.get("date", "")),
                    payload=record,
                    event_id=str(record.get("event_id") or record.get("id") or ""),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    return events


def load_csv_events(csv_path: Path) -> List[EventRecord]:
    events: List[EventRecord] = []
    with csv_path.open("r", encoding="utf-8", errors="replace") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            try:
                events.append(
                    _make_event_record(
                        source_dataset=csv_path.stem,
                        source=str(row.get("source_name") or csv_path.name),
                        latitude=float(row["latitude"]),
                        longitude=float(row["longitude"]),
                        trigger=str(row.get("landslide_trigger", "unknown")),
                        event_date=str(row.get("event_date", "")),
                        payload=row,
                        event_id=str(row.get("event_id") or row.get("event_import_id") or ""),
                    )
                )
            except (KeyError, TypeError, ValueError):
                continue
    return events


def load_local_event_catalogs() -> List[EventRecord]:
    """Load all currently configured local landslide records."""
    config = load_project_config()
    project_root = Path(__file__).resolve().parents[2]
    path_cfg = config["paths"]

    records: List[EventRecord] = []
    records.extend(load_json_events(_resolve_path(project_root, path_cfg["local_landslides_json"])))
    records.extend(load_csv_events(_resolve_path(project_root, path_cfg["nasa_landslides_csv"])))
    records.extend(load_csv_events(_resolve_path(project_root, path_cfg["kerala_landslides_csv"])))
    records.extend(load_csv_events(_resolve_path(project_root, path_cfg["northeast_landslides_csv"])))
    return records


def summarize_triggers(events: Iterable[EventRecord]) -> Dict[str, int]:
    summary: Dict[str, int] = {}
    for event in events:
        summary[event.trigger] = summary.get(event.trigger, 0) + 1
    return dict(sorted(summary.items(), key=lambda item: item[0]))


def summarize_trigger_groups(events: Iterable[EventRecord]) -> Dict[str, int]:
    summary: Dict[str, int] = {}
    for event in events:
        summary[event.trigger_group] = summary.get(event.trigger_group, 0) + 1
    return dict(sorted(summary.items(), key=lambda item: item[0]))


def summarize_regions(events: Iterable[EventRecord]) -> Dict[str, int]:
    summary: Dict[str, int] = {}
    for event in events:
        summary[event.region] = summary.get(event.region, 0) + 1
    return dict(sorted(summary.items(), key=lambda item: item[0]))


def deduplicate_events(events: Iterable[EventRecord]) -> List[EventRecord]:
    """Deduplicate records using date, rounded coordinates, and trigger.

    When duplicate keys exist, keep the richer record so we preserve the most
    useful metadata for later trigger and dry-shear labeling.
    """
    best_by_key: Dict[tuple[str, float, float, str], EventRecord] = {}

    for event in events:
        key = (
            event.event_date,
            round(event.latitude, 3),
            round(event.longitude, 3),
            event.trigger,
        )
        current = best_by_key.get(key)
        if current is None or _record_richness(event) > _record_richness(current):
            best_by_key[key] = event
    return list(best_by_key.values())


def _record_richness(event: EventRecord) -> int:
    rich_fields = [
        event.country_name,
        event.admin_division_name,
        event.location_accuracy,
        event.landslide_category,
        event.landslide_size,
        event.landslide_setting,
        event.trigger_group,
    ]
    score = sum(1 for value in rich_fields if _normalize_text(value) != "unknown")

    if event.source_dataset != "processed_landslides":
        score += 2
    if any(_normalize_text(value) != "unknown" for value in event.payload.values()):
        score += 1
    return score


def events_to_rows(events: Iterable[EventRecord]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for event in events:
        rows.append(
            {
                "event_id": event.event_id,
                "source": event.source,
                "source_dataset": event.source_dataset,
                "event_date": event.event_date,
                "latitude": event.latitude,
                "longitude": event.longitude,
                "region": event.region,
                "country_name": event.country_name,
                "admin_division_name": event.admin_division_name,
                "trigger": event.trigger,
                "trigger_group": event.trigger_group,
                "location_accuracy": event.location_accuracy,
                "landslide_category": event.landslide_category,
                "landslide_size": event.landslide_size,
                "landslide_setting": event.landslide_setting,
                "fatality_count": event.fatality_count,
                "injury_count": event.injury_count,
                "landslide_occurrence": event.landslide_occurrence,
                "earthquake_triggered": event.earthquake_triggered,
                "dry_soil_shear_failure": event.dry_soil_shear_failure,
            }
        )
    return rows


def summarize_datasets(events: Iterable[EventRecord]) -> Dict[str, int]:
    counter = Counter(event.source_dataset for event in events)
    return dict(sorted(counter.items(), key=lambda item: item[0]))
