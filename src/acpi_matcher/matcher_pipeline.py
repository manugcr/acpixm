# pylint: disable=too-few-public-methods
"""Pipeline for matching ACPI rules using YAML and ASTGrep."""

import logging
from pathlib import Path

from .yaml_processor import YamlProcessor
from .astgrep_matcher import ASTGrepMatcher

logger = logging.getLogger(__name__)


class MatcherPipeline:
    """Minimal pipeline: YAML(ast) -> ast-grep over targets -> raw JSON list."""

    def __init__(self) -> None:
        pass

    def execute(self, rule_path: Path, targets: list[Path]) -> list[dict]:
        logger.info("Loading rule: %s", rule_path)
        yamlp = YamlProcessor(rule_path)
        ast_rule_tmp = yamlp.get_ast_tempfile(tmp_dir=rule_path.parent /
                                              ".tmp_rules")
        logger.debug("AST-only rule written to: %s", ast_rule_tmp)

        matcher = ASTGrepMatcher()  # grammar path inferred internally
        all_results: list[dict] = []

        for t in targets:
            logger.info("Scanning: %s", t)
            raw = matcher.run(ast_rule_tmp, t)
            logger.info("  -> %d match(es)", len(raw))
            all_results.extend(raw)

        return all_results
