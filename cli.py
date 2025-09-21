from pathlib import Path
from typing import Optional
from src.acpi_analyzer import ACPIAnalyzer
import typer
import logging

ROOT = Path(__file__).parent.resolve()
TMP_DIR = ROOT / "tmp"
OUTPUT_DIR = ROOT / "output"  # provider will write here
GRAMMAR_PATH = ROOT / "tree-sitter-asl" / "asl.so"  # fixed grammar file

logging.basicConfig(
    level=logging.DEBUG,
    format="[%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cli")

app = typer.Typer(help="ACPI Rootkit Detection Tool")


@app.command("detect")
def detect(
    rule: Path = typer.Option(...,
                              "--rule",
                              "-r",
                              exists=True,
                              readable=True,
                              help="Rule YAML file"),
    file: Optional[list[Path]] = typer.Option(
        None,
        "--file",
        "-f",
        help="One or more .dsl files to scan, if none runs acpi provider."),
):
    """Detects ACPI rootkits by analyzing .dsl files using the specified rule."""

    analyzer = ACPIAnalyzer(
        grammar_path=GRAMMAR_PATH,
        provider_out=OUTPUT_DIR,
        tmp_dir=TMP_DIR,
    )

    analyzer.run(rule_path=rule, files=file)


@app.command("dump")
def dump():
    """Dumps the acpi tables by running the provider."""
    analyzer = ACPIAnalyzer(
        grammar_path=GRAMMAR_PATH,
        provider_out=OUTPUT_DIR,
        tmp_dir=TMP_DIR,
    )
    analyzer.dump_tables()


if __name__ == "__main__":
    app()
