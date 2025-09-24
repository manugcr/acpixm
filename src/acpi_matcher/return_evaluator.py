# src/acpi_matcher/return_evaluator.py
"""
ReturnEvaluator: apply the YAML 'return' section to decide which records to keep.

Rules:
- Evaluate clauses in order.
- 'found: <token>'  -> keep record if token resolves truthy.
- 'not-found: otherwise' -> catch-all: drop record.
- If nothing matches, we drop the record (fail-closed).
"""

import logging
from src.acpi_matcher.token_resolver import TokenResolver

logger = logging.getLogger(__name__)


class ReturnEvaluator:

    def __init__(self, steps: list[dict]) -> None:
        self.steps = steps
        self.resolver = TokenResolver()

    def evaluate(self, records: list[dict]) -> list[dict]:
        """Return only records that satisfy a 'found' clause."""
        kept: list[dict] = []
        for record in records:
            if self._is_found(record):
                kept.append(record)
        return kept

    def _is_found(self, record: dict) -> bool:
        """
        Walk return steps in order and decide.
        Returns True if a 'found' clause is satisfied.
        """
        logic_values = record.get("logic", {})
        for clause in self.steps:
            if "found" in clause:
                token = clause["found"]
                value = self._resolve(record, logic_values, token)
                if self._as_bool(value):
                    return True
            elif clause.get("not-found") == "otherwise":
                return False

        # No clause matched -> drop (fail-closed)
        return False

    def _resolve(self, record: dict, logic_values: dict, token):
        """Resolve $VARS or logic ids using the same resolver used by logic."""
        return self.resolver.resolve(record, logic_values, token)

    @staticmethod
    def _as_bool(value) -> bool:
        """Conservative truth test: bools and non-zero numbers are True; strings must be 'true' case-insensitive."""
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in ("true", "yes", "1")
        return False
