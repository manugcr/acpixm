from typing import Any
from pathlib import Path
import yaml


class LogicOps:
    """Collection of logic operations as static methods."""

    @staticmethod
    def resolve_arg(context: dict, arg: Any) -> Any:
        """ Resolve argument from context if it's a string key. """
        # Allow referencing prior operation results or variables
        if isinstance(arg, str) and arg in context:
            return context[arg]
        return arg

    @staticmethod
    def add(context: dict, a: Any, b: Any) -> Any:
        """ Add two values, resolving from context if necessary. """
        return LogicOps.resolve_arg(context, a) + LogicOps.resolve_arg(
            context, b)

    @staticmethod
    def gt(context: dict, a: Any, b: Any) -> Any:
        """ Check if a is greater than b. """
        return LogicOps.resolve_arg(context,
                                    a) > LogicOps.resolve_arg(context, b)

    @staticmethod
    def in_range(context: dict, value: Any, range_vals: list) -> Any:
        """ Check if value is within the inclusive range [start, end]. """
        val = LogicOps.resolve_arg(context, value)
        start = LogicOps.resolve_arg(context, range_vals[0])
        end = LogicOps.resolve_arg(context, range_vals[1])
        return start <= val <= end

    @classmethod
    def get_ops(cls) -> dict:
        """Return a dictionary mapping operation names to their corresponding methods."""
        return {
            "add": cls.add,
            "gt": cls.gt,
            "in-range": cls.in_range,
            # Register more ops here as needed
        }


class LogicEngine:
    """Evaluates logic blocks as defined in YAML."""

    def __init__(self, logic_block: list[dict]):
        self.logic_block: list[dict] = logic_block
        self.ops = LogicOps.get_ops()

    @staticmethod
    def _load_logic_file(rule_file: str) -> list[dict]:
        """ Load logic rules from a YAML file. """
        with open(rule_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            logic_block = data.get("logic", [])
            if not isinstance(logic_block, list):
                raise ValueError("Logic block must be a list.")
            return logic_block

    def _eval_entry(self, context: dict, entry: dict) -> Any:
        """ Evaluate a single logic entry. """
        op_id = entry.get("id")
        op_items = [(k, v) for k, v in entry.items() if k != "id"]
        if len(op_items) != 1:
            raise ValueError(f"Invalid logic entry: {entry}")
        op_name, args = op_items[0]
        if op_name not in self.ops:
            raise ValueError(f"Unknown operation: {op_name}")
        result = self.ops[op_name](context, *args)
        if op_id:
            context[op_id] = result
        print(f"[*] Evaluating {entry} => {result}")
        return result, op_id

    def evaluate(self, match: dict) -> bool:
        """ Evaluate the logic block against a single match context. """
        context = dict(match)
        last_result = None
        last_id = None
        for entry in self.logic_block:
            last_result, last_id = self._eval_entry(context, entry)
        return bool(context.get(last_id)) if last_id else bool(last_result)
