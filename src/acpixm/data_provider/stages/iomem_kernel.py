"""Kernel memory range extraction stage for data collection pipeline."""

import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..commands import CommandSpec, SubprocessRunner
from ..pipeline import PipelineArtifact, PipelineContext, PipelineStage

logger = logging.getLogger(__name__)

# line example: "100000-1fffff : Kernel code"
_IOMEM_RE = re.compile(r"^\s*([0-9a-fA-F]+)-([0-9a-fA-F]+)\s*:\s*(.+)$")

_NAME_MAP = {
    "Kernel code": "KERNEL_CODE_RANGE",
    "Kernel data": "KERNEL_DATA_RANGE",
    "Kernel bss": "KERNEL_BSS_RANGE",
    "Kernel rodata": "KERNEL_RODATA_RANGE",
}


@dataclass(frozen=True)
class GrepIomemKernel(PipelineStage):
    """Pipeline stage for extracting kernel memory ranges from /proc/iomem."""

    output_file: str = "systemdata.json"

    def name(self) -> str:
        """Return the human-readable name of this stage."""
        return "Grep /proc/iomem for kernel memory ranges"

    def run(self, ctx: PipelineContext, runner: SubprocessRunner) -> None:
        """Execute the kernel memory range extraction stage.

        Args:
            ctx: Pipeline context containing working directory and shared data.
            runner: Command runner for executing subprocess commands.
        """
        text = self._exec_grep(runner)
        entries = self._parse_lines(text)
        payload = self._vars_payload(entries)
        out_path = self._write_json(ctx.workdir, payload)
        ctx.data[PipelineArtifact.IOMEM_KERNEL_JSON] = out_path
        logger.info(
            "Wrote %s with %d kernel ranges.",
            out_path.name,
            len(payload.get("vars", {})),
        )

    def _exec_grep(self, runner: SubprocessRunner) -> str:
        try:
            proc = runner.run(
                CommandSpec(
                    ["grep", "-i", "kernel", "/proc/iomem"],
                    sudo=True,
                    capture_output=True,
                )
            )
            return (proc.stdout or b"").decode("utf-8", errors="ignore")
        except Exception as e:
            logger.warning('Failed to grep "/proc/iomem": %s', e)
            return ""

    def _parse_lines(self, text: str) -> list[dict[str, Any]]:
        """Return a list of entries with numeric start/end and original label."""
        out: list[dict[str, Any]] = []
        for line in text.splitlines():
            m = _IOMEM_RE.match(line.strip())
            if not m:
                continue
            try:
                start = int(m.group(1), 16)
                end = int(m.group(2), 16)
            except ValueError:
                continue
            label = m.group(3).strip()
            out.append({"start": start, "end": end, "label": label})
        return out

    def _vars_payload(self, entries: list[dict[str, Any]]) -> dict[str, Any]:
        """Map parsed lines to the old provider's schema: {"vars": {KERNEL_*: [start, end]}}."""
        vars_block: dict[str, list[int]] = {}
        for e in entries:
            key = _NAME_MAP.get(e["label"])
            if key:
                vars_block[key] = [e["start"], e["end"]]
        return {"vars": vars_block}

    def _write_json(self, workdir: Path, payload: dict[str, Any]) -> Path:
        """Write payload to JSON file in working directory.

        This is going to be the external vars that can be used on the rule.
        """
        out_path = (workdir / self.output_file).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return out_path
