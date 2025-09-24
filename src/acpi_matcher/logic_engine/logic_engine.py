"""
LogicEngine applies YAML-defined logic steps to normalized records,
evaluating operations and storing results per record.
"""

import logging
from typing import Any

from src.acpi_matcher.token_resolver import TokenResolver
from src.acpi_matcher.logic_engine.logic_ops import LogicOps

logger = logging.getLogger(__name__)


class LogicEngine:
    """
    Applies YAML 'logic' steps to each normalized record.

    Steps come from the YAML rule, e.g.:
      - { id: "address", add: ["$OFFSET", "$LENGTH"] }
      - { id: "suspicious-range", in-range: ["address", [0x0, 0xFFFFFFFF]] }

    Only records where all steps succeed are kept.
    """

    def __init__(self, steps: list[dict]):
        self.steps = steps
        self.ops = LogicOps.registry()
        self.resolver = TokenResolver()

    # ---------- public ----------

    def evaluate(self, records: list[dict]) -> list[dict]:
        """
        Apply all steps to each record; drop records with any failing step.
        """
        kept: list[dict] = []
        for record in records:
            logic_values = self._evaluate_record(record)
            if logic_values is None:
                continue  # drop this record on any error
            record["logic"] = logic_values
            kept.append(record)
        return kept

    # ---------- helpers ----------

    def _evaluate_record(self, record: dict) -> dict[str, Any] | None:
        logic_values: dict[str, Any] = {}
        for step in self.steps:
            ok = self._evaluate_step(record, logic_values, step)
            if not ok:
                return None
        return logic_values

    def _evaluate_step(self, record: dict, logic_values: dict,
                       step: dict) -> bool:
        step_id = self._read_step_id(step)
        if not step_id:
            return False

        op_name, raw_args = self._read_step_operation(step)
        if not op_name:
            return False

        op_func = self.ops.get(op_name)
        if not op_func:
            return False

        args = self.resolver.resolve(record, logic_values, raw_args)
        result = self._execute_operation(op_func, args)
        if result is None:
            return False

        self._store_result(logic_values, step_id, result)
        return True

    def _read_step_id(self, step: dict) -> str | None:
        step_id = step.get("id")
        if isinstance(step_id, str) and step_id:
            return step_id
        logger.debug("Skipping logic step without valid 'id': %r", step)
        return None

    def _read_step_operation(self, step: dict):
        items = [(k, v) for k, v in step.items() if k != "id"]
        if len(items) != 1:
            logger.debug("Logic step must have exactly one operation: %r",
                         step)
            return None, None
        return items[0]

    def _execute_operation(self, func, args):
        try:
            if isinstance(args, list):
                return func(*args)
            return func(args)
        except Exception as exc:
            logger.debug("Logic op raised: %s", exc)
            return None

    def _store_result(self, logic_values: dict, step_id: str,
                      result: Any) -> None:
        logic_values[step_id] = result
