"""Console formatter for ACPI analysis results.

Provides a clean, readable console output format for displaying
analysis results including rule information and matched patterns.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .formatter import Formatter, MatchEvent


@dataclass
class _PrettyState:
    rule: dict[str, Any] | None = None
    targets: set[str] = field(default_factory=set)
    kept_matches: list[dict[str, Any]] = field(default_factory=list)


class ConsoleFormatter(Formatter):
    """Streaming console formatter for ACPI analysis results."""

    def __init__(self) -> None:
        self.state = _PrettyState()

    # ---------- streaming API ----------
    def feed(self, event: MatchEvent) -> None:
        """Process a match event and buffer relevant data.

        Args:
            event: Match event containing rule, target, and decision information.
        """
        # Initialize rule information from first event
        if self.state.rule is None:
            self.state.rule = event.rule

        # Track all analyzed targets
        self.state.targets.add(str(event.target))

        if event.decision.found:
            rec = (
                dict(event.decision.record)
                if isinstance(event.decision.record, dict)
                else {}
            )
            rec.setdefault("file", rec.get("file") or str(event.target))
            self.state.kept_matches.append(rec)

    def finalize(self, total_files: int = 0) -> None:
        rule = self.state.rule or {}
        matches = self.state.kept_matches
        targets = sorted(self.state.targets)

        # Use provided total_files count if available, otherwise fall back to targets
        files_scanned = total_files if total_files > 0 else len(targets)

        self._print_header()
        self._print_rule_box(rule, files_scanned, len(matches))
        self._print_matches_table(matches)

    # ---------- helpers ----------
    @staticmethod
    def _truncate(s: str, maxlen: int) -> str:
        s = (s or "").replace("\n", " ").strip()
        return s if len(s) <= maxlen else s[: maxlen - 1] + "…"

    @staticmethod
    def _pad(s: str, n: int) -> str:
        return s + (" " * max(0, n - len(s)))

    def _print_header(self) -> None:
        print()
        print("== ACPI Rootkit Detection ==")

    def _print_rule_box(
        self, rule: dict[str, Any], n_targets: int, n_matches: int
    ) -> None:
        rid = str(rule.get("id", "?"))
        sev = str(rule.get("severity", "?"))
        lang = str(rule.get("language", "?"))
        msg = str(rule.get("message", ""))

        lines = [
            f"Rule    : {rid} ({sev})",
            f"Message : {msg}",
            f"Language: {lang}",
            f"Scanned : {n_targets} file(s)",
            f"Matches : {n_matches}",
        ]
        width = max(len(line) for line in lines)
        top = "┌" + ("─" * (width + 2)) + "┐"
        bot = "└" + ("─" * (width + 2)) + "┘"

        print(top)
        for line in lines:
            print("│ " + line + " " * (width - len(line)) + " │")
        print(bot)

    def _print_matches_table(self, matches: list[dict[str, Any]]) -> None:
        if not matches:
            print("\nNo matches found.\n")
            return

        # headers
        H_FILE, H_LINE, H_SNIP = "FILE", "LINE", "SNIPPET"

        # compute column widths (cap file col; keep snippet fixed-ish)
        file_name_lengths = [len(Path(m.get("file", "")).name) for m in matches]
        file_col = max(len(H_FILE), min(max(file_name_lengths or [8]), 32))
        line_lengths = [len(str(m.get("line", ""))) for m in matches]
        line_col = max(len(H_LINE), min(max(line_lengths or [4]), 8))
        snip_col = 80  # fixed; simple and consistent

        sep = " | "
        header = f"{self._pad(H_FILE, file_col)}{sep}{self._pad(H_LINE, line_col)}{sep}{H_SNIP}"
        rule = f"{'-' * file_col}---{'-' * line_col}---{'-' * snip_col}"

        print()
        print(header)
        print(rule)

        for m in matches:
            file = Path(m.get("file", "")).name
            line = str(m.get("line", ""))
            text = (m.get("text", "") or "").strip()

            print(
                f"{self._pad(self._truncate(file, file_col), file_col)}{sep}"
                f"{self._pad(self._truncate(line, line_col), line_col)}{sep}"
                f"{self._truncate(text, snip_col)}"
            )
        print()
