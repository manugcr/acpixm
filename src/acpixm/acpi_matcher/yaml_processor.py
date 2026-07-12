"""Load and validate ACPI rule YAML; expose sections as plain dicts/lists."""

import logging
from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger(__name__)


class RuleSchema(BaseModel):
    """Pydantic schema for ACPI rule validation."""

    ast: dict
    logic: Optional[list[dict]] = None
    return_: list[dict] = Field(alias="return")


class YamlProcessor:
    """Load, validate, and expose ACPI rule YAML sections."""

    def __init__(self, rule_path: Path) -> None:
        self.rule_path = Path(rule_path)
        self._rule_data = self._load_yaml()
        self._rule = self._validate(self._rule_data)

    def _load_yaml(self) -> dict:
        """Load YAML content from disk."""
        try:
            with open(self.rule_path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        except Exception as e:
            raise ValueError(f"failed to load YAML {self.rule_path}: {e}") from e

    @staticmethod
    def _validate(data: dict) -> RuleSchema:
        """Validate raw YAML against minimal schema."""
        try:
            return RuleSchema.model_validate(data)
        except ValidationError as e:
            raise ValueError(f"invalid rule schema: {e}") from e

    @property
    def ast_section(self) -> dict:
        """Return AST section (consumed by the matcher)."""
        return self._rule.ast

    @property
    def logic_section(self) -> Optional[list[dict]]:
        """Return logic section if present."""
        return self._rule.logic

    @property
    def return_section(self) -> list[dict]:
        """Return return section."""
        return self._rule.return_

    def get_rule_info(self) -> dict:
        """Return minimal header for output JSON."""
        ast = self.ast_section
        return {
            "id": ast.get("id"),
            "message": ast.get("message"),
            "severity": ast.get("severity"),
            "language": ast.get("language"),
        }
