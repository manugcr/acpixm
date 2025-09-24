

"""Module for handling JSON data with normalization utilities."""

import json
import logging
from typing import Optional, Any
from pathlib import Path

logger = logging.getLogger(__name__)


class JsonHandler:
    """ A class to handle JSON data. """

    @staticmethod
    def write(data: Any, out_path: Path) -> Path:
        """
        Writes the given data as JSON to the specified output path.
        Return the path to the written JSON file.
        """
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        logger.info("Wrote JSON output to: %s", out_path)
        return out_path

    @staticmethod
    def _integer_from_string(value: Optional[str]) -> Any:
        """
        Attempts to convert a string value to an integer (hex or decimal).
        Returns the integer if successful, otherwise returns the original string.
        """
        if not isinstance(value, str):
            return value
        try:
            if value.lower().startswith("0x"):
                return int(value, 16)
            return int(value)
        except ValueError:
            return value

    def normalize(self, matches: list[dict]) -> list[dict]:
        """
        Parses and normalizes all matches, converting numeric-looking variables
        to ints, and preserving all other metadata.
        """
        normalized_records: list[dict] = []

        for match in matches:
            record: dict = {}
            meta = match.get("metaVariables", {})

            # Parse named variables
            for name, var in meta.get("single", {}).items():
                record[name] = self._integer_from_string(var.get("text"))

            # Parse positional variables, appends VAR prefix to each variable
            for idx, cap in enumerate(
                    meta.get("multi", {}).get("secondary", [])):
                record[f"VAR{idx}"] = self._integer_from_string(
                    cap.get("text"))

            # Add useful metadata from the match
            record["file"] = match.get("file")
            record["line"] = match.get("range", {}).get("start",
                                                        {}).get("line")
            record["text"] = match.get("text")

            normalized_records.append(record)

        logger.debug("Normalized %d record(s).", len(normalized_records))
        return normalized_records
