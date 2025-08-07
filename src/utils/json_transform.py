import json
from typing import Optional, Any
from pathlib import Path


class JsonNormalizer:
    """ A class to normalize JSON data. """

    def __init__(self, input_file: Path):
        self.input_file = str(input_file)
        self.raw_data: list[dict] = self._load_json()

    def _load_json(self) -> list[dict]:
        """ Load JSON data from the input file. """
        try:
            with open(self.input_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[!] Failed to load JSON data: {e}")
            raise

    @staticmethod
    def parse_value(value: Optional[str]) -> Any:
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

    def normalize(self) -> list[dict]:
        """
        Parses and normalizes all matches, converting numeric-looking variables
        to ints, and preserving all other metadata.
        """
        normalized_records: list[dict] = []

        for match in self.raw_data:
            record: dict = {}
            meta = match.get("metaVariables", {})

            # Parse named variables
            for name, var in meta.get("single", {}).items():
                record[name] = self.parse_value(var.get("text"))

            # Parse positional variables
            for idx, cap in enumerate(
                    meta.get("multi", {}).get("secondary", [])):
                record[f"variable_{idx}"] = self.parse_value(cap.get("text"))

            # Add useful metadata
            record["file"] = match.get("file")
            record["line"] = match.get("range", {}).get("start",
                                                        {}).get("line")
            record["text"] = match.get("text")

            normalized_records.append(record)

        print(f"[*] Normalized {normalized_records} records.")
        return normalized_records

    def write_results(self, results, output_file: Path) -> None:
        """ Write the normalized results to a JSON file. """
        try:
            with open(str(output_file), 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2)
            print(f"[*] Normalized results written to {output_file}")
        except Exception as e:
            print(f"[!] Failed to write normalized results: {e}")
            raise
