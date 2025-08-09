from pathlib import Path
import json
import subprocess
import tempfile
import yaml  # type: ignore


class ASTGrepMatcher:
    """Runs ast-grep over one ASL file using a custom grammar and rule."""

    def __init__(self, grammar_path: Path) -> None:
        self.config_file = self._create_tmp_yml({
            "ruleDirs": ["rules"],
            "customLanguages": {
                "asl": {
                    "libraryPath": str(grammar_path),
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
        matches = []
        for line in raw_output.strip().splitlines():
            try:
                matches.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"[!] Failed to parse JSON: {e}")
                continue
        return matches

    def write_results(self, results: list[dict], output_file: Path) -> None:
        """Write the results to a JSON file."""
        try:
            with open(str(output_file), 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2)
            print(f"[*] Results written to {output_file}")
        except Exception as e:
            print(f"[!] Failed to write results: {e}")
            raise

    def run(self, rule: Path, target: Path) -> list[dict]:
        """Run the ast-grep command with the specified rule and target file."""
        command = [
            "ast-grep", "scan", "--rule",
            str(rule), "--config", self.config_file, "--json=stream",
            str(target)
        ]
        print(f"[*] Running command: {' '.join(command)}")

        try:
            result = subprocess.run(command,
                                    capture_output=True,
                                    text=True,
                                    check=True)
        except subprocess.CalledProcessError as e:
            print("[!] ast-grep failed:")
            print(e.stderr)
            raise

        return self._parse_output(result.stdout)
