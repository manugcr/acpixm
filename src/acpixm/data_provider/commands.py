"""Command execution utilities for data provider pipeline stages."""

import logging
import subprocess
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

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
        allowed_return_codes: Exit codes treated as success. None = allow any.
    """

    argv: Sequence[str]
    cwd: Path | None = None
    sudo: bool = False
    capture_output: bool = False
    quiet: bool = False
    allowed_return_codes: frozenset[int] | None = frozenset({0})

    def __post_init__(self) -> None:
        if self.quiet and self.capture_output:
            raise ValueError("quiet and capture_output are mutually exclusive")


class SubprocessRunner:
    """Simple command executor for pipeline stages.

    Stages describe what to run via CommandSpec, and this class handles
    the actual execution with proper logging and error handling.
    """

    def run(self, spec: CommandSpec) -> "subprocess.CompletedProcess[bytes]":
        """Execute a command described by the given CommandSpec.

        Args:
            spec: The specification of the command to run.

        Returns:
            The result of the executed command.

        Raises:
            subprocess.CalledProcessError: If the command exits with a code
                not in allowed_return_codes (when allowed_return_codes is not None).
        """
        argv = list(spec.argv)
        if spec.sudo and (not argv or argv[0] != "sudo"):
            argv = ["sudo"] + argv

        logger.info("Running: %s", " ".join(argv))

        stdout = subprocess.DEVNULL if spec.quiet else None

        result = subprocess.run(
            argv,
            cwd=str(spec.cwd) if spec.cwd else None,
            check=False,
            capture_output=spec.capture_output,
            stdout=stdout,
        )

        if (
            spec.allowed_return_codes is not None
            and result.returncode not in spec.allowed_return_codes
        ):
            raise subprocess.CalledProcessError(
                result.returncode, argv, result.stdout, result.stderr
            )

        return result
