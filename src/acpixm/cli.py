"""Command-line interface for the ACPI Rootkit Detection Tool."""

import logging
from pathlib import Path
from typing import Optional

import typer

from .acpi_analyzer import collect, analyze

app = typer.Typer(add_completion=True, help="ACPI Rootkit Detection Tool")


def _setup_logging(verbose: bool, debug: bool) -> None:
    """Configure logging level based on verbosity flags."""
    if debug:
        level = logging.DEBUG
    elif verbose:
        level = logging.INFO
    else:
        level = logging.WARNING
    logging.basicConfig(level=level, format="[*] %(message)s")


@app.command("collect")
def collect_data(
    output_path: Path = typer.Option(
        ...,
        "--output",
        "-o",
        help="Output directory for provider artifacts (required).",
    ),
    debug: bool = typer.Option(False, "--debug", help="Enable debug logs."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable info logs."),
) -> None:
    """Collect ACPI tables and system data.

    Collects ACPI tables (DSL) and system data JSON with variables that can be
    used for the logic evaluation. Requires sudo privileges for accessing system data.
    """
    _setup_logging(verbose, debug)

    try:
        collect(workdir=output_path)
    except FileNotFoundError as e:
        typer.echo(f"[!] Error: {e}", err=True)
        raise typer.Exit(1)
    except PermissionError as e:
        typer.echo(f"[!] Permission denied: {e}", err=True)
        raise typer.Exit(1)
    except Exception as e:
        typer.echo(f"[!] Unexpected error: {e}", err=True)
        if debug:
            raise  # Show full traceback in debug mode
        raise typer.Exit(1)


@app.command("analyze")
def analyze_cmd(
    rule_path: Path = typer.Option(
        ...,
        "--rule",
        "-r",
        exists=True,
        readable=True,
        help="YAML rule to run over the files to scan.",
    ),
    files: Path = typer.Option(
        ...,
        "--files",
        "-f",
        help="Path to a file or directory containing .dsl/.asl files.",
    ),
    vars_path: Optional[Path] = typer.Option(
        None,
        "--vars",
        help="Path to provider JSON with system vars for the logic section.",
    ),
    fmt: str = typer.Option(
        "console",
        "--format",
        "-F",
        help="Choose a method of getting the final veredict.",
        case_sensitive=False,
    ),
    debug: bool = typer.Option(False, "--debug", help="Enable debug logs."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable info logs."),
) -> None:
    """Detect ACPI indicators by scanning DSL/ASL files.

    Analyzes ACPI source files (.dsl/.asl) using specified YAML rules to detect
    potential indicators or patterns of interest.
    """
    _setup_logging(verbose, debug)

    try:
        analyze(rule_path=rule_path, files=files, vars_path=vars_path, fmt=fmt)
    except FileNotFoundError as e:
        typer.echo(f"[!] File not found: {e}", err=True)
        raise typer.Exit(1)
    except ValueError as e:
        typer.echo(f"[!] Invalid input: {e}", err=True)
        raise typer.Exit(1)
    except PermissionError as e:
        typer.echo(f"[!] Permission denied: {e}", err=True)
        raise typer.Exit(1)
    except Exception as e:
        typer.echo(f"[!] Unexpected error: {e}", err=True)
        if debug:
            raise  # Show full traceback in debug mode
        raise typer.Exit(1)


if __name__ == "__main__":
    app()
