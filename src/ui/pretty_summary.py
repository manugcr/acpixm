# src/ui/pretty_summary.py
"""Pretty terminal summary for ACPI rootkit findings (no external deps)."""

from pathlib import Path
from typing import Any, Dict, List, Sequence


class PrettySummary:
    def __init__(self, use_color: bool | None = None) -> None:
        # auto-detect color unless caller forces it
        self.use_color = self._detect_color() if use_color is None else use_color

    # ---- public API ----
    def print(self, rule: Dict[str, Any], matches: List[Dict[str, Any]], targets: Sequence[Path]) -> None:
        self._print_header()
        self._print_rule_box(rule, len(targets), len(matches))
        self._print_matches_table(matches)

    # ---- internals (tiny and readable) ----
    def _detect_color(self) -> bool:
        try:
            import sys
            return sys.stdout.isatty()
        except Exception:
            return False

    def _c(self, code: str, text: str) -> str:
        return f"\x1b[{code}m{text}\x1b[0m" if self.use_color else text

    @staticmethod
    def _truncate(s: str, maxlen: int) -> str:
        s = (s or "").replace("\n", " ").strip()
        return s if len(s) <= maxlen else s[: maxlen - 1] + "…"

    @staticmethod
    def _pad(s: str, n: int) -> str:
        return s + (" " * max(0, n - len(s)))

    # ---- sections ----
    def _print_header(self) -> None:
        title = "ACPI Rootkit Detection"
        print()
        print(self._c("36", f"== {title} =="))  # cyan

    def _print_rule_box(self, rule: Dict[str, Any], n_targets: int, n_matches: int) -> None:
        rid = rule.get("id", "?")
        sev = (rule.get("severity") or "?")
        lang = rule.get("language", "?")
        msg = rule.get("message", "")

        sev_col = "31" if sev.lower() in {"error", "critical"} else "33" if sev.lower() == "warning" else "32"
        lines = [
            f"Rule    : {rid} ({self._c(sev_col, sev)})",
            f"Message : {msg}",
            f"Language: {lang}",
            f"Scanned : {n_targets} file(s)",
            f"Matches : {self._c('32' if n_matches else '90', str(n_matches))}",
        ]
        width = max(len(l) for l in lines) + 2
        top = "╭" + "─" * width + "╮"
        bot = "╰" + "─" * width + "╯"

        print(self._c("90", top))
        for line in lines:
            padding = " " * (width - len(line))
            print(self._c("90", "│ ") + line + padding + self._c("90", "│"))
        print(self._c("90", bot))

    def _print_matches_table(self, matches: List[Dict[str, Any]]) -> None:
        if not matches:
            print(self._c("32", "\nNo matches found."))
            return

        # headers
        h_file = self._c("1", "FILE")
        h_line = self._c("1", "LINE")
        h_snip = self._c("1", "SNIPPET")

        # column sizes
        file_col = min(max((len(Path(m.get("file", "")).name) for m in matches), default=8), 28)
        line_col = max(len("LINE"), 6)
        snip_col = 80

        sep = self._c("90", " | ")
        print()
        print(f"{self._pad(h_file, file_col)}{sep}{self._pad(h_line, line_col)}{sep}{h_snip}")
        print(self._c("90", f"{'-'*file_col}---{'-'*line_col}---{'-'*snip_col}"))

        # rows
        for m in matches:
            file = Path(m.get("file", "")).name
            line = str(m.get("line", ""))
            text = (m.get("text", "") or "").strip()
            print(
                f"{self._pad(self._truncate(file, file_col), file_col)}{sep}"
                f"{self._pad(self._truncate(line, line_col), line_col)}{sep}"
                f"{self._truncate(text, snip_col)}"
            )
