# acpixm Changelog

## [0.1.0]

### Added

    - TICKET-001: pytest dev dependency group and `[tool.pytest.ini_options]` config in `pyproject.toml`.
    - TICKET-001: smoke test suite under `tests/unit/test_smoke.py` with fixtures for DSL and rule files.

### Changed

    - TICKET-001: simplified `install.sh` to use `uv tool install . --force` directly.
