"""ACPI analyzer orchestrator module."""

import logging
from pathlib import Path
from typing import Optional

from .data_provider.commands import SubprocessRunner
from .data_provider.pipeline import PipelineContext, PipelineRunner, PipelineArtifact

from .data_provider.stages.dump_acpi import DumpACPI
from .data_provider.stages.extract_tables import ExtractTables
from .data_provider.stages.disassemble_tables import DisassembleTables
from .data_provider.stages.iomem_kernel import GrepIomemKernel
from .data_provider.stages.astgrep_scan import AstGrepScan

from .acpi_matcher.yaml_processor import YamlProcessor
from .acpi_matcher.json_handler import JsonHandler
from .acpi_matcher.logic_engine.logic_engine import LogicEngine
from .acpi_matcher.return_evaluator import ReturnEvaluator
from .acpi_matcher.formatters.formatter import MatchEvent
from .acpi_matcher.formatters.registry import make_formatter

logger = logging.getLogger(__name__)

_VALID_EXTS = {".dsl", ".asl"}


def _collect_targets(path: Path) -> list[Path]:
    """Collect target .dsl/.asl files from a given path.
    
    Args:
        path: Path to either a file or directory containing ACPI files.
        
    Returns:
        List of Path objects pointing to .dsl/.asl files.
        
    Raises:
        FileNotFoundError: If the path does not exist.
        ValueError: If no valid files are found or invalid extension.
    """
    p = path.resolve()
    if not p.exists():
        raise FileNotFoundError(f"Path not found: {p}")

    if p.is_file():
        if p.suffix.lower() not in _VALID_EXTS:
            raise ValueError(f"Unsupported file extension: {p}")
        return [p]

    if p.is_dir():
        targets = sorted(list(p.glob("*.dsl")) + list(p.glob("*.asl")))
        if not targets:
            raise ValueError(f"No .dsl/.asl files found in directory: {p}")
        return targets

    raise ValueError(f"Invalid input path: {p}")


def _ensure_workdir(path: Path) -> Path:
    """Ensure the given path exists as a directory.
    
    Args:
        path: Path to create as a directory.
        
    Returns:
        Resolved Path object of the created directory.
    """
    wd = path.resolve()
    wd.mkdir(parents=True, exist_ok=True)
    return wd


def collect(workdir: Path) -> None:
    """Run ACPI data collection up to disassembled tables.
    
    Physical artifacts are written into the specified working directory.
    
    Args:
        workdir: Directory where collected files will be stored.
    """
    logger.info("Starting ACPI data collection pipeline")
    wd = _ensure_workdir(workdir)
    logger.debug("Using working directory: %s", wd)

    # Initialize pipeline context and runner
    ctx = PipelineContext(workdir=wd)
    runner = SubprocessRunner()

    # Configure and run the collection pipeline
    pipeline = PipelineRunner(runner)
    pipeline.register(DumpACPI()).register(ExtractTables()).register(
        GrepIomemKernel()).register(DisassembleTables())

    try:
        pipeline.run(ctx)
        logger.info("ACPI data collection completed successfully")
        logger.info("Artifacts stored in: %s", wd)
    except Exception as e:
        logger.error("ACPI data collection failed: %s", e)
        raise


def analyze(rule_path: Path,
            *,
            files: Path,
            vars_path: Optional[Path] = None,
            fmt: str = "console") -> None:
    """Analyze ACPI files using specified rules.
    
    Args:
        rule_path: Path to the YAML rule file.
        files: Path to files or directory containing .dsl/.asl files.
        vars_path: Optional path to JSON file with external variables.
    """
    wd = _ensure_workdir(Path("./tmp"))

    # Resolve targets (either explicit files or a directory of .dsl/.asl)
    targets = _collect_targets(files)
    logger.info("Found %d target files to analyze", len(targets))

    # Load rule that is going to be executed and external vars if provided
    yp = YamlProcessor(Path(rule_path).resolve())
    ast_rule = yp.ast_section
    logic_rule = yp.logic_section
    return_rule = yp.return_section
    rule_info = yp.get_rule_info()
    logger.info("Loaded rule: %s", rule_path)

    jsonh = JsonHandler()
    external_vars = {}
    if vars_path:
        external_vars = jsonh.read(vars_path).get("vars", {})
        logger.info("Loaded external vars from %s: %s", vars_path,
                    external_vars)

    # Set up runner
    ctx = PipelineContext(workdir=wd)
    runner = SubprocessRunner()
    formatter = make_formatter(fmt)

    # Process each target file through the analysis pipeline
    total_matches = 0
    for i, target in enumerate(targets, 1):
        logger.info("[%d/%d] Processing file: %s", i, len(targets),
                    target.name)

        # Stage 1: Run AST-grep pattern matching
        logger.debug("Running AST-grep scan on %s", target.name)
        stage = AstGrepScan(target=target, ast_rule=ast_rule)
        stage.run(ctx, runner)
        raw_matches = ctx.data.get(PipelineArtifact.AST_GREP_MATCHES, [])

        # Stage 2: Normalize AST-grep results
        logger.debug("Normalizing AST-grep results for %s", target.name)
        normalized_matches = jsonh.normalize(raw_matches)
        logger.debug("Normalization resulted in %d records for %s",
                     len(normalized_matches), target.name)

        # Stage 3: Apply optional logic rules
        records = normalized_matches
        if logic_rule:
            logger.info("Applying logic rules to %d records from %s",
                        len(normalized_matches), target.name)
            records = LogicEngine(logic_rule,
                                  external_vars).evaluate(normalized_matches)
            logger.debug("Logic evaluation resulted in %d records for %s",
                         len(records), target.name)
        else:
            logger.debug("No logic section present; skipping logic evaluation")

        # Stage 4: Return evaluation and formatting
        logger.debug("Evaluating return rules for %d records from %s",
                     len(records), target.name)
        decisions = ReturnEvaluator(return_rule).evaluate(records)

        kept_decisions = [d for d in decisions if d.found]
        total_matches += len(kept_decisions)
        logger.debug("Return evaluation: %d/%d records kept from %s",
                     len(kept_decisions), len(decisions), target.name)

        for decision in decisions:
            formatter.feed(
                MatchEvent(rule=rule_info, target=target, decision=decision))

    # Stage 5: Generate final output summary
    logger.info("Analysis completed: %d total matches across %d files",
                total_matches, len(targets))
    logger.debug("Finalizing output formatting")
    formatter.finalize(total_files=len(targets))
