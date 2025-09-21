"""Module for running ast-grep on ASL files using custom grammar and rules."""

# pylint: disable=too-few-public-methods
from pathlib import Path
import json
import subprocess
import tempfile
import yaml
import logging

logger = logging.getLogger(__name__)


class ASTGrepMatcher:
    """Runs ast-grep over one ASL file using a custom grammar and a provided rule."""

    def __init__(self, grammar_path: Path) -> None:
        self.config_file = self._create_tmp_yml({
            "ruleDirs": ["rules"],
            "customLanguages": {
                "asl": {
                    "libraryPath": str(Path(grammar_path).resolve()),
                    "extensions": ['dsl', 'asl'],
                }
            },
        })

    @staticmethod
    def _create_tmp_yml(file_content) -> str:
        with tempfile.NamedTemporaryFile(mode="w",
                                         encoding='utf-8',
                                         suffix=".yml",
                                         delete=False) as temp_file:
            yaml.safe_dump(file_content, temp_file)
            return temp_file.name

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

    def run(self, rule: Path, target: Path) -> list[dict]:
        """Run the ast-grep command with the specified rule and target file."""
        command = [
            "ast-grep", "scan", "--rule",
            str(rule), "--config", self.config_file, "--json=stream",
            str(target)
        ]
        logger.debug("Running: %s", " ".join(command))

        try:
            result = subprocess.run(command,
                                    capture_output=True,
                                    text=True,
                                    check=True)
        except subprocess.CalledProcessError as e:
            logger.error("ast-grep failed with code %s %s", e.returncode,
                         e.stderr.strip())
            raise

        return self._parse_output(result.stdout)
