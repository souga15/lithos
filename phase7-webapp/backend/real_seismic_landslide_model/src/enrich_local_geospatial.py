from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.features.local_geospatial_features import build_local_geospatial_dataset


def main() -> None:
    summary = build_local_geospatial_dataset()
    print("Local geospatial enrichment complete")
    print(f"Rows: {summary['row_count']}")
    print(f"Terrain statuses: {summary['terrain_status_counts']}")
    print(f"SAR statuses: {summary['sar_status_counts']}")
    print(f"Output CSV: {summary['output_csv_path']}")


if __name__ == "__main__":
    main()
