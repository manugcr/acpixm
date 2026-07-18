"""Golden-corpus test: known rules must produce known results, end to end.

This is the regression net for the whole pipeline (acpidump-free path):
rule YAML -> ast-grep scan -> LogicEngine -> ReturnEvaluator -> JSON.
If a refactor breaks detection, this fails.

Everything it touches lives under tests/fixtures/ (committed) — it never reads
the gitignored output/ dump, so it runs identically on a fresh clone / in CI.
Rules under test are the *shipped* examples/, so this also proves the example
rules we distribute actually work.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parents[2]
FIXTURES = Path(__file__).parents[1] / "fixtures"
VARS = FIXTURES / "systemdata.json"

# The console script is on PATH under `uv run`; skip loudly if the env is wrong.
if shutil.which("acpixm") is None:
    pytest.skip("acpixm CLI not installed (run via `uv run pytest`)", allow_module_level=True)
if shutil.which("ast-grep") is None:
    pytest.skip("ast-grep not on PATH (add ast-grep-cli to dev deps)", allow_module_level=True)


def _analyze_json(rule: Path, files: Path, vars_path: Path | None = None) -> dict:
    cmd = ["acpixm", "analyze", "--rule", str(rule), "--files", str(files), "--format", "json"]
    if vars_path:
        cmd += ["--vars", str(vars_path)]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def test_opregion_critical_flags_only_the_rootkit():
    """rootkit1.asl is flagged (kernel overlap), clean.dsl and low_mmio.asl are not."""
    findings = _analyze_json(REPO_ROOT / "examples" / "OpRegionCritical.yml", FIXTURES, VARS)["findings"]
    assert len(findings) == 1, f"expected exactly 1 finding, got {len(findings)}"
    assert findings[0]["target"].endswith("rootkit1.asl")
    assert findings[0]["record"]["logic"]["kern_code"] is True  # stored as _ internally


def test_opregion_low_mem_flags_only_low_address():
    """low_mmio.asl (0x5000) is flagged; rootkit1.asl (0x41AA00000) is not.

    This test exercises the new simpleeval expression format end-to-end:
    in_range($OFFSET, [0x0, 0xFFFF]), comparison ($LENGTH > 0), and a compound
    expression (in_low_mem and has_size) — none of which were possible in the
    old op-dict rule format without adding new ops.
    """
    findings = _analyze_json(FIXTURES / "OpRegionLowMem.yml", FIXTURES / "low_mmio.asl")["findings"]
    assert len(findings) == 1, f"expected exactly 1 finding, got {len(findings)}"
    assert findings[0]["target"].endswith("low_mmio.asl")
    assert findings[0]["record"]["logic"]["in_low_mem"] is True   # dash normalized to _
    assert findings[0]["record"]["logic"]["suspicious"] is True


def test_opregion_low_mem_does_not_flag_rootkit():
    """rootkit1.asl is at 0x41AA00000 — outside the low-mem range, must not be flagged."""
    findings = _analyze_json(FIXTURES / "OpRegionLowMem.yml", FIXTURES / "rootkit1.asl")["findings"]
    assert len(findings) == 0, f"expected 0 findings for rootkit1.asl, got {len(findings)}"
