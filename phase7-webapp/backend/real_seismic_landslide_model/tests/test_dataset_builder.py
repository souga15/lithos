from src.ingest.dataset_builder import build_local_training_dataset


def test_dataset_builder_outputs_expected_files() -> None:
    result = build_local_training_dataset()
    assert result.raw_event_count >= result.deduplicated_event_count
    assert result.output_csv_path.exists()
    assert result.output_json_path.exists()


def test_deduplication_does_not_expand_event_count() -> None:
    result = build_local_training_dataset()
    rows = result.summary["deduplicated_event_count"]
    assert rows <= result.summary["raw_event_count"]
