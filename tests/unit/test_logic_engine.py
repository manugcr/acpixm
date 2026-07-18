"""Unit tests for LogicEngine — dict-of-expressions steps, synthetic records."""

from acpixm.acpi_matcher.logic_engine.logic_engine import LogicEngine


def _record(**kwargs):
    return {"file": "test.dsl", **kwargs}


class TestLogicEngineBasic:
    def test_single_step_stored(self):
        engine = LogicEngine({"result": "$A + $B"})
        records = [_record(A=3, B=4)]
        kept = engine.evaluate(records)
        assert len(kept) == 1
        assert kept[0]["logic"]["result"] == 7

    def test_chained_steps(self):
        engine = LogicEngine({"total": "$A + $B", "big": "total > 5"})
        kept = engine.evaluate([_record(A=3, B=4)])
        assert kept[0]["logic"]["total"] == 7
        assert kept[0]["logic"]["big"] is True

    def test_compound_expression(self):
        engine = LogicEngine({"ok": "$X > 0 and $Y < 100"})
        assert len(engine.evaluate([_record(X=1, Y=50)])) == 1
        assert len(engine.evaluate([_record(X=0, Y=50)])) == 1  # False is valid
        kept = engine.evaluate([_record(X=1, Y=50)])
        assert kept[0]["logic"]["ok"] is True

    def test_false_result_kept(self):
        # A step that evaluates to False is a valid result — record is kept.
        engine = LogicEngine({"check": "$A > 100"})
        kept = engine.evaluate([_record(A=1)])
        assert len(kept) == 1
        assert kept[0]["logic"]["check"] is False

    def test_undefined_var_drops_record(self):
        engine = LogicEngine({"result": "$MISSING"})
        assert engine.evaluate([_record(A=1)]) == []

    def test_multiple_records(self):
        engine = LogicEngine({"in_range": "$OFFSET > 0x1000"})
        records = [_record(OFFSET=0x5000), _record(OFFSET=0x500)]
        kept = engine.evaluate(records)
        assert len(kept) == 2
        assert kept[0]["logic"]["in_range"] is True
        assert kept[1]["logic"]["in_range"] is False

    def test_externals_available_in_steps(self):
        engine = LogicEngine(
            {"hit": "overlaps($RANGE, $KERN)"},
            externals={"KERN": [0x1000, 0x2000]},
        )
        kept = engine.evaluate([_record(RANGE=[0x1800, 0x1900])])
        assert kept[0]["logic"]["hit"] is True


class TestLogicEngineDomainFunctions:
    """Verify that all five domain functions are reachable through the engine."""

    def test_make_range(self):
        engine = LogicEngine({"r": "make_range($OFFSET, $LENGTH)"})
        kept = engine.evaluate([_record(OFFSET=100, LENGTH=50)])
        assert kept[0]["logic"]["r"] == [100, 149]

    def test_overlaps(self):
        engine = LogicEngine({"hit": "overlaps($A, $B)"})
        kept = engine.evaluate([_record(A=[10, 30], B=[20, 40])])
        assert kept[0]["logic"]["hit"] is True

    def test_overlaps_any(self):
        engine = LogicEngine({"hit": "overlaps_any($A, $RANGES)"})
        kept = engine.evaluate([_record(A=[10, 20], RANGES=[[0, 5], [15, 25]])])
        assert kept[0]["logic"]["hit"] is True

    def test_in_range(self):
        engine = LogicEngine({"hit": "in_range($VAL, [0, 100])"})
        kept = engine.evaluate([_record(VAL=50)])
        assert kept[0]["logic"]["hit"] is True

    def test_in_any_range(self):
        engine = LogicEngine({"hit": "in_any_range($VAL, [[0, 10], [90, 100]])"})
        kept = engine.evaluate([_record(VAL=95)])
        assert kept[0]["logic"]["hit"] is True

    def test_in_range_with_comparison(self):
        # Compound: range check + size check (mirrors OpRegionLowMem.yml pattern)
        engine = LogicEngine(
            {
                "in_low_mem": "in_range($OFFSET, [0x0, 0xFFFF])",
                "has_size": "$LENGTH > 0",
                "suspicious": "in_low_mem and has_size",
            }
        )
        kept = engine.evaluate([_record(OFFSET=0x5000, LENGTH=0x100)])
        assert kept[0]["logic"]["in_low_mem"] is True
        assert kept[0]["logic"]["has_size"] is True
        assert kept[0]["logic"]["suspicious"] is True

    def test_full_opregion_pattern(self):
        # Mirrors OpRegionCritical.yml logic with real kernel range from systemdata.json
        kern = [17626562560, 17648528332]
        engine = LogicEngine(
            {
                "region": "make_range($OFFSET, $LENGTH)",
                "kern_code": "overlaps(region, $KERNEL_CODE_RANGE)",
            },
            externals={"KERNEL_CODE_RANGE": kern},
        )
        # rootkit address: 0x41AA00000 = 17626562560
        kept = engine.evaluate([_record(OFFSET=0x41AA00000, LENGTH=0x80)])
        assert kept[0]["logic"]["kern_code"] is True

        # clean address: low MMIO, no overlap
        kept = engine.evaluate([_record(OFFSET=0x1000, LENGTH=0x10)])
        assert kept[0]["logic"]["kern_code"] is False
