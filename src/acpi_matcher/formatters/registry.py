from src.acpi_matcher.formatters.console import ConsoleFormatter
from src.acpi_matcher.formatters.jsonfmt import JsonFormatter
from src.acpi_matcher.formatters.formatter import Formatter


def make_formatter(name: str) -> Formatter:
    n = (name or "console").lower()
    if n == "console":
        return ConsoleFormatter()
    if n == "json":
        return JsonFormatter()
    raise ValueError(f"Unknown format '{name}'. Valid: console|json|ndjson")
