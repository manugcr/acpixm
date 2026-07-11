"""Return evaluation engine for ACPI analysis results.

Applies the YAML 'return' section rules to determine which analyzed
records should be kept as positive matches based on various criteria.
"""

import logging
from dataclasses import dataclass

from .token_resolver import TokenResolver

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ReturnDecision:
    """Decision result for a single analysis record."""

    record: dict
    found: bool
    reason: str | None = None


class ReturnEvaluator:
    """Apply YAML 'return' section to decide which records to keep.

    Processes return rules in order to determine which analysis records
    should be kept as positive matches. Supports 'found' and 'not-found'
    clauses with token resolution.
    """

    def __init__(self, steps: list[dict]) -> None:
        """Initialize the return evaluator.

        Args:
            steps: List of return rule steps from YAML configuration.
        """
        self.steps = steps or []
        self.resolver = TokenResolver()
        logger.debug("Initialized ReturnEvaluator with %d steps", len(self.steps))

    def evaluate(self, records: list[dict]) -> list[ReturnDecision]:
        """Evaluate return rules for all records."""
        logger.debug("Evaluating return rules for %d records", len(records))

        decisions: list[ReturnDecision] = []
        kept_count = 0

        for i, record in enumerate(records):
            decision = self._decide_record(record)
            decisions.append(decision)

            if decision.found:
                kept_count += 1
                logger.debug(
                    "Record %d kept: %s (reason: %s)",
                    i,
                    record.get("file", "unknown"),
                    decision.reason,
                )
            else:
                logger.debug(
                    "Record %d dropped: %s (reason: %s)",
                    i,
                    record.get("file", "unknown"),
                    decision.reason,
                )

        logger.info(
            "Return evaluation completed: %d/%d records kept", kept_count, len(records)
        )
        return decisions

    def _decide_record(self, record: dict) -> ReturnDecision:
        """Make a decision for a single record."""
        logic_values = record.get("logic", {})
        has_otherwise = False
        file_name = record.get("file", "unknown")

        logger.debug("Evaluating return rules for record from %s", file_name)

        for clause in self.steps:
            if "found" in clause:
                token = clause["found"]
                val = (
                    True
                    if token == "ast"
                    else self.resolver.resolve(record, logic_values, token)
                )

                if self._as_bool(val):
                    logger.debug(
                        "Record from %s matched 'found:%s' clause", file_name, token
                    )
                    return ReturnDecision(
                        record=record, found=True, reason=f"found:{token}"
                    )
            elif clause.get("not-found") == "otherwise":
                has_otherwise = True

        reason = "not-found:otherwise" if has_otherwise else "no-match"
        logger.debug("Record from %s dropped: %s", file_name, reason)
        return ReturnDecision(record=record, found=False, reason=reason)

    @staticmethod
    def _as_bool(value) -> bool:
        """Convert a value to boolean using ACPI-specific rules."""
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        if isinstance(value, str):
            return value.strip().lower() in ("true", "yes", "1")
        return False
