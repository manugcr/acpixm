"""ACPI table disassembly stage for data collection pipeline."""

from dataclasses import dataclass
import logging
from pathlib import Path
from ..commands import SubprocessRunner, CommandSpec
from ..pipeline import PipelineContext, PipelineStage, PipelineArtifact

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DisassembleTables(PipelineStage):
    """Pipeline stage for disassembling ACPI tables using iasl."""

    dsl_ext: str = ".dsl"

    def name(self) -> str:
        """Return the human-readable name of this stage."""
        return "Disassemble ACPI tables"

    def run(self, ctx: PipelineContext, runner: SubprocessRunner) -> None:
        """Execute the ACPI table disassembly stage.

        Args:
            ctx: Pipeline context containing working directory and shared data.
            runner: Command runner for executing subprocess commands.
        """
        tables: list[Path] = list(ctx.data.get(PipelineArtifact.ACPI_TABLE_FILES, []))  # type: ignore
        dsl_files: list[Path] = []
        for tbl in tables:
            logger.debug("Disassembling table: %s", tbl)
            runner.run(
                CommandSpec(
                    ["iasl", "-d", tbl.name], cwd=ctx.workdir, capture_output=True
                )
            )
            dsl_files.append(ctx.workdir / (tbl.stem + self.dsl_ext))
        logger.info(
            "Disassembled %d tables to .dsl files inside %s",
            len(dsl_files),
            ctx.workdir,
        )
        ctx.data[PipelineArtifact.ACPI_DSL_FILES] = dsl_files
