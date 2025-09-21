"""ACPI Analyzer"""

# pylint: disable=too-few-public-methods
import logging
from pathlib import Path
from typing import Optional

from src.acpi_provider.acpi_provider import ProviderPipeline
from src.acpi_matcher.yaml_processor import YamlProcessor
from src.acpi_matcher.astgrep_matcher import ASTGrepMatcher
from src.acpi_matcher.json_handler import JsonHandler
from src.acpi_matcher.logic_engine import LogicEngine

logger = logging.getLogger(__name__)


class ACPIAnalyzer:
    """Top-level orchestrator for provider + AST-only matching + optional logic."""

    def __init__(self, grammar_path: Path, provider_out: Path,
                 tmp_dir: Path) -> None:
        self.grammar_path = Path(grammar_path).resolve()
        self.provider_out = Path(provider_out).resolve()
        self.tmp_dir = Path(tmp_dir).resolve()

    # ---------------- Public: provider-only ----------------
    def dump_tables(self) -> list[Path]:
        """
        Run the ACPI provider pipeline (acpidump -> acpixtract -> iasl).
        Returns the list of produced .dsl files.
        """
        logger.info("Running provider in: %s", self.provider_out)
        pipeline = ProviderPipeline(output_dir=self.provider_out)
        dsl_files = pipeline.run()
        logger.info("Provider produced %d .dsl file(s).", len(dsl_files))
        return dsl_files

    # ---------------- Internals ----------------
    def _load_rule(self, rule_path: Path) -> YamlProcessor:
        """Parse + validate the rule. Single source for rule access."""
        yp = YamlProcessor(rule_file=rule_path)
        return yp

    def _emit_ast_rule(self, yp: YamlProcessor) -> Path:
        """Write AST-only rule under tmp/ so ast-grep can consume it."""
        ast_rule_path = yp.get_ast_tempfile(tmp_dir=self.tmp_dir)
        logger.info("AST-only rule written to: %s", ast_rule_path)
        return ast_rule_path

    def _determine_targets(self, files: Optional[list[Path]]) -> list[Path]:
        """Use provided .dsl files or run the provider to produce them."""
        if files:
            targets = [Path(p).resolve() for p in files]
            logger.info("Using %d provided .dsl file(s):", len(targets))
            for t in targets:
                logger.debug(" - %s", t)
            return targets
        return self.dump_tables()

    def _run_astgrep(self, ast_rule: Path, targets: list[Path]) -> list[dict]:
        """Run ast-grep across all targets and aggregate results."""
        if not self.grammar_path.exists():
            raise FileNotFoundError(
                f"ASL grammar not found: {self.grammar_path}")
        matcher = ASTGrepMatcher(grammar_path=self.grammar_path)
        all_results: list[dict] = []
        for t in targets:
            all_results.extend(matcher.run(rule=ast_rule, target=t))
        logger.info("Collected %d raw match(es) from ast-grep",
                    len(all_results))
        return all_results

    # ---------------- Public: full detect flow ----------------
    def run(self, rule_path: Path, files: Optional[list[Path]] = None) -> None:
        rule_path = Path(rule_path).resolve()
        logger.info("Using rule: %s", rule_path)

        # 1) YAML: load/validate once
        yp = self._load_rule(rule_path)
        ast_rule = self._emit_ast_rule(yp)
        logic_steps = yp.logic_section or []

        # 3) Determine inputs
        targets = self._determine_targets(files)
        if not targets:
            logger.info("No DSL files to scan; exiting.")
            return

        # 4) Run ast-grep
        raw_matches = self._run_astgrep(ast_rule, targets)

        # 5) Normalize
        normalized = JsonHandler().normalize(raw_matches)

        # 6) Optional: Logic
        if logic_steps:
            LogicEngine(logic_steps).evaluate_matches(normalized)

        # 7) Persist
        raw_out = self.tmp_dir / f"{rule_path.stem}.raw.json"
        norm_out = self.tmp_dir / f"{rule_path.stem}.normalized.json"
        JsonHandler.write(raw_matches, raw_out)
        JsonHandler.write(normalized, norm_out)
