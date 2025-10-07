"""AST-grep scanning stage for data collection pipeline."""

from dataclasses import dataclass
from pathlib import Path
from typing import Any
import json
import logging
import tempfile
import yaml

from src.data_provider.commands import SubprocessRunner, CommandSpec
from src.data_provider.pipeline import PipelineContext, PipelineStage, PipelineArtifact

# This may not be the best approach
ROOT = Path(__file__).parents[3].resolve()
GRAMMAR_PATH = ROOT / "tree-sitter-asl" / "asl.so"

logger = logging.getLogger(__name__)


@dataclass
class AstGrepScan(PipelineStage):
    """Pipeline stage for running ast-grep on a single .dsl/.asl file.
    
    Attributes:
        ast_rule: AST rule dictionary loaded from YAML.
        target: Path to a single .dsl/.asl file to scan.
    """
    ast_rule: dict  # rule dict (from YAML)
    target: Path  # ONE .dsl/.asl file

    def name(self) -> str:
        """Return the human-readable name of this stage."""
        return f"ast-grep: {self.target.name}"

    def _make_config_file(self) -> Path:
        """Create a temp YAML file with custom language config for ast-grep."""
        cfg = {
            "ruleDirs": ["rules"],
            "customLanguages": {
                "asl": {
                    "libraryPath": str(GRAMMAR_PATH),
                    "extensions": ["dsl", "asl"],
                }
            },
        }
        with tempfile.NamedTemporaryFile(mode="w",
                                         encoding="utf-8",
                                         suffix=".yml",
                                         delete=False) as f:
            yaml.safe_dump(cfg, f)
            return Path(f.name)

    def _make_rule_file(self) -> Path:
        """Write the AST rule (dict) to a temp file.
        
        AST-Grep needs a file to run, i cannot give it a string or stdin.
        """
        with tempfile.NamedTemporaryFile(mode="w",
                                         encoding="utf-8",
                                         suffix=".yml",
                                         delete=False) as f:
            f.write(json.dumps(self.ast_rule))
            return Path(f.name)

    @staticmethod
    def _parse_jsonl(raw: str) -> list[dict[str, Any]]:
        """Parse ast-grep --json=stream output (one JSON object per line)."""
        matches: list[dict[str, Any]] = []
        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                matches.append(json.loads(line))
            except json.JSONDecodeError:
                logger.debug("Ignoring non-JSON line: %r", line[:120])
        return matches

    def run(self, ctx: PipelineContext, runner: SubprocessRunner) -> None:
        """Execute the AST-grep scanning stage.
        
        Args:
            ctx: Pipeline context containing working directory and shared data.
            runner: Command runner for executing subprocess commands.
        """
        # 1) temp config + temp rule files
        config_file = self._make_config_file()
        rule_file = self._make_rule_file()

        # 2) run ast-grep
        proc = runner.run(
            CommandSpec(
                [
                    "ast-grep",
                    "scan",
                    "--rule",
                    str(rule_file),
                    "--config",
                    str(config_file),
                    "--json=stream",
                    str(self.target),
                ],
                cwd=ctx.workdir,
                capture_output=True,
            ))

        # 3) parse matches
        stdout = proc.stdout.decode("utf-8", errors="ignore")
        matches = self._parse_jsonl(stdout)

        # 4) expose per-file matches for the analyzer to consume immediately
        ctx.data[PipelineArtifact.AST_GREP_MATCHES] = matches
