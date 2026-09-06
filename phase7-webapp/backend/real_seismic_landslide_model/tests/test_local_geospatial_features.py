from src.features.local_geospatial_features import _compute_sar_features


def test_compute_sar_features_reports_delta() -> None:
    features = _compute_sar_features(1.5, 0.5)
    assert features.delta == 1.0
    assert features.abs_delta == 1.0
    assert features.status == "matched"


def test_compute_sar_features_handles_missing_samples() -> None:
    features = _compute_sar_features(None, 0.5)
    assert features.delta == 0.0
    assert features.status == "missing_sample"
