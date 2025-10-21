# src/acpi_matcher/formatters/jsonfmt.py
from __future__ import annotations
import json, sys
from typing import Any

from .formatter import Formatter, MatchEvent


class JsonFormatter(Formatter):

    def __init__(self) -> None:
        self._items: list[dict[str, Any]] = []

    def feed(self, event: MatchEvent) -> None:
        if event.decision.found:
            self._items.append({
                "rule": event.rule,
                "target": str(event.target),
                "reason": event.decision.reason,
                "record": event.decision.record,
            })

    def finalize(self, total_files: int = 0) -> None:
        json.dump({"findings": self._items}, sys.stdout, indent=2)
        sys.stdout.write("\n")
