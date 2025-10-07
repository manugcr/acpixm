# src/acpi_matcher/formatters/formatter.py
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

from ..return_evaluator import ReturnDecision


@dataclass(frozen=True)
class MatchEvent:
    rule: dict  # rule_info from YAML (id, name, etc.)
    target: Path  # file analyzed
    decision: ReturnDecision  # record + found + reason


class Formatter(ABC):

    @abstractmethod
    def feed(self, event: MatchEvent) -> None:
        ...

    @abstractmethod
    def finalize(self, total_files: int = 0) -> None:
        ...
