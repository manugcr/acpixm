"""Evaluate the YAML 'return' section to decide which records are findings."""

import logging
from dataclasses import dataclass
from typing import Any

from .logic_engine.logic_ops import evaluate

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ReturnDecision:
    record: dict[str, Any]
    found: bool
    reason: str | None = None


class ReturnEvaluator:
    """Apply YAML 'return' steps to each record.

    Each 'found:' clause is evaluated as an expression in the record's context.
    The special token 'ast' means "any ast-grep match counts as found".
    The first truthy 'found:' clause wins; 'not-found: otherwise' is the fallback.
    """

    def __init__(self, steps: list[dict[str, Any]], externals: dict[str, Any] | None = None) -> None:
        self.steps = steps or []
        self.externals = externals or {}
        logger.debug("Initialized ReturnEvaluator with %d steps", len(self.steps))

    def evaluate(self, records: list[dict[str, Any]]) -> list[ReturnDecision]:
        logger.debug("Evaluating return rules for %d records", len(records))
        decisions = [self._decide_record(r) for r in records]
        kept = sum(1 for d in decisions if d.found)
        logger.info("Return evaluation: %d/%d records kept", kept, len(records))
        return decisions

    def _decide_record(self, record: dict[str, Any]) -> ReturnDecision:
        logic_values = record.get("logic", {})
        has_otherwise = False

        for clause in self.steps:
            if "found" in clause:
                token = clause["found"]
                if token == "ast":
                    val: object = True
                else:
                    val = evaluate(str(token), record, logic_values, self.externals)

                if _as_bool(val):
                    logger.debug("Record %s matched found:%s", record.get("file"), token)
                    return ReturnDecision(record=record, found=True, reason=f"found:{token}")

            elif clause.get("not-found") == "otherwise":
                has_otherwise = True

        reason = "not-found:otherwise" if has_otherwise else "no-match"
        return ReturnDecision(record=record, found=False, reason=reason)


def _as_bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in ("true", "yes", "1")
    return False
