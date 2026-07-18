# acpixm Changelog

## [Unreleased]

### Changed

- FIX-010: `JsonHandler` class (static-only) replaced with module-level functions `read()` and `normalize()`; dead `write()` method removed; `normalize()` now correctly iterates `multi` metaVariables (was calling `.get("secondary", [])` on a `{VAR_NAME: [nodes]}` dict, silently dropping all multi-captures).
- FIX-009: replaced hand-rolled `LogicEngine` + `TokenResolver` with `simpleeval`-backed expression evaluator; `token_resolver.py` deleted; rule `logic:` section is now a `dict[str, str]` (step-id → expression) instead of a list of op dicts; `$VARNAME` syntax preserved for researcher readability (stripped before eval); all arithmetic, comparison, and boolean operators now available in expressions for free; domain-specific ops (`make_range`, `overlaps`, `overlaps_any`, `in_range`, `in_any_range`) remain as named functions callable from rules; `OpRegionCritical.yml` updated to new format.

### Fixed

- FIX-011: filled in `__author__` / `__email__` placeholders; `__version__` now sourced via `importlib.metadata` (single source of truth); removed dead `PipelineData` TypedDict and `PipelineContext.require()`; deleted unused `pattern` field on `GrepIomemKernel`; replaced bare `print()` calls in `collect()` with `logger.info()`; fixed typo `veredict` → `verdict` in `cli.py`; removed phantom `ndjson` from formatter error message; dropped redundant `Field(alias="logic")` in `yaml_processor.py`.
- FIX-019: removed grammar dev cruft from root `tree-sitter-asl/` (`grammar.js.bkp`, `grammar.no-space.js`, `Package.swift`, `go.mod`, `Cargo.toml`, `binding.gyp`).
- FIX-004: grammar path now resolved via `importlib.resources` so the installed binary finds `asl.so` correctly; `asl.so` included in wheel via `artifacts` config.
- FIX-003: temp files created by `AstGrepScan` are now deleted after each run; previously two `.yml` files were leaked into `/tmp` per analyzed file.
- FIX-005: `analyze()` no longer creates a hardcoded `./tmp` workdir; ast-grep now runs from the target file's own directory.
- FIX-007: iomem artifact path now stored in pipeline context so downstream stages can access it without a `KeyError`.
- FIX-006: `ReturnEvaluator` now receives external variables (e.g. `$KERNEL_CODE_RANGE`) so `return:` rules evaluate correctly instead of always returning not-found.
- FIX-002: `analyze` no longer crashes when ast-grep exits with code 1 (no matches); fixed `quiet + capture_output` conflict in `CommandSpec`.

### Added

- Golden integration test (`tests/integration/test_golden.py`): the shipped `examples/OpRegionCritical.yml` must flag `rootkit1.asl` and nothing else — the end-to-end regression net for the whole pipeline. Runs in CI via `pytest`.
- Self-contained test fixtures under `tests/fixtures/` (`rootkit1.asl`, `clean.dsl`, `systemdata.json`) so tests no longer depend on the gitignored `output/` dump.
- `ast-grep-cli` added to the dev dependency group so `uv sync --group dev` provides the `ast-grep` binary locally and in CI.
- FIX-017: `ast-grep-cli` promoted to a runtime dependency so `uv tool install acpixm` brings it automatically; users no longer need a separate `ast-grep` install to run `analyze`. README prerequisites updated accordingly.

### Changed

- FIX-012: mypy strict mode enabled (`strict = true`, `python_version = "3.10"`); ruff lint extended with `UP`, `B`, `I`, `SIM` rules; all type errors fixed (bare generics annotated, `MutableMapping[str, object]` → `Any`, stale `# type: ignore` comments removed); `types-PyYAML` added to dev deps; mypy gate added to CI.
- FIX-008: added empty `__init__.py` to all subpackages (`acpi_matcher/`, `data_provider/`, `logic_engine/`, `formatters/`, `stages/`) — converts implicit namespace packages to regular packages; prereq for mypy strict mode.
- README install docs: dropped the misleading virtualenv step (`uv tool install` is self-isolating); documented `ast-grep` and `acpica-tools` as separate runtime prerequisites and which command needs which.

---

## [0.1.0]

### Added

    - TICKET-001: pytest dev dependency group and `[tool.pytest.ini_options]` config in `pyproject.toml`.
    - TICKET-001: smoke test suite under `tests/unit/test_smoke.py` with fixtures for DSL and rule files.

### Changed

    - TICKET-001: simplified `install.sh` to use `uv tool install . --force` directly.
