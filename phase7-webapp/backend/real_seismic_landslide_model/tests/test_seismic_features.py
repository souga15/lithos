from src.features.seismic_features import (
    choose_best_usgs_match,
    estimate_pga_g,
    haversine_km,
)
from src.ingest.usgs_catalog import UsgsEvent


def test_haversine_km_is_zero_for_same_point() -> None:
    assert haversine_km(11.5, 76.0, 11.5, 76.0) == 0.0


def test_estimate_pga_decreases_with_distance() -> None:
    near = estimate_pga_g(magnitude=6.5, distance_km=10.0, depth_km=8.0)
    far = estimate_pga_g(magnitude=6.5, distance_km=150.0, depth_km=8.0)
    assert near > far


def test_choose_best_match_prefers_stronger_closer_event() -> None:
    row = {"latitude": "11.6", "longitude": "76.0", "event_date": "2020-01-01"}
    events = [
        UsgsEvent(
            event_id="weak-far",
            time_utc="2020-01-01T00:00:00",
            magnitude=5.0,
            place="Far",
            latitude=12.5,
            longitude=77.0,
            depth_km=10.0,
            detail_url="",
        ),
        UsgsEvent(
            event_id="strong-near",
            time_utc="2020-01-01T02:00:00",
            magnitude=6.4,
            place="Near",
            latitude=11.65,
            longitude=76.02,
            depth_km=12.0,
            detail_url="",
        ),
    ]
    match = choose_best_usgs_match(row=row, events=events, pga_cap_g=1.5)
    assert match is not None
    assert match.event_id == "strong-near"
