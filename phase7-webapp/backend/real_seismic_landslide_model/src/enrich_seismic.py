from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.features.seismic_features import build_seismic_enriched_dataset


def main() -> None:
    summary = build_seismic_enriched_dataset()
    print("Seismic enrichment complete")
    print(f"Rows in: {summary['input_row_count']}")
    print(f"Rows out: {summary['output_row_count']}")
    print(f"Matched rows: {summary['matched_rows']}")
    print(f"Lookup statuses: {summary['lookup_status_counts']}")
    print(f"Output CSV: {summary['output_csv_path']}")


if __name__ == "__main__":
    main()
