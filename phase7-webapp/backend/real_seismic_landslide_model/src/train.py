from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.ingest.dataset_builder import build_local_training_dataset


def main() -> None:
    result = build_local_training_dataset()
    print("Real seismic landslide dataset builder")
    print(f"Raw events: {result.raw_event_count}")
    print(f"Deduplicated events: {result.deduplicated_event_count}")
    print(f"CSV dataset: {result.output_csv_path}")
    print(f"Summary JSON: {result.output_json_path}")
    print(f"Trigger groups: {result.summary['trigger_groups']}")
    print("Next step: enrich these records with terrain, SAR, and earthquake shaking features.")


if __name__ == "__main__":
    main()
