# acpixm — Work Tickets

Each ticket = one branch, one PR. Check off as merged.

**Priority order (follow this top to bottom):**

Phase 0 — foundation & critical bugs (DONE):

  [x] FIX-001 — dev foundation (pytest, install.sh, smoke test)
  [x] CI      — GitHub Actions: ruff check + pytest on every push/PR
  [x] FIX-006 — tool always returns not-found (silent wrong result)
  [x] FIX-002 — crashes on no ast-grep matches (hard failure)
  [x] FIX-007 — iomem artifact lost → KeyError downstream
  [x] FIX-005 — hardcoded ./tmp workdir → wrong directory
  [x] FIX-003 — temp file leak (2 files per run)
  [x] FIX-004 — grammar path breaks only on wheel install

Phase 1 — the regression net (DONE — do this BEFORE any refactor):

  [x] FIX-015 — golden integration test + self-contained fixtures
                (rules with known results, proven end-to-end on every MR)

Phase 2 — safe-to-refactor now the net exists:

  [x] FIX-017 — ast-grep-cli → runtime dep (one-liner, unblocks real users)
  [x] FIX-011 — polish (typos, dead code, placeholders, __version__ fix)
  [ ] FIX-008 — add __init__.py to subpackages
  [ ] FIX-009 — flatten LogicOps + add comparison ops
  [ ] FIX-010 — flatten JsonHandler + fix multi.primary bug
  [ ] FIX-012 — mypy gate in CI + ruff lint config + fix all type errors
  [ ] FIX-013 — expose standalone match() API

Phase 3 — broaden coverage:

  [ ] FIX-014 — unit test suite (logic_ops, token_resolver, json_handler)
  [ ] FIX-016 — release: version bump 0.2.0, PyPI publish on tag, install docs

**Why this order:** FIX-017 is first because it's a one-line `pyproject.toml`
change that fixes a real breakage — `analyze` silently fails for anyone who
installs via `uv tool install`. FIX-011 (polish) goes before the refactors so
dead code is cleared before FIX-009/010 touch those same files. FIX-008 is a
prereq for FIX-012. FIX-014 (unit tests) comes last because it depends on the
flattened APIs from 009/010/013.

---

## Foundation

### [x] FIX-001 — chore: dev foundation
**Branch:** `chore/001-dev-foundation`
**Files:** `pyproject.toml`, `install.sh`, `tests/conftest.py`, `tests/unit/test_smoke.py`

Three changes:

1. **Add dev dependency group to `pyproject.toml`:**
```toml
[dependency-groups]
dev = ["pytest>=8.0", "ruff>=0.4", "mypy>=1.0"]

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts   = "--tb=short"
```

2. **Simplify `install.sh`** to just `uv tool install . --force` — no manual wheel build needed.

3. **Create `tests/` with a smoke test** so `uv run pytest` passes immediately:
```
tests/__init__.py
tests/conftest.py          # fixtures: DSL paths from output/, rule paths from examples/
tests/unit/__init__.py
tests/unit/test_smoke.py   # imports acpixm, asserts CLI app exists
```

**Verify:**
```bash
uv run pytest              # green
./install.sh               # installs
acpixm --help              # shows help
```

---

## Critical Bug Fixes

### [x] FIX-002 — fix: subprocess handling
**Branch:** `fix/002-subprocess-correctness`
**Files:** `src/acpixm/data_provider/commands.py`

Two bugs in one file:
1. `check=True` crashes when `ast-grep` exits 1 on no matches. Fix: add `allowed_return_codes: set[int] = {0}` to `CommandSpec`; `AstGrepScan` passes `{0, 1}`.
2. `quiet=True + capture_output=True` on same spec → `subprocess.ValueError` at runtime. Fix: `__post_init__` assertion.

---

### [x] FIX-003 — fix: temp file leak
**Branch:** `fix/003-temp-file-cleanup`
**Files:** `src/acpixm/stages/astgrep_scan.py`

