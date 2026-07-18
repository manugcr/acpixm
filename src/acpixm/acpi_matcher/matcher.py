"""Public match() API — run a YAML rule against a list of ACPI files."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..data_provider.commands import SubprocessRunner
from ..data_provider.pipeline import PipelineArtifact, PipelineContext
from ..data_provider.stages.astgrep_scan import AstGrepScan
from .json_handler import normalize as json_normalize
from .logic_engine.logic_engine import LogicEngine
from .return_evaluator import ReturnEvaluator
from .yaml_processor import YamlProcessor


@dataclass(frozen=True)
class MatchResult:
    target: Path
    found: bool
    matches: list[dict[str, Any]] = field(default_factory=list)


def match(
    rule_path: str | Path,
    files: list[Path],
    *,
    externals: dict[str, Any] | None = None,
) -> list[MatchResult]:
    yp = YamlProcessor(Path(rule_path).resolve())
    ext = externals or {}
    runner = SubprocessRunner()
    results = []
    for target in files:
        ctx = PipelineContext(workdir=target.parent)
        AstGrepScan(target=target, ast_rule=yp.ast_section).run(ctx, runner)
        raw = ctx.data.get(PipelineArtifact.AST_GREP_MATCHES, [])
        records = json_normalize(raw)
        if yp.logic_section:
            records = LogicEngine(yp.logic_section, ext).evaluate(records)
        decisions = ReturnEvaluator(yp.return_section, externals=ext).evaluate(records)
        found_records = [d.record for d in decisions if d.found]
        results.append(
            MatchResult(target=target, found=bool(found_records), matches=found_records)
        )
    return results
