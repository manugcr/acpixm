"""TokenResolver module for resolving tokens in acpi rule logic and return sections."""

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class TokenResolver:
    """
    Resolves tokens in logic and return sections of ACPI rules.

    Supported resolution rules:
      - Lists: resolved item-by-item (recursive).
      - Strings:
          * "$NAME" -> replaced with record["NAME"]
          * "idName" -> replaced with logic_values["idName"] if exists
          * any other string returned as-is.
      - Numbers, booleans, and other primitive types are returned unchanged.
    """

    def __init__(self, externals: Optional[dict[str, Any]] = None) -> None:
        self.externals = externals or {}

    def resolve(self, record: dict, logic_values: dict, value: Any) -> Any:
        """
        Entry point for resolving a value.
        Dispatches to specialized handlers depending on type.
        """
        if isinstance(value, list):
            return self._resolve_list(record, logic_values, value)
        if isinstance(value, str):
            return self._resolve_string(record, logic_values, value)
        return value  # numbers, bools, None

    def _resolve_list(self, record: dict, logic_values: dict, items: list) -> list:
        """
        Resolve each element of a list and return a new resolved list.
        Example:
          ["$OFFSET", "$LENGTH"] -> [1565573120, 3337]
        """
        resolved = []
        for item in items:
            resolved.append(self.resolve(record, logic_values, item))
        return resolved

    def _resolve_string(self, record: dict, logic_values: dict, text: str) -> Any:
        """
        Resolve a string token into its actual value.

        Examples:
          "$OFFSET" -> record["OFFSET"]
          "address" -> logic_values["address"]
          "SystemMemory" -> "SystemMemory" (unchanged)
        """
        key = text.strip()

        # check previously computed logic ids
        if key in logic_values:
            return logic_values[key]

        # check record variables prefixed with "$"
        if key.startswith("$"):
            name = key[1:]
            if name in record:
                return record[name]
            if name in self.externals:
                value = self.externals[name]
                logger.debug("Resolved external %s -> %r", name, value)
                return value
            logger.error(" Unresolved token: %s", key)
            return None  # unresolved → step will fail cleanly

        # return literal string unchanged
        return key