Two `NamedTemporaryFile(delete=False)` with no cleanup — two files leaked per analyzed file. Fix: wrap with `contextlib.ExitStack`.

---

### [x] FIX-004 — fix: grammar path breaks on wheel install
**Branch:** `fix/004-grammar-path`
**Files:** `src/acpixm/stages/astgrep_scan.py`, `pyproject.toml`

Lines 15-16 of `astgrep_scan.py`:
```python
ROOT = Path(__file__).parents[4].resolve()
GRAMMAR_PATH = (ROOT / "tree-sitter-asl" / "asl.so").resolve()
```
`parents[4]` walks: `astgrep_scan.py` → `stages/` → `data_provider/` → `acpixm/` → `src/` → project root. Works in dev, silently wrong inside a wheel where `__file__` is in `site-packages`.

Fix: replace with `importlib.resources.files("acpixm").joinpath("tree-sitter-asl/asl.so")` (or use `as_file()` context manager if the resource needs a real filesystem path for the subprocess).

Also add to `pyproject.toml` so the `.so` is included in the wheel:
```toml
[tool.hatch.build.targets.wheel]
packages = ["src/acpixm"]
artifacts = ["src/acpixm/**/*.so"]
```

---

### [x] FIX-005 — fix: hardcoded ./tmp workdir in analyze()
**Branch:** `fix/005-workdir`
**Files:** `src/acpixm/acpi_analyzer.py`

`_ensure_workdir(Path("./tmp"))` in `analyze()` is hardcoded regardless of user's `--files` path — ast-grep runs from the wrong directory. Fix: use `Path(target).parent` as per-file workdir.

---

### [x] FIX-006 — fix: ReturnEvaluator cannot see external vars
**Branch:** `fix/006-return-evaluator-externals`
**Files:** `src/acpixm/acpi_matcher/return_evaluator.py`, `src/acpixm/acpi_analyzer.py`

`ReturnEvaluator.__init__` creates `TokenResolver()` with no arguments (line ~37 of `return_evaluator.py`). `TokenResolver.__init__` accepts `externals: dict = {}`. Because no externals are passed, any `$KERNEL_CODE_RANGE`-style variable in the `return:` section resolves to `None` → False, silently. `OpRegionCritical.yml` always returns not-found as a result.

Fix:
1. Add `externals: dict` param to `ReturnEvaluator.__init__`, pass it to `TokenResolver(externals=externals)`.
2. In `acpi_analyzer.analyze()`, where `ReturnEvaluator` is instantiated, pass the already-loaded `externals` dict (the vars from `systemdata.json`).

---

### [x] FIX-007 — fix: IOMEM_KERNEL_JSON never stored in pipeline context
**Branch:** `fix/007-iomem-ctx`
**Files:** `src/acpixm/stages/iomem_kernel.py`

`GrepIomemKernel.run()` writes `systemdata.json` but never sets `ctx.data[PipelineArtifact.IOMEM_KERNEL_JSON]`. Any stage reading that artifact gets a `KeyError`. Fix: one line after `_write_json`.

---

## Structural Refactors

### [x] FIX-017 — fix: bundle ast-grep-cli as a runtime dependency
**Branch:** `feat/017-astgrep-runtime`
**Files:** `pyproject.toml`

`ast-grep` is only in the `dev` group, so `uv tool install acpixm` does NOT
bring it and `analyze` fails until the user installs ast-grep separately. Fix:
move `ast-grep-cli` from `[dependency-groups] dev` to `[project] dependencies`
so `analyze` works out of the box. `acpica-tools` (for `collect`) still needs
a system install — document that split in README.

---

### [ ] FIX-008 — chore: add `__init__.py` to all subpackages
**Branch:** `chore/008-init-files`
**Files:** 5 new empty files

`acpi_matcher/`, `data_provider/`, `logic_engine/`, `formatters/`, `stages/` are implicit namespace packages — breaks mypy strict mode and some importlib behavior. Fix: add empty `__init__.py` to each.

---

