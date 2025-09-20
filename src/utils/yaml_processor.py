import yaml
from pathlib import Path
from typing import Optional
from dataclasses import dataclass


@dataclass
class RuleSection:
    """Represents a section of a rule with validation."""
    ast: dict
    logic: Optional[list[dict]] = None
    return_config: Optional[dict] = None


class YamlProcessor:
    """
    Enhanced YAML processor for ACPI rootkit detection rules.
    Handles the three-section format: ast, logic, and return.
    """

    def __init__(self, rule_file: Path):
        self.rule_file = rule_file
        self._data = self._load_yaml()
        self._validate_structure()

    def _load_yaml(self) -> dict:
        """Load YAML data from file."""
        try:
            with open(self.rule_file, "r", encoding="utf-8") as f:
                return yaml.safe_load(f)
        except Exception as e:
            raise ValueError(
                f"Failed to load YAML file {self.rule_file}: {e}") from e

    def _validate_structure(self) -> None:
        """Validate the rule structure has required sections."""
        if "ast" not in self._data:
            raise ValueError("Rule must contain 'ast' section")

    @property
    def rule_section(self) -> RuleSection:
        """Get the complete rule section with all components."""
        return RuleSection(ast=self._data["ast"],
                           logic=self._data.get("logic"),
                           return_config=self._data.get("return"))

    @property
    def ast_section(self) -> dict:
        """Get the AST section for ast-grep."""
        return self._data["ast"]

    @property
    def logic_section(self) -> Optional[list[dict]]:
        """Get the logic section if present."""
        return self._data.get("logic")

    @property
    def return_section(self) -> Optional[dict]:
        """Get the return section if present."""
        return self._data.get("return")

    def get_ast_tempfile(self, tmp_dir: Path) -> Path:
        """
        Create a temporary file with the AST section for ast-grep.
        """
        tmp_dir.mkdir(parents=True, exist_ok=True)
        tmp_path = tmp_dir / f"ast_rule_{self.rule_file.stem}.yml"

        with open(tmp_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(self.ast_section, f)

        return tmp_path

    def reload(self) -> None:
        """Reload the YAML data from disk."""
        self._data = self._load_yaml()
        self._validate_structure()

    def get_rule_info(self) -> dict:
        """Get basic information about the rule."""
        ast = self.ast_section
        return {
            "id": ast.get("id"),
            "message": ast.get("message"),
            "severity": ast.get("severity"),
            "has_logic": self.logic_section is not None,
            "has_return": self.return_section is not None
        }
