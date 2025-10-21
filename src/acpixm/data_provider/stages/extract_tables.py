"""ACPI table extraction stage for data collection pipeline."""

import logging
from dataclasses import dataclass
from pathlib import Path
from ..commands import SubprocessRunner, CommandSpec
from ..pipeline import PipelineContext, PipelineStage, PipelineArtifact

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ExtractTables(PipelineStage):
    """Pipeline stage for extracting ACPI tables using acpixtract."""
    pattern: str = "*.dat"

    def name(self) -> str:
        """Return the human-readable name of this stage."""
        return "Extract ACPI tables"

    def run(self, ctx: PipelineContext, runner: SubprocessRunner) -> None:
        """Execute the ACPI table extraction stage.
        
        Args:
            ctx: Pipeline context containing working directory and shared data.
            runner: Command runner for executing subprocess commands.
        """
        dump: Path = Path(ctx.data[
            PipelineArtifact.ACPI_DUMP_FILE]).resolve()  # type: ignore
        runner.run(
            CommandSpec(["acpixtract", "-a", str(dump)],
                        sudo=True,
                        cwd=ctx.workdir,
                        quiet=True))
        ctx.data[PipelineArtifact.ACPI_TABLE_FILES] = list(
            ctx.workdir.glob(self.pattern))
        logger.info("Extracted %d ACPI table files",
                    len(ctx.data[PipelineArtifact.ACPI_TABLE_FILES]))
