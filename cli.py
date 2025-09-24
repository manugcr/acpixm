"""Command-line interface for the ACPI Rootkit Detection Tool."""

from pathlib import Path
import logging
import typer

from typing import Optional
from src.acpi_analyzer import ACPIAnalyzer

ROOT = Path(__file__).parent.resolve()
TMP_DIR = ROOT / "tmp"
OUTPUT_DIR = ROOT / "output"

logging.basicConfig(level=logging.INFO, format="[*] %(message)s")
logger = logging.getLogger("cli")

app = typer.Typer(help="ACPI Rootkit Detection Tool")


@app.callback()
def main(debug: bool = typer.Option(False, "--debug",
                                    help="enable debug logs")) -> None:
    if debug:
        logging.getLogger().setLevel(logging.DEBUG)


@app.command("detect")
def detect(
    rule: Path = typer.Option(...,
                              "--rule",
                              "-r",
                              exists=True,
                              readable=True,
                              help="rule YAML file"),
    file: Optional[list[Path]] = typer.Option(
        None, "--file", "-f", help="one or more .dsl files to scan"),
) -> None:
    """Detect ACPI indicators by scanning .dsl files with the given rule."""
    analyzer = ACPIAnalyzer(provider_out=OUTPUT_DIR, tmp_dir=TMP_DIR)
    try:
        analyzer.run(rule_path=rule, files=file)
    except Exception as e:
        logger.error("Detection failed: %s", e)
        raise typer.Exit(code=1)


@app.command("dump")
def dump(
    provider_out: Path = typer.Option(OUTPUT_DIR,
                                     "--output",
                                     "-o",
                                     help="output directory for .dsl files"),
) -> None:
    """Dump ACPI tables (acpidump -> acpixtract -> iasl)."""
    analyzer = ACPIAnalyzer(provider_out=provider_out, tmp_dir=TMP_DIR)
    try:
        files = analyzer.dump_tables()
        for p in files:
            logger.debug("Dumped: %s", p)
    except Exception as e:
        logger.error("Dump failed: %s", e)
        raise typer.Exit(code=1)


if __name__ == "__main__":
    app()
