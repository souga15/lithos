from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

import yaml


def load_project_config(config_path: str | Path | None = None) -> Dict[str, Any]:
    """Load project configuration from YAML."""
    if config_path is None:
        config_path = Path(__file__).resolve().parents[1] / "configs" / "project_config.yaml"
    else:
        config_path = Path(config_path)

    with config_path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle)
