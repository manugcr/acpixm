"""Command-line interface for the ACPI Rootkit Detection Tool."""

from pathlib import Path
import logging
import typer

from typing import Optional
from src.acpi_analyzer import ACPIAnalyzer
from src.data_provider.acpi_provider import ProviderPipeline
from src.data_provider.system_provider import SystemProvider

ROOT = Path(__file__).parent.resolve()
TMP_DIR = ROOT / "tmp"

logging.basicConfig(level=logging.WARNING, format="[*] %(message)s")
logger = logging.getLogger("cli")

app = typer.Typer(help="ACPI Rootkit Detection Tool")


def _set_loglevel(verbose: bool, debug: bool) -> None:
    level = logging.DEBUG if debug else logging.INFO if verbose else logging.WARNING
    logging.getLogger().setLevel(level)

@app.command("detect")
def detect(
    rule_path: Path = typer.Option(
        ..., "--rule", "-r", exists=True, readable=True,
        help="YAML rule to run over the files to scan."),
    file_path: Optional[list[Path]] = typer.Option(
        None, "--file", "-f",
        help="One or more .dsl/.asl files to scan. Repeat -f for multiple files."),
    files_dir: Optional[Path] = typer.Option(
        None, "--directory", "-d",
        help="Directory containing .dsl/.asl files to scan."),
    vars_path: Optional[Path] = typer.Option(
        None, "--vars",
        help="Path to provider JSON with system vars for the logic section (systemdata.json)."),
    debug: bool = typer.Option(False, "--debug", help="Enable debug logs."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable info logs."),
) -> None:
    """Detect ACPI indicators by scanning .dsl/.asl files with the given rule."""

    _set_loglevel(verbose, debug)

    if bool(file_path) == bool(files_dir):
        logger.error("You must provide one of --file or --directory.")
        raise typer.Exit(code=1)

    analyzer = ACPIAnalyzer(workspace_dir=ROOT)
    try:
        analyzer.run(rule_path=rule_path, files=file_path, files_dir=files_dir , vars_path=vars_path)
    except Exception as e:
        logger.error("Detection failed: %s", e)
        raise typer.Exit(code=1)



@app.command("collect")
def collect(
    output_path: Path = typer.Option(
        ...,
        "--output",
        "-o",
        help="Output directory for provider artifacts (required)."),
    debug: bool = typer.Option(False, "--debug", help="Enable debug logs."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable info logs."),
) -> None:
    """
    Collect ACPI tables (DSL) and system data json with variables that can be used for the logic evaluation. Requires sudo.
    """
    _set_loglevel(verbose, debug)
    try:
        logger.info("Collecting artifacts into %s. This requires sudo.", output_path)
        ProviderPipeline(output_dir=output_path).run()
        SystemProvider(output_dir=output_path).run()
        logger.info("All artifacts stored in: %s", output_path)
    except Exception as e:
        logger.error("Collect failed: %s", e)
        raise typer.Exit(code=1)


if __name__ == "__main__":
    app()
