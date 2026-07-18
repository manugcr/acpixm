from .console import ConsoleFormatter
from .formatter import Formatter
from .jsonfmt import JsonFormatter


def make_formatter(name: str) -> Formatter:
    n = (name or "console").lower()
    if n == "console":
        return ConsoleFormatter()
    if n == "json":
        return JsonFormatter()
    raise ValueError(f"Unknown format '{name}'. Valid: console|json")
