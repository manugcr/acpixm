"""LogicEngine: evaluate YAML logic steps (id → expression) per match record."""

import logging
from typing import Any

from .logic_ops import evaluate

logger = logging.getLogger(__name__)


class LogicEngine:
    """Evaluate a dict of named expressions against each match record.

    steps maps step-id to a Python-compatible expression string, e.g.:
      {"region": "make_range($OFFSET, $LENGTH)",
       "kern_code": "overlaps(region, $KERNEL_CODE_RANGE)"}

    Steps are evaluated in order; each result is available to later steps.
    Records where any step fails (returns None) are dropped.
    """

    def __init__(self, steps: dict[str, str], externals: dict[str, Any] | None = None):
        # Normalize hyphenated step ids to underscores so YAML keys with dashes
        # can be referenced safely in expressions (where a-b parses as subtraction).
        self.steps = {k.replace("-", "_"): v for k, v in steps.items()}
        self.externals = externals or {}

    def evaluate(self, records: list[dict]) -> list[dict]:
        kept = []
        for record in records:
            logic_values = self._evaluate_record(record)
            if logic_values is None:
                continue
            record["logic"] = logic_values
            kept.append(record)
        return kept

    def _evaluate_record(self, record: dict) -> dict[str, Any] | None:
        logic_values: dict[str, Any] = {}
        for step_id, expr in self.steps.items():
            result = evaluate(expr, record, logic_values, self.externals)
            if result is None:
                logger.debug("Step %r failed; dropping record from %s", step_id, record.get("file"))
                return None
            logic_values[step_id] = result
        return logic_values
