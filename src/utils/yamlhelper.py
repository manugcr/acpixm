import yaml
from pathlib import Path


class RuleYAMLHelper:
    """
    Helper for working with combined ast-grep + logic YAML rule files.
    Handles extraction and temp file management for ast-grep rules.
    """

    def __init__(self, rule_file: Path):
        self.rule_file = rule_file
        self._data = self._load_yaml()

    def _load_yaml(self) -> dict:
        with open(self.rule_file, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)

    @property
    def ast_section(self) -> dict:
        """Returns the ast-grep section of the YAML file."""
        return self._data.get("ast") or {}

    @property
    def logic_section(self) -> list[dict]:
        """Returns the logic section (as a list) of the YAML file."""
        return self._data.get("logic", [])

    def get_ast_tempfile(self, tmp_dir: Path) -> Path:
        """
        Ensures tmp_dir exists, writes the ast-grep section to a temp file,
        and returns the temp file Path.
        """
        tmp_dir.mkdir(parents=True, exist_ok=True)
        tmp_path = tmp_dir / f"ast_rule_{self.rule_file.stem}.yml"
        with open(tmp_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(self.ast_section, f)
        return tmp_path

    def reload(self):
        """Reloads the YAML data from disk."""
        self._data = self._load_yaml()
