"""Integration tests for the public match() API (FIX-013).

Exercises the Python API directly — faster than the CLI subprocess path in
test_golden.py, and proves the match() contract independently of the CLI.
"""

import json
import shutil
from pathlib import Path

import pytest

from acpixm.acpi_matcher import match

FIXTURES = Path(__file__).parents[1] / "fixtures"
EXAMPLES = Path(__file__).parents[2] / "examples"

if shutil.which("ast-grep") is None:
    pytest.skip("ast-grep not on PATH (add ast-grep-cli to dev deps)", allow_module_level=True)


def _vars():
    return json.loads((FIXTURES / "systemdata.json").read_text())["vars"]


class TestMatchCriticalRule:
    def test_rootkit_flagged(self):
        results = match(EXAMPLES / "OpRegionCritical.yml", [FIXTURES / "rootkit1.asl"], externals=_vars())
        assert results[0].found is True

    def test_clean_not_flagged(self):
        results = match(EXAMPLES / "OpRegionCritical.yml", [FIXTURES / "clean.dsl"], externals=_vars())
        assert results[0].found is False

    def test_target_path_preserved(self):
        results = match(EXAMPLES / "OpRegionCritical.yml", [FIXTURES / "rootkit1.asl"], externals=_vars())
        assert results[0].target == FIXTURES / "rootkit1.asl"

    def test_multiple_files_one_result_each(self):
        results = match(
            EXAMPLES / "OpRegionCritical.yml",
            [FIXTURES / "rootkit1.asl", FIXTURES / "clean.dsl"],
            externals=_vars(),
        )
        assert len(results) == 2
        by_name = {r.target.name: r.found for r in results}
        assert by_name["rootkit1.asl"] is True
        assert by_name["clean.dsl"] is False

    def test_no_externals_returns_not_found(self):
        # KERNEL_CODE_RANGE missing → overlaps() can't resolve → not found
        results = match(EXAMPLES / "OpRegionCritical.yml", [FIXTURES / "rootkit1.asl"])
        assert results[0].found is False

    def test_found_record_contains_capture_data(self):
        results = match(EXAMPLES / "OpRegionCritical.yml", [FIXTURES / "rootkit1.asl"], externals=_vars())
        assert results[0].matches
        assert results[0].matches[0]["OFFSET"] == 0x41AA00000

    def test_not_found_has_empty_matches(self):
        results = match(EXAMPLES / "OpRegionCritical.yml", [FIXTURES / "clean.dsl"], externals=_vars())
        assert results[0].matches == []


class TestMatchLowMemRule:
    def test_low_mmio_flagged(self):
        results = match(FIXTURES / "OpRegionLowMem.yml", [FIXTURES / "low_mmio.asl"])
        assert results[0].found is True

    def test_rootkit_high_address_not_flagged(self):
        # 0x41AA00000 is way above 0xFFFF — not in low-mem range
        results = match(FIXTURES / "OpRegionLowMem.yml", [FIXTURES / "rootkit1.asl"])
        assert results[0].found is False
