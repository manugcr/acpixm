# acpixm Changelog

## [Unreleased]

### Fixed

- FIX-003: temp files created by `AstGrepScan` are now deleted after each run; previously two `.yml` files were leaked into `/tmp` per analyzed file.
- FIX-005: `analyze()` no longer creates a hardcoded `./tmp` workdir; ast-grep now runs from the target file's own directory.
- FIX-007: iomem artifact path now stored in pipeline context so downstream stages can access it without a `KeyError`.
- FIX-006: `ReturnEvaluator` now receives external variables (e.g. `$KERNEL_CODE_RANGE`) so `return:` rules evaluate correctly instead of always returning not-found.
- FIX-002: `analyze` no longer crashes when ast-grep exits with code 1 (no matches); fixed `quiet + capture_output` conflict in `CommandSpec`.

### Added

- CI: `ruff format --check` gate and end-to-end `acpixm analyze` job against committed fixture files.

---

## [0.1.0]

### Added

    - TICKET-001: pytest dev dependency group and `[tool.pytest.ini_options]` config in `pyproject.toml`.
    - TICKET-001: smoke test suite under `tests/unit/test_smoke.py` with fixtures for DSL and rule files.

### Changed

    - TICKET-001: simplified `install.sh` to use `uv tool install . --force` directly.
