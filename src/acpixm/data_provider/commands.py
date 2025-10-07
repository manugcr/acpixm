"""Command execution utilities for data provider pipeline stages."""

import subprocess
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence, Optional

logger = logging.getLogger(__name__)


@dataclass
class CommandSpec:
    """Specification for a command to be executed.
    
    Attributes:
        argv: Command arguments sequence.
        cwd: Working directory for command execution.
        sudo: Whether to run command with sudo privileges.
        capture_output: Whether to capture command output.
        quiet: Whether to suppress command stdout.
    """
    argv: Sequence[str]
    cwd: Optional[Path] = None
    sudo: bool = False
    capture_output: bool = False
    quiet: bool = False


class SubprocessRunner:
    """Simple command executor for pipeline stages.
    
    Stages describe what to run via CommandSpec, and this class handles
    the actual execution with proper logging and error handling.
    """

    def run(self, spec: CommandSpec) -> subprocess.CompletedProcess:
        """Execute a command described by the given CommandSpec.

        Args:
            spec: The specification of the command to run.

        Returns:
            The result of the executed command.
            
        Raises:
            subprocess.CalledProcessError: If the command fails.
        """
        argv = list(spec.argv)
        if spec.sudo and (not argv or argv[0] != "sudo"):
            argv = ["sudo"] + argv

        logger.info("Running: %s", " ".join(argv))

        if spec.quiet:
            stdout = subprocess.DEVNULL
        else:
            stdout = None

        return subprocess.run(argv,
                              cwd=str(spec.cwd) if spec.cwd else None,
                              check=True,
                              capture_output=spec.capture_output,
                              stdout=stdout)
