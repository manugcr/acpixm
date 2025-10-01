# src/system_provider.py
"""System information provider: extract kernel iomem ranges for LogicEngine."""

import json
import logging
import re
import subprocess
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

_IOMEM_RE = re.compile(r"^\s*([0-9a-fA-F]+)-([0-9a-fA-F]+)\s*:\s*(.+)$")

# Mapping from /proc/iomem names to our dict keys
_NAME_MAP = {
    "Kernel code": "KERNEL_CODE_RANGE",
    "Kernel data": "KERNEL_DATA_RANGE",
    "Kernel bss": "KERNEL_BSS_RANGE",
    "Kernel rodata": "KERNEL_RODATA_RANGE",
}


class SystemProvider:
    """Collects kernel iomem ranges and exports them as JSON variables."""

    def __init__(self, output_dir: Path) -> None:
        self.output_dir = Path(output_dir).resolve()

    def _run(self, cmd: list[str]) -> str:
        logger.debug("Running: %s", " ".join(cmd))
        return subprocess.run(cmd,
                              check=True,
                              stdout=subprocess.PIPE,
                              text=True).stdout

    def _parse_line(self, line: str) -> Optional[dict[str, Any]]:
        match = _IOMEM_RE.match(line.strip())
        if not match:
            return None
        return {
            "start": int(match[1], 16),
            "end": int(match[2], 16),
            "name": match[3].strip()
        }

    def _collect_kernel_vars(self) -> dict[str, Any]:
        """Parse /proc/iomem and return $KERNEL_* variables."""
        try:
            lines = self._run(["sudo", "grep", "-i", "kernel",
                               "/proc/iomem"]).splitlines()
        except subprocess.CalledProcessError:
            lines = []

        vars_block: dict[str, Any] = {}
        for line in lines:
            parsed = self._parse_line(line)
            if parsed and parsed["name"] in _NAME_MAP:
                vars_block[_NAME_MAP[parsed["name"]]] = [
                    parsed["start"], parsed["end"]
                ]

        return vars_block

    def run(self) -> Path:
        """Write provider JSON with $KERNEL_* variables."""
        logger.info("Collecting kernel iomem ranges...")
        vars_block = self._collect_kernel_vars()
        out_path = self.output_dir / "systemdata.json"
        out_path.write_text(json.dumps({"vars": vars_block}, indent=2),
                            encoding="utf-8")
        logger.info("System provider JSON written: %s", out_path)
        return out_path
