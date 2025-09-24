"""ACPI analyzer: orchestrator."""

import logging
from pathlib import Path
from typing import Optional

from src.acpi_provider.acpi_provider import ProviderPipeline
from src.acpi_matcher.yaml_processor import YamlProcessor
from src.acpi_matcher.astgrep_matcher import ASTGrepMatcher
from src.acpi_matcher.json_handler import JsonHandler
from src.acpi_matcher.logic_engine.logic_engine import LogicEngine
from src.acpi_matcher.return_evaluator import ReturnEvaluator

logger = logging.getLogger(__name__)


class ACPIAnalyzer:
    """Top-level orchestrator for provider and rule execution."""

    def __init__(self, provider_out: Path, tmp_dir: Path) -> None:
        self.provider_out = Path(provider_out).resolve()
        self.tmp_dir = Path(tmp_dir).resolve()

    # -------- internals --------

    def _validate_environment(self, rule_path: Path) -> None:
        """Ensure base folders exist and required files are present."""
        self.provider_out.mkdir(parents=True, exist_ok=True)
        self.tmp_dir.mkdir(parents=True, exist_ok=True)
        if not rule_path.exists():
            raise FileNotFoundError(f"rule not found: {rule_path}")

    def _determine_targets(self, files: Optional[list[Path]]) -> list[Path]:
        """Return provided files or run provider to produce .dsl files."""
        if files:
            targets = [Path(p).resolve() for p in files]
            logger.info("Using %d provided .dsl file(s)", len(targets))
            return targets
        return self.dump_tables()

    # -------- public --------

    def dump_tables(self) -> list[Path]:
        """Run provider pipeline and return produced .dsl files."""
        pipeline = ProviderPipeline(output_dir=self.provider_out)
        return pipeline.run()

    def run(self, rule_path: Path, files: Optional[list[Path]]) -> None:
        """Run full analysis for the given rule and target files."""
        rule_path = Path(rule_path).resolve()
        self._validate_environment(rule_path)
        logger.info("Using rule: %s", rule_path)

        # 1) load rule sections
        yp = YamlProcessor(rule_path)
        ast_rule = yp.ast_section
        logic_rule = yp.logic_section  # may be None
        return_rule = yp.return_section

        # 2) find targets
        targets = self._determine_targets(files)
        if not targets:
            logger.info("No .dsl files to analyze; exiting")
            return

        # 3) run ast-grep
        matcher = ASTGrepMatcher()
        logger.info("Starting ast-grep matching.")
        raw_matches = matcher.run(ast_rule=ast_rule, targets=targets)
        logger.info(" Found %d ast-grep matches.", len(raw_matches))

        # 4) normalize
        jsonh = JsonHandler()
        records = jsonh.normalize(raw_matches)

        # 5) apply optional logic
        if logic_rule:
            logger.info("Starting logic evaluation,")
            records = LogicEngine(logic_rule).evaluate(records)
            logger.info(" Calculated %d logic matches.", len(records))
        else:
            logger.debug("No logic section present; skipping")

        # 6) run return-evaluator
        logger.info("Starting return evaluation.")
        records = ReturnEvaluator(return_rule).evaluate(records)
        logger.info(" Found %d final matches", len(records))

        # write output (header + matches)
        out_path = self.tmp_dir / f"{rule_path.stem}.normalized.json"
        payload = {"rule": yp.get_rule_info(), "matches": records}
        jsonh.write(payload, out_path)
