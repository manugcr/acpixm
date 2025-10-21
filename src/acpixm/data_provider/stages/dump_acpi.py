"""ACPI dump stage for data collection pipeline."""

import logging
from dataclasses import dataclass
from ..commands import SubprocessRunner, CommandSpec
from ..pipeline import PipelineContext, PipelineStage, PipelineArtifact

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DumpACPI(PipelineStage):
    """Pipeline stage for dumping ACPI tables using acpidump."""
    output_file: str = "acpidump.bin"

    def name(self) -> str:
        """Return the human-readable name of this stage."""
        return "Dump ACPI"

    def run(self, ctx: PipelineContext, runner: SubprocessRunner) -> None:
        """Execute the ACPI dump stage.
        
        Args:
            ctx: Pipeline context containing working directory and shared data.
            runner: Command runner for executing subprocess commands.
        """
        dump_path = (ctx.workdir / self.output_file).resolve()
        runner.run(CommandSpec(["acpidump", "-o", str(dump_path)], sudo=True))
        ctx.data[PipelineArtifact.ACPI_DUMP_FILE] = dump_path
        logger.info("Dumped ACPI tables to: %s", dump_path)
