"""Pipeline framework for ACPI data collection stages."""

import logging
from abc import ABC, abstractmethod
from collections.abc import MutableMapping
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

from .commands import SubprocessRunner

logger = logging.getLogger(__name__)


class PipelineArtifact(str, Enum):
    """Enumeration of pipeline artifacts that can be shared between stages."""

    ACPI_DUMP_FILE = "dump_file"
    ACPI_TABLE_FILES = "table_files"
    ACPI_DSL_FILES = "dsl_files"
    IOMEM_KERNEL_JSON = "iomem_kernel_json"
    AST_GREP_MATCHES = "ast_grep_matches"


@dataclass
class PipelineContext:
    """Shared context for pipeline stages.

    Provides a working directory and shared data storage for
    communication between pipeline stages.

    Attributes:
        workdir: Working directory for temporary files and outputs.
        data: Shared data dictionary for inter-stage communication.
    """

    workdir: Path
    data: MutableMapping[str, Any] = field(default_factory=dict)


class PipelineStage(ABC):
    """Abstract base class for pipeline stages."""

    @abstractmethod
    def name(self) -> str:
        """Return a human-readable name for this stage."""
        raise NotImplementedError

    @abstractmethod
    def run(self, ctx: PipelineContext, runner: SubprocessRunner) -> None:
        """Execute the stage's work."""
        raise NotImplementedError


class PipelineRunner:
    """Orchestrates execution of pipeline stages in sequence.

    Manages stage registration and sequential execution, providing
    error handling and logging for the entire pipeline process.
    """

    def __init__(self, runner: SubprocessRunner) -> None:
        """Initialize the pipeline runner."""
        self.runner = runner
        self._stages: list[PipelineStage] = []
        logger.debug("Initialized PipelineRunner")

    def register(self, stage: PipelineStage) -> "PipelineRunner":
        """Register a pipeline stage for execution."""
        self._stages.append(stage)
        logger.debug(
            "Registered stage: %s (total: %d)", stage.name(), len(self._stages)
        )
        return self

    def run(self, ctx: PipelineContext) -> None:
        """Execute all registered stages in order."""
        logger.info("Starting pipeline execution with %d stages", len(self._stages))

        successful_stages = 0
        for i, stage in enumerate(self._stages, 1):
            logger.info("[%d/%d] %s", i, len(self._stages), stage.name())

            try:
                stage.run(ctx, self.runner)
                successful_stages += 1
                logger.debug("Stage completed successfully: %s", stage.name())
            except Exception as e:
                logger.error("Stage failed: %s - Error: %s", stage.name(), e)
                logger.debug(
                    "Pipeline terminated after %d successful stages", successful_stages
                )
                raise

        logger.info(
            "Pipeline execution completed successfully (%d stages)", successful_stages
        )
