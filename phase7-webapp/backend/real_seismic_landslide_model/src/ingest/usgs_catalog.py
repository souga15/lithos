from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

from src.config import load_project_config


@dataclass
class UsgsEvent:
    event_id: str
    time_utc: str
    magnitude: float
    place: str
    latitude: float
    longitude: float
    depth_km: float
    detail_url: str


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _cache_path() -> Path:
    config = load_project_config()
    path = _project_root() / config["paths"]["usgs_cache_json"]
    path.parent.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def load_cache() -> Dict[str, Any]:
    path = _cache_path()
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_cache(cache: Dict[str, Any]) -> None:
    path = _cache_path()
    with path.open("w", encoding="utf-8") as handle:
        json.dump(cache, handle, indent=2)


def _date_range(event_date: str, time_window_days: int) -> tuple[str, str]:
    event_day = date.fromisoformat(event_date)
    start = event_day - timedelta(days=time_window_days)
    end = event_day + timedelta(days=time_window_days)
    return start.isoformat(), end.isoformat()


def _cache_key(
    latitude: float,
    longitude: float,
    event_date: str,
    radius_km: float,
    min_magnitude: float,
    time_window_days: int,
) -> str:
    return ":".join(
        [
            f"{latitude:.3f}",
            f"{longitude:.3f}",
            event_date,
            f"{radius_km:.1f}",
            f"{min_magnitude:.1f}",
            str(time_window_days),
        ]
    )


def _parse_feature(feature: Dict[str, Any]) -> Optional[UsgsEvent]:
    try:
        properties = feature["properties"]
        geometry = feature["geometry"]
        coordinates = geometry["coordinates"]
        return UsgsEvent(
            event_id=str(feature["id"]),
            time_utc=datetime.utcfromtimestamp(properties["time"] / 1000.0).isoformat(),
            magnitude=float(properties["mag"]),
            place=str(properties.get("place", "")),
            longitude=float(coordinates[0]),
            latitude=float(coordinates[1]),
            depth_km=float(coordinates[2]),
            detail_url=str(properties.get("detail", "")),
        )
    except (KeyError, TypeError, ValueError, IndexError):
        return None


def fetch_usgs_events(
    *,
    latitude: float,
    longitude: float,
    event_date: str,
    radius_km: float,
    min_magnitude: float,
    time_window_days: int,
    use_cache: bool = True,
) -> List[UsgsEvent]:
    config = load_project_config()
    seismic_cfg = config["seismic"]
    cache = load_cache() if use_cache else {}
    key = _cache_key(latitude, longitude, event_date, radius_km, min_magnitude, time_window_days)

    if use_cache and key in cache:
        return [UsgsEvent(**item) for item in cache[key]]

    start_date, end_date = _date_range(event_date, time_window_days)
    params = {
        "format": "geojson",
        "starttime": start_date,
        "endtime": end_date,
        "latitude": latitude,
        "longitude": longitude,
        "maxradiuskm": radius_km,
        "minmagnitude": min_magnitude,
        "orderby": "time",
    }

    session = requests.Session()
    session.trust_env = False
    response = session.get(seismic_cfg["usgs_event_api_url"], params=params, timeout=20)
    response.raise_for_status()
    payload = response.json()
    events: List[UsgsEvent] = []
    for feature in payload.get("features", []):
        parsed = _parse_feature(feature)
        if parsed is not None:
            events.append(parsed)

    if use_cache:
        cache[key] = [event.__dict__ for event in events]
        save_cache(cache)
    return events


def fetch_usgs_events_global_window(
    *,
    start_date: str,
    end_date: str,
    min_magnitude: float,
    use_cache: bool = True,
) -> List[UsgsEvent]:
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    if (end - start).days > 120:
        combined: Dict[str, UsgsEvent] = {}
        chunk_start = start
        while chunk_start <= end:
            chunk_end = min(chunk_start + timedelta(days=119), end)
            chunk_events = fetch_usgs_events_global_window(
                start_date=chunk_start.isoformat(),
                end_date=chunk_end.isoformat(),
                min_magnitude=min_magnitude,
                use_cache=use_cache,
            )
            for event in chunk_events:
                combined[event.event_id] = event
            chunk_start = chunk_end + timedelta(days=1)
        return list(combined.values())

    config = load_project_config()
    seismic_cfg = config["seismic"]
    cache = load_cache() if use_cache else {}
    key = f"global:{start_date}:{end_date}:{min_magnitude:.1f}"

    if use_cache and key in cache:
        return [UsgsEvent(**item) for item in cache[key]]

    params = {
        "format": "geojson",
        "starttime": start_date,
        "endtime": end_date,
        "minmagnitude": min_magnitude,
        "orderby": "time",
    }
    session = requests.Session()
    session.trust_env = False
    try:
        response = session.get(seismic_cfg["usgs_event_api_url"], params=params, timeout=60)
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException:
        if use_cache and key in cache:
            return [UsgsEvent(**item) for item in cache[key]]
        return []

    events: List[UsgsEvent] = []
    for feature in payload.get("features", []):
        parsed = _parse_feature(feature)
        if parsed is not None:
            events.append(parsed)

    if use_cache:
        cache[key] = [event.__dict__ for event in events]
        save_cache(cache)
    return events
