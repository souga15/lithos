from src.features.training_table import build_training_table


def test_training_table_builds_output() -> None:
    summary = build_training_table()
    assert summary["training_rows"] > 0
    assert summary["earthquake_positive_count"] >= 0
    assert summary["dry_shear_positive_count"] >= 0