### [ ] FIX-009 — refactor: flatten LogicOps + add missing comparison ops
**Branch:** `refactor/009-logic-ops`
**Files:** `src/acpixm/acpi_matcher/logic_engine/logic_ops.py`, `logic_engine.py`

1. `LogicOps` class of pure statics → module-level `REGISTRY: dict` (the class adds nothing).
2. `registry()` rebuilt per instantiation → module constant.
3. Add missing ops: `lt`, `lte`, `gte`, `eq`, `ne` (each is a one-liner).

---

### [ ] FIX-010 — refactor: flatten JsonHandler + fix multi.primary bug
**Branch:** `refactor/010-json-handler`
**Files:** `src/acpixm/acpi_matcher/json_handler.py`, callers in `acpi_analyzer.py` and `astgrep_scan.py`

`JsonHandler` is a class with only `@staticmethod` methods — just module functions. Also fix: `normalize()` silently drops `multi.primary` captures from ast-grep output.

---

### [ ] FIX-011 — chore: polish (typos, dead code, placeholder metadata)
**Branch:** `chore/011-polish`
**Files:** `cli.py`, `formatters/registry.py`, `yaml_processor.py`, `__init__.py`, `pipeline.py`, `iomem_kernel.py`, `acpi_analyzer.py`

- Fix typo `"veredict"` → `"verdict"` in `cli.py`
- Remove `ndjson` from `make_formatter` error string (not implemented)
- Remove redundant `Field(alias="logic")` in `yaml_processor.py`
- Fill in `__author__` / `__email__` in `__init__.py`
- Delete `PipelineData` TypedDict (duplicate of `PipelineArtifact`, no callers)
- Replace `print()` with `logging` in `acpi_analyzer.collect()`
- Delete dead `pattern` attribute in `iomem_kernel.py` — the field `pattern: str = r"System RAM"` is declared on the frozen dataclass but `_exec_grep()` hardcodes `["grep", "-i", "kernel", ...]`; the attribute is never read, so setting it at construction time has no effect
- Fix `__version__` duplication: `pyproject.toml` and `__init__.py` both hardcode `"0.1.0"` independently. Replace the `__init__.py` constant with `from importlib.metadata import version; __version__ = version("acpixm")` so there is a single source of truth
- Delete `PipelineContext.require()` — defined in `pipeline.py` but never called by any stage; stages access `ctx.data[key]` directly, so the guard is dead code that implies a contract it doesn't enforce

---

## Type Safety

### [ ] FIX-012 — feat: mypy + ruff config + fix all type errors
**Branch:** `feat/012-typing`
**Depends on:** FIX-008, FIX-009, FIX-010, FIX-011

Add to `pyproject.toml`:
```toml
[tool.mypy]
strict = true
python_version = "3.10"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]
```
Fix all mypy strict errors across `src/acpixm/`. After this: `uv run mypy src/` and `uv run ruff check src/` are both green.

---

## New Features

### [ ] FIX-013 — feat: expose standalone match() API
**Branch:** `feat/013-matcher-api`
**Files:** `src/acpixm/acpi_matcher/__init__.py`
**Depends on:** FIX-006, FIX-010

Extract the per-file analysis loop into a clean public function so another tool can import just the matcher without the CLI:

```python
from acpixm.acpi_matcher import match, MatchResult

results = match("rules/OpRegionSuspicious.yml", [Path("ssdt.dsl")])
# -> list[MatchResult]  where .found: bool, .target: Path, .matches: list[dict]
```

---

### [ ] FIX-014 — feat: unit test suite
**Branch:** `feat/014-unit-tests`
**Depends on:** FIX-009, FIX-010, FIX-013

Unit coverage below the golden integration test (which already lives in
`tests/integration/test_golden.py`, see FIX-015):

```
tests/unit/
  test_logic_ops.py          # all ops + edge cases (make-range length<=0, new comparison ops)
  test_token_resolver.py
  test_json_handler.py       # normalize, multi.primary capture
  # test_return_evaluator.py already exists
```

