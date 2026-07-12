"""Golden-corpus test: known rules must produce known results, end to end.

This is the regression net for the whole pipeline (acpidump-free path):
rule YAML -> ast-grep scan -> LogicEngine -> ReturnEvaluator -> JSON.
If a refactor breaks detection, this fails.

Everything it touches lives under tests/fixtures/ (committed) — it never reads
the gitignored output/ dump, so it runs identically on a fresh clone / in CI.
The rule under test is the *shipped* examples/OpRegionCritical.yml, so this also
proves the example rules we distribute actually work.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parents[2]
RULE = REPO_ROOT / "examples" / "OpRegionCritical.yml"
FIXTURES = Path(__file__).parents[1] / "fixtures"
VARS = FIXTURES / "systemdata.json"

# The console script is on PATH under `uv run`; skip loudly if the env is wrong.
if shutil.which("acpixm") is None:
    pytest.skip("acpixm CLI not installed (run via `uv run pytest`)", allow_module_level=True)
if shutil.which("ast-grep") is None:
    pytest.skip("ast-grep not on PATH (add ast-grep-cli to dev deps)", allow_module_level=True)


def _analyze_json(files: Path) -> dict:
    out = subprocess.run(
        ["acpixm", "analyze", "--rule", str(RULE), "--files", str(files),
         "--vars", str(VARS), "--format", "json"],
        capture_output=True, text=True, check=True,
    )
    return json.loads(out.stdout)


def test_opregion_critical_flags_only_the_rootkit():
    """Scanning the fixture corpus: rootkit1.asl is flagged, clean.dsl is not.

    Positive (kernel-overlapping OperationRegion) and negative (a SystemMemory
    region that does not overlap) in one scan.
    """
    findings = _analyze_json(FIXTURES)["findings"]
    assert len(findings) == 1, f"expected exactly 1 finding, got {len(findings)}"
    assert findings[0]["target"].endswith("rootkit1.asl")
    assert findings[0]["record"]["logic"]["kern-code"] is True
