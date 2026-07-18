"""Tests for domain functions and the shared expression evaluator."""

import pytest
from acpixm.acpi_matcher.logic_engine.logic_ops import (
    evaluate,
    in_any_range,
    in_range,
    make_range,
    overlaps,
    overlaps_any,
)


# ---------- domain functions ----------


class TestMakeRange:
    def test_normal(self):
        assert make_range(100, 50) == [100, 149]

    def test_zero_length_empty(self):
        start, end = make_range(100, 0)
        assert start > end  # empty range convention

    def test_negative_length_empty(self):
        start, end = make_range(100, -1)
        assert start > end


class TestOverlaps:
    def test_overlapping(self):
        assert overlaps([10, 20], [15, 25]) is True

    def test_adjacent_touching(self):
        assert overlaps([10, 20], [20, 30]) is True

    def test_non_overlapping(self):
        assert overlaps([10, 20], [21, 30]) is False

    def test_contained(self):
        assert overlaps([0, 100], [40, 60]) is True

    def test_reversed_args_still_works(self):
        assert overlaps([20, 10], [15, 25]) is True


class TestOverlapsAny:
    def test_one_match(self):
        assert overlaps_any([10, 20], [[0, 5], [15, 25]]) is True

    def test_no_match(self):
        assert overlaps_any([10, 20], [[0, 5], [21, 30]]) is False


class TestInRange:
    def test_inside(self):
        assert in_range(15, [10, 20]) is True

    def test_boundary_low(self):
        assert in_range(10, [10, 20]) is True

    def test_boundary_high(self):
        assert in_range(20, [10, 20]) is True

    def test_outside(self):
        assert in_range(25, [10, 20]) is False


class TestInAnyRange:
    def test_match(self):
        assert in_any_range(15, [[0, 5], [10, 20]]) is True

    def test_no_match(self):
        assert in_any_range(99, [[0, 5], [10, 20]]) is False


# ---------- expression evaluator ----------


class TestEvaluate:
    def test_arithmetic(self):
        assert evaluate("1 + 2", {}, {}, {}) == 3

    def test_dollar_var_from_record(self):
        assert evaluate("$OFFSET", {"OFFSET": 0x1000}, {}, {}) == 0x1000

    def test_dollar_var_from_externals(self):
        assert evaluate("$KERN", {}, {}, {"KERN": [0, 100]}) == [0, 100]

    def test_logic_value_reference(self):
        # A step id (no $) references a prior logic result.
        assert evaluate("region", {}, {"region": [10, 20]}, {}) == [10, 20]

    def test_logic_value_takes_precedence_over_record(self):
        # logic_values shadow record keys (later override earlier in namespace merge).
        assert evaluate("X", {"X": 1}, {"X": 99}, {}) == 99

    def test_domain_function_make_range(self):
        result = evaluate(
            "make_range($OFFSET, $LENGTH)", {"OFFSET": 100, "LENGTH": 50}, {}, {}
        )
        assert result == [100, 149]

    def test_domain_function_overlaps(self):
        result = evaluate(
            "overlaps(region, $KERN)",
            {},
            {"region": [10, 30]},
            {"KERN": [20, 40]},
        )
        assert result is True

    def test_compound_expression(self):
        result = evaluate("$A > 0 and $B < 100", {"A": 5, "B": 50}, {}, {})
        assert result is True

    def test_undefined_var_returns_none(self):
        assert evaluate("$MISSING", {}, {}, {}) is None

    def test_bad_expression_returns_none(self):
        assert evaluate("(((", {}, {}, {}) is None

    def test_chained_steps(self):
        # Simulate two-step logic: make_range then overlaps.
        region = evaluate(
            "make_range($OFFSET, $LENGTH)",
            {"OFFSET": 0x41AA00000, "LENGTH": 0x80},
            {},
            {},
        )
        kern = [17626562560, 17648528332]
        result = evaluate(
            "overlaps(region, $KERN)", {}, {"region": region}, {"KERN": kern}
        )
        assert result is True