Once FIX-013 lands, add `tests/integration/test_matcher.py` exercising the
public `match()` API directly (faster than the subprocess CLI path in FIX-015).

---

## The Regression Net

### [x] FIX-015 — test: golden integration test + self-contained fixtures
**Branch:** `feat/015-golden-net`
**Files:** `tests/integration/test_golden.py`, `tests/fixtures/{clean.dsl,systemdata.json}`, `tests/conftest.py`, `pyproject.toml`, `README.md`, `CHANGELOG.md`

The keystone: prove that known rules produce known results, end-to-end, on
every MR. Done ahead of the Phase 2 refactors so they can't silently break
detection.

1. **Golden test** — shells out to the real `acpixm analyze --format json` using
   the *shipped* `examples/OpRegionCritical.yml`. Scans `tests/fixtures/` →
   exactly 1 finding (`rootkit1.asl`, `kern-code: true`); `clean.dsl` (a
   non-overlapping SystemMemory region) is not flagged. Positive + negative in
   one scan.
2. **Self-contained fixtures** — moved test data into `tests/fixtures/`
   (`rootkit1.asl`, `clean.dsl`, `systemdata.json`). Previously the test read
   the gitignored `output/` dump, so it would have failed on a fresh clone / in CI.
3. **`ast-grep-cli` added to the dev dep group** so `uv sync --group dev`
   provides the `ast-grep` binary locally AND in CI — no bespoke CI step, and
   the integration test runs automatically under `uv run pytest`.
4. **README install section fixed** — dropped the misleading venv step; documented
   that `ast-grep` (for `analyze`) and `acpica-tools` (for `collect`) are separate
   runtime prerequisites uv does not install.

**Verify:** `uv run pytest` → 10 passing. CI runs the e2e on every push/PR.

---

## Future — deferred fixes

### [ ] FIX-016 — release: 0.2.0 + PyPI publish
**Branch:** `chore/016-release`
**Depends on:** FIX-012

Make main pullable by anyone, per the production-grade goal:

1. Bump `pyproject.toml` version to `0.2.0`; move CHANGELOG `[Unreleased]` → `[0.2.0]`.
2. Add a `release.yml` GitHub Action: build wheel + `uv publish` (or `twine`)
   on pushed `v*` tags, gated on the CI job passing.
3. Once published: README gets `uv tool install acpixm` / `pipx install acpixm`.

### [ ] FIX-018 — test: collector unit tests with a fake SubprocessRunner
**Branch:** `test/018-collector-tests`

`collect()` and the pipeline stages take an injectable `SubprocessRunner`, so
they're testable without root/hardware:
- assert each stage builds the right `acpidump`/`acpixtract`/`iasl` argv;
- feed a fake runner canned `acpidump` + `/proc/iomem` output, assert the
  pipeline writes `systemdata.json` and populates `ctx.data` (would have caught
  the FIX-007 KeyError).
Real-hardware / QEMU HIL stays out of scope (see THESIS_EXTENSIONS.md).

### [x] FIX-019 — chore: tidy `tree-sitter-asl/` dev cruft
**Branch:** `chore/019-grammar-tidy`

The vendored `asl.so` the package actually uses lives under
`src/acpixm/tree-sitter-asl/`. The root `tree-sitter-asl/` carries grammar dev
scaffolding not needed to ship: `grammar.js.bkp`, `grammar.no-space.js`,
`Package.swift`, `go.mod`, `Cargo.toml`, `binding.gyp`, `*.wasm`. Trim to
grammar source + build instructions. Isolated PR (touches the grammar build) —
kept out of the quality-milestone branch on purpose.

---

## Roadmap / ideas (migrated from TODO.md)

- [ ] Make the tool Windows compatible.
- [ ] Fix grammar precedences on XOR assignments.
- [ ] Better UX when LogicEngine can't find a custom variable.
- [ ] Check if ast-grep supports more than one rule per file; if not, implement it.
- [ ] Implement more formatter outputs.
- [ ] Research more ACPI patterns worth shipping as example rules.
