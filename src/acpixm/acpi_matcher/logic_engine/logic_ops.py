"""Domain-specific ACPI logic operations and shared expression evaluator."""

import logging
import re
from typing import Any

from simpleeval import EvalWithCompoundTypes

logger = logging.getLogger(__name__)

# $IDENTIFIER → IDENTIFIER (strip dollar before eval)
_DOLLAR_RE = re.compile(r"\$([A-Za-z_][A-Za-z0-9_]*)")
# hyphen-in-identifier (no spaces) → underscore, so YAML keys with dashes work as references
_HYPHEN_IDENT_RE = re.compile(r"(?<=[A-Za-z0-9_])-(?=[A-Za-z0-9_])")


# ---------- domain functions ----------


def make_range(start: int, length: int) -> list[int]:
    if length <= 0:
        return [start, start - 1]  # empty range
    end = start + length - 1
    return [min(start, end), max(start, end)]


def overlaps(a: list[int], b: list[int]) -> bool:
    a0, a1 = min(a[0], a[1]), max(a[0], a[1])
    b0, b1 = min(b[0], b[1]), max(b[0], b[1])
    return max(a0, b0) <= min(a1, b1)


def overlaps_any(a: list[int], ranges: list[Any]) -> bool:
    return any(overlaps(a, list(r)) for r in ranges)


def in_range(value: int, bounds: list[int]) -> bool:
    low, high = min(bounds[0], bounds[1]), max(bounds[0], bounds[1])
    return low <= value <= high


def in_any_range(value: int, ranges: list[Any]) -> bool:
    return any(in_range(value, list(r)) for r in ranges)


_FUNCTIONS: dict[str, Any] = {
    "make_range": make_range,
    "overlaps": overlaps,
    "overlaps_any": overlaps_any,
    "in_range": in_range,
    "in_any_range": in_any_range,
}


# ---------- shared evaluator ----------


def evaluate(
    expr: str,
    record: dict[str, Any],
    logic_values: dict[str, Any],
    externals: dict[str, Any],
) -> Any:
    """Evaluate a rule expression against the current record context.

    $VARNAME in the expression is stripped to VARNAME before evaluation.
    Name resolution order: logic_values > record > externals.
    Returns None on any evaluation error (caller decides what to do).
    """
    processed = _DOLLAR_RE.sub(r"\1", expr)
    processed = _HYPHEN_IDENT_RE.sub("_", processed)
    names: dict[str, Any] = {**externals, **record, **logic_values}
    try:
        return EvalWithCompoundTypes(names=names, functions=_FUNCTIONS).eval(processed)
    except Exception as exc:
        logger.debug("Expression eval failed %r: %s", expr, exc)
        return None
