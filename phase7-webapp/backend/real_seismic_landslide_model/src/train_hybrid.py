from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.models.train_models import train_hybrid_models


def main() -> None:
    summary = train_hybrid_models()
    print("Hybrid model training complete")
    print(f"Trigger model: {summary['trigger_model_path']}")
    print(f"Dry-shear model: {summary['dry_model_path']}")
    print(f"Trigger metrics: {summary['trigger_metrics']}")
    print(f"Dry-shear metrics: {summary['dry_metrics']}")


if __name__ == "__main__":
    main()
