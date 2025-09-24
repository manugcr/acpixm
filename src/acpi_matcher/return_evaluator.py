# src/acpi_matcher/return_evaluator.py
"""
ReturnEvaluator: apply the YAML 'return' section to decide which records to keep.

Rules:
- Evaluate clauses in order.
- 'found: <token>'  -> keep record if token resolves truthy.
- 'not-found: otherwise' -> drop record.
- If nothing matches, drop (fail-closed).
"""

import logging
from src.acpi_matcher.token_resolver import TokenResolver

logger = logging.getLogger(__name__)


class ReturnEvaluator:
    def __init__(self, steps: list[dict]) -> None:
        self.steps = steps or []
        self.resolver = TokenResolver()

    def evaluate(self, records: list[dict]) -> list[dict]:
        """Return only records that satisfy a 'found' clause."""
        kept: list[dict] = []
        for record in records:
            if self._is_found(record):
                kept.append(record)
        return kept

    def _is_found(self, record: dict) -> bool:
        """Return True if any 'found' clause matches; False on 'otherwise' or no match."""
        logic_values = record.get("logic", {})
        for clause in self.steps:
            token = clause.get("found")
            if token is not None and self._as_bool(self._resolve(record, logic_values, token)):
                return True
            if clause.get("not-found") == "otherwise":
                return False
        return False  # fail-closed

    def _resolve(self, record: dict, logic_values: dict, token):
        """Resolve $vars or logic ids; 'ast' is always True (match existed)."""
        if token == "ast":
            return True
        return self.resolver.resolve(record, logic_values, token)

    @staticmethod
    def _as_bool(value) -> bool:
        """Truthy if bool True, non-zero number, or 'true'/'yes'/'1' string."""
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        if isinstance(value, str):
            return value.strip().lower() in ("true")
        return False
