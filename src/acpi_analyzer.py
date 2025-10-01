"""ACPI analyzer: orchestrator."""

import logging
from pathlib import Path
from typing import Optional, Any

from src.acpi_matcher.yaml_processor import YamlProcessor
from src.acpi_matcher.astgrep_matcher import ASTGrepMatcher
from src.acpi_matcher.json_handler import JsonHandler
from src.acpi_matcher.logic_engine.logic_engine import LogicEngine
from src.acpi_matcher.return_evaluator import ReturnEvaluator
from src.ui.pretty_summary import PrettySummary

logger = logging.getLogger(__name__)

_VALID_EXTS = {".dsl", ".asl"}

class ACPIAnalyzer:
    """Top-level orchestrator for provider and rule execution."""

    def __init__(self, workspace_dir: Path) -> None:
        self.workspace_dir = Path(workspace_dir).resolve()
        self.tmp_dir = self.workspace_dir / "tmp"
        self.tmp_dir.mkdir(parents=True, exist_ok=True)
        self._printer = PrettySummary()

    # -------- internals --------

    def _validate_environment(self, rule_path: Path) -> None:
        """Ensure base folders exist and required files are present."""
        if not rule_path.exists():
            raise FileNotFoundError(f"rule not found: {rule_path}")
        if not self.tmp_dir.exists():
            raise FileNotFoundError(f"tmp dir not found: {self.tmp_dir}")

    def _determine_targets(
        self,
        files: Optional[list[Path]],
        directory: Optional[Path],
    ) -> list[Path]:
        """Determine target .dsl files from either explicit files or a directory."""
        if files:
            targets: list[Path] = []
            for file in files:
                file = Path(file).resolve()
                if file.exists() and file.suffix.lower() in _VALID_EXTS:
                    targets.append(file)
            return targets

        assert directory is not None
        directory = Path(directory).resolve()
        targets = sorted([*directory.glob("*.dsl"), *directory.glob("*.asl")])

        if not targets:
            raise ValueError(f"No .dsl/.asl files found in directory: {directory}")
        return targets
    
    def run(self, rule_path: Path, files: Optional[list[Path]],
            files_dir: Optional[Path], vars_path: Optional[Path]) -> None:
        """Run full analysis for the given rule and target files."""
        rule_path = Path(rule_path).resolve()
        self._validate_environment(rule_path)
        logger.info("Using rule: %s", rule_path)

        # 1) find targets
        targets = self._determine_targets(files, files_dir)
        if not targets:
            logger.info("No .dsl files to analyze; exiting")
            return

        # 2) load rule sections
        yp = YamlProcessor(rule_path)
        ast_rule = yp.ast_section
        logic_rule = yp.logic_section  # may be None
        return_rule = yp.return_section

        # 3) run ast-grep
        matcher = ASTGrepMatcher()
        logger.info("Starting ast-grep matching.")
        raw_matches = matcher.run(ast_rule=ast_rule, targets=targets)
        logger.debug(" Found %d ast-grep matches.", len(raw_matches))

        # 4) normalize
        jsonh = JsonHandler()
        records = jsonh.normalize(raw_matches)
        # jsonh.write(records, self.tmp_dir / f"{rule_path.stem}.raw.json")

        # Get external variables if provided
        external_vars = {}
        if vars_path:
            external_vars = jsonh.read(vars_path).get("vars", {})
            logger.info("Loaded external vars from %s", vars_path)

        # 5) apply optional logic
        logger.info("Starting logic evaluation.")
        if logic_rule:
            records = LogicEngine(logic_rule, external_vars).evaluate(records)
            logger.debug(" Calculated %d logic matches.", len(records))
        else:
            logger.info("  No logic section present; skipping.")

        # 6) run return-evaluator
        logger.info("Starting return evaluation.")
        records = ReturnEvaluator(return_rule).evaluate(records)
        logger.debug(" Found %d final matches", len(records))

        rule_info: dict[str, Any] = yp.get_rule_info()
        payload = {"rule": rule_info, "matches": records}
        jsonh.write(payload, self.tmp_dir / f"{rule_path.stem}.normalized.json")

        self._printer.print(rule=rule_info, matches=records, targets=targets)
