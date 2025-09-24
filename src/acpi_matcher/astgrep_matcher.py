"""Module for running ast-grep on ASL files using custom grammar and rules."""

from pathlib import Path
import json
import subprocess
import tempfile
import yaml
import logging

logger = logging.getLogger(__name__)

ROOT = Path(__file__).parents[2].resolve()  # This may not be the best approach
GRAMMAR_PATH = ROOT / "tree-sitter-asl" / "asl.so"


class ASTGrepMatcher:
    """Runs ast-grep over one ASL file using a custom grammar and a provided ast_rule."""

    def __init__(self) -> None:
        self.config_file = self._write_tmp_yaml({
            "ruleDirs": ["rules"],
            "customLanguages": {
                "asl": {
                    "libraryPath": str(GRAMMAR_PATH),
                    "extensions": ['dsl', 'asl'],
                }
            },
        })

    @staticmethod
    def _write_tmp_yaml(file_content) -> Path:
        """Write given dict as YAML to a temp file and return its path."""
        with tempfile.NamedTemporaryFile(mode="w",
                                         encoding='utf-8',
                                         suffix=".yml",
                                         delete=False) as temp_file:
            yaml.safe_dump(file_content, temp_file)
            return Path(temp_file.name)

    @staticmethod
    def _parse_output(raw_output: str) -> list[dict]:
        """Parse the JSON output from ast-grep."""
        matches: list[dict] = []
        for line in raw_output.strip().splitlines():
            try:
                matches.append(json.loads(line))
            except json.JSONDecodeError as e:
                logger.warning("Failed to parse ast-grep JSON line: %s", e)
                continue
        return matches

    def _run_single(self, ast_rule: Path, target: Path) -> list[dict]:
        """Run the ast-grep command with the specified ast_rule and target file."""
        command = [
            "ast-grep", "scan", "--rule",
            str(ast_rule), "--config",
            str(self.config_file), "--json=stream",
            str(target)
        ]
        logger.debug("Running: %s", " ".join(command))

        try:
            result = subprocess.run(command,
                                    capture_output=True,
                                    text=True,
                                    check=True)
        except subprocess.CalledProcessError as e:
            stderr = (e.stderr or "").strip()
            logger.error("ast-grep failed on %s. stderr: %s", target, stderr)
            raise RuntimeError() from e

        if not result.stdout.strip():
            logger.debug("ast-grep produced no output for %s", target)
            return []

        return self._parse_output(result.stdout)

    def run(self, ast_rule: dict, targets: list[Path]) -> list[dict]:
        """Run ast-grep on multiple target files and aggregate results."""
        rule_path = self._write_tmp_yaml(ast_rule)
        all_matches: list[dict] = []
        for target in targets:
            matches = self._run_single(ast_rule=rule_path, target=target)
            logger.debug("Found %d matches in %s", len(matches), target)
            all_matches.extend(matches)
        return all_matches
