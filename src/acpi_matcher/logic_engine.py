import logging
from typing import Any

logger = logging.getLogger(__name__)

ERROR_SENTINEL = "__ERROR__"


class LogicOps:
    """
    Place to add new operations. Each op:
      - signature: (context: dict, *args) -> Any
      - use LogicOps.resolve_arg(context, x) to resolve operands
      - return a value or ERROR_SENTINEL
    """

    # ---------- helpers ----------

    @staticmethod
    def _parse_int(value: Any) -> Any:
        """Try to parse dec/hex strings to int; otherwise return original."""
        if isinstance(value, int):
            return value
        if isinstance(value, str):
            s = value.strip()
            try:
                return int(s, 16) if s.lower().startswith("0x") else int(s)
            except ValueError:
                return value
        return value

    @staticmethod
    def resolve_arg(context: dict, arg: Any) -> Any:
        """
        Resolve using context:
          - "$NAME"  -> record capture (context["$"][NAME])
          - "name"   -> prior logic result (context["logic"][name]) if exists
          - numbers  -> parsed dec/hex to int
          - list     -> resolve recursively
          - other    -> return as-is
        """
        if isinstance(arg, list):
            return [LogicOps.resolve_arg(context, x) for x in arg]

        if isinstance(arg, str):
            s = arg.strip()
            if s.startswith("$"):
                # capture from record
                return context["$"].get(s[1:])
            if s in context["logic"]:
                # previously computed logic id
                return context["logic"][s]
            # maybe a numeric literal
            return LogicOps._parse_int(s)

        return arg

    # ---------- ops ----------

    @staticmethod
    def add(context: dict, *args: Any) -> Any:
        """Sum all args. Any non-numeric -> ERROR_SENTINEL."""
        vals = [LogicOps.resolve_arg(context, a) for a in args]
        logger.debug("ADD operands (resolved): %r", vals)
        total = 0
        for v in vals:
            if v is None:
                return ERROR_SENTINEL
            vv = LogicOps._parse_int(v)
            if not isinstance(vv, int):
                return ERROR_SENTINEL
            total += vv
        return total

    @staticmethod
    def sub(context: dict, *args: Any) -> Any:
        """Subtract: a1 - a2 - ... Requires at least two numeric operands."""
        vals = [LogicOps.resolve_arg(context, a) for a in args]
        logger.debug("SUB operands (resolved): %r", vals)
        if len(vals) < 2:
            return ERROR_SENTINEL
        first = LogicOps._parse_int(vals[0])
        if not isinstance(first, int):
            return ERROR_SENTINEL
        acc = first
        for v in vals[1:]:
            if v is None:
                return ERROR_SENTINEL
            vv = LogicOps._parse_int(v)
            if not isinstance(vv, int):
                return ERROR_SENTINEL
            acc -= vv
        return acc

    @staticmethod
    def gt(context: dict, a: Any, b: Any) -> Any:
        """a > b. Non-numeric -> ERROR_SENTINEL."""
        aa = LogicOps.resolve_arg(context, a)
        bb = LogicOps.resolve_arg(context, b)
        aa = LogicOps._parse_int(aa)
        bb = LogicOps._parse_int(bb)
        logger.debug("GT operands (resolved): %r > %r", aa, bb)
        if not isinstance(aa, int) or not isinstance(bb, int):
            return ERROR_SENTINEL
        return aa > bb

    @staticmethod
    def in_range(context: dict, value: Any, bounds: list) -> Any:
        """Inclusive range check: low <= value <= high."""
        if not isinstance(bounds, list) or len(bounds) != 2:
            return ERROR_SENTINEL
        val = LogicOps._parse_int(LogicOps.resolve_arg(context, value))
        low = LogicOps._parse_int(LogicOps.resolve_arg(context, bounds[0]))
        high = LogicOps._parse_int(LogicOps.resolve_arg(context, bounds[1]))
        logger.debug("IN-RANGE operands (resolved): %r in [%r, %r]", val, low,
                     high)
        if any(x is None for x in (val, low, high)):
            return ERROR_SENTINEL
        if not all(isinstance(x, int) for x in (val, low, high)):
            return ERROR_SENTINEL
        return low <= val <= high

    @classmethod
    def get_ops(cls) -> dict[str, Any]:
        return {
            "add": cls.add,
            "sub": cls.sub,
            "gt": cls.gt,
            "in-range": cls.in_range,
            # add more ops here...
        }


class LogicEngine:
    """
    Evaluate a logic block (list[dict]) per record (dict), in-place.

    Produces:
      record["logic"][id] = value | "__ERROR__"
    """

    def __init__(self, logic_block: list[dict]) -> None:
        self.logic_block = logic_block or []
        self.ops = LogicOps.get_ops()

    def _eval_entry(self, context: dict, entry: dict) -> tuple[str, Any]:
        """
        entry: { id: "<name>", <op>: <args> }
        returns: (id, result)
        """
        if not isinstance(entry, dict) or "id" not in entry:
            raise ValueError(f"Invalid logic entry (missing id): {entry!r}")

        op_id = entry["id"]
        op_items = [(k, v) for k, v in entry.items() if k != "id"]
        if len(op_items) != 1:
            raise ValueError(f"Invalid logic entry (one op only): {entry!r}")

        op_name, args = op_items[0]
        op = self.ops.get(op_name)
        if op is None:
            logger.debug("Unknown op '%s' for id '%s'", op_name, op_id)
            result = ERROR_SENTINEL
        else:
            args_tuple = args if isinstance(args, list) else [args]
            result = op(context, *args_tuple)

        logger.debug("Logic step id=%s op=%s args=%r -> %r", op_id, op_name,
                     args, result)
        context["logic"][op_id] = result
        return op_id, result

    def evaluate_matches(self, matches: list[dict]) -> list[dict]:
        """
        Mutates matches in place, attaching record['logic'] results.
        Returns the same list for convenience.
        """
        if not self.logic_block:
            logger.info("No logic section; skipping logic evaluation.")
            return matches

        logger.info("Evaluating logic over %d record(s)...", len(matches))
        for idx, rec in enumerate(matches, start=1):
            context = {"$": rec, "logic": {}}
            logger.debug("Record %d: source keys=%s", idx, sorted(rec.keys()))
            for entry in self.logic_block:
                try:
                    self._eval_entry(context, entry)
                except Exception as e:
                    logger.debug("Skipping bad logic entry %r: %s", entry, e)
            if context["logic"]:
                rec["logic"] = context["logic"]
                logger.debug("Record %d logic results: %r", idx, rec["logic"])
        return matches
