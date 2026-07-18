"""JSON normalization utilities for ast-grep match output."""

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def _integer_from_string(value: str | None) -> Any:
    if not isinstance(value, str):
        return value
    try:
        if value.lower().startswith("0x"):
            return int(value, 16)
        return int(value)
    except ValueError:
        return value


def read(in_path: Path) -> Any:
    with in_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def normalize(matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Parse and normalize ast-grep metaVariables to a flat record dict."""
    normalized_records: list[dict[str, Any]] = []

    for match in matches:
        record: dict[str, Any] = {}
        meta = match.get("metaVariables", {})

        for name, var in meta.get("single", {}).items():
            record[name] = _integer_from_string(var.get("text"))

        # multi is {VAR_NAME: [nodes]}, not {secondary: [nodes]}
        for var_name, captures in meta.get("multi", {}).items():
            for idx, cap in enumerate(captures if isinstance(captures, list) else []):
                record[f"{var_name}_{idx}"] = _integer_from_string(cap.get("text"))

        record["file"] = match.get("file")
        record["line"] = match.get("range", {}).get("start", {}).get("line")
        record["text"] = match.get("text")

        normalized_records.append(record)

    logger.debug("Normalized %d record(s).", len(normalized_records))
    return normalized_records
