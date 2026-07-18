# ACPIxM - ACPI Rootkit Detection Tool

**A**bsolutely **C**ritical **P**attern **I**dentifier for **M**alware

A tool for collecting and analyzing ACPI tables to detect potential security indicators and rootkit behavior in system firmware.

## How it works

### Project Diagram

![](./diagrams/basic_graph.png)

The core is **ast-grep** running against a **custom tree-sitter grammar for ACPI ASL** (`asl.so`).
Tree-sitter parses `.dsl` files into an AST; ast-grep then pattern-matches against that AST using
rules from YAML files. Without the custom grammar, ast-grep cannot understand ACPI's DSL syntax.

## Features

- **ACPI Table Collection**: Dumps and disassembles ACPI tables using `acpica-tools`
- **Custom ASL Grammar**: Vendored tree-sitter grammar (`tree-sitter-asl`) so ast-grep can parse ACPI DSL files
- **AST Pattern Matching**: ast-grep rules match structural ASL patterns, not just text
- **Logic Evaluation**: YAML `logic:` steps run Python expressions against captured AST values and external variables
- **Multiple Output Formats**: Console (pretty) and JSON output
- **Python API**: Import `match()` directly without the CLI

## Installation

### Prerequisites

ACPIXM shells out to `acpica-tools` for the `collect` command — a C binary
suite that is **not** on PyPI and must be installed separately. `ast-grep` is
bundled automatically via `uv`.

| Tool | Needed for | Install |
|---|---|---|
| `acpica-tools` (`acpidump`, `acpixtract`, `iasl`) | `acpixm collect` | `sudo apt install acpica-tools` |
| `ast-grep` | `acpixm analyze` | installed automatically by `uv` |

#### 1. Install ACPICA Tools (for ACPI table collection)

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install acpica-tools
```

#### 2. Install uv (Python package manager)

Follow instructions from official repo: [astra-sh/uv](https://github.com/astral-sh/uv)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc  # or restart your terminal
```

### Install ACPIXM

`uv tool install` puts `acpixm` on your PATH in its own isolated environment —
no virtualenv to create or activate.

```bash
# Option A — install directly from GitHub
uv tool install git+https://github.com/manugcr/acpixm

# Option B — from a local clone
git clone https://github.com/manugcr/acpixm.git
cd acpixm
./install.sh          # wraps: uv tool install . --force
```

### Verify Installation

```bash
# Check if acpixm is available
acpixm --help

# Verify acpica-tools (needed for collect)
acpidump --help
```

## Usage

### 1. Collect ACPI Data

First, collect ACPI tables and system information (requires sudo):

```bash
sudo acpixm collect --output ./data
```

This creates:
- `*.dsl` files: Disassembled ACPI tables
- `systemdata.json`: System variables for logic evaluation

### 2. Analyze with Rules

Analyze the collected data using detection rules:

```bash
# Console output (pretty formatted)
acpixm analyze --rule examples/OpRegionSuspicious.yml --files ./data

# JSON output (for automation)
acpixm analyze --rule examples/OpRegionSuspicious.yml --files ./data --format json

# With external variables
acpixm analyze --rule examples/OpRegionCritical.yml --files ./data --vars ./data/systemdata.json
```

### 3. Example Rule Structure

Rules are defined in YAML format:

```yaml
# AST pattern matching
ast:
  id: opregion-kernel-space
  language: asl
  message: OperationRegion pointing to kernel space
  severity: warning
  rule:
    pattern: OperationRegion ($REGNAME, SystemMemory, $OFFSET, $LENGTH)

# Optional logic evaluation — Python expressions, $VARNAME = ast-grep capture
# or external variable from systemdata.json. Step ids can reference prior steps.
logic:
  operating-region: "make_range($OFFSET, $LENGTH)"
  kern-code: "overlaps(operating-region, $KERNEL_CODE_RANGE)"

# Return conditions
return:
  - found: kern-code
  - not-found: otherwise
```

#### Logic expression reference

Expressions are evaluated by [simpleeval](https://github.com/danthedeckie/simpleeval) — a safe
Python expression evaluator. Standard Python operators (`+`, `-`, `*`, `>`, `<`, `==`, `!=`,
`and`, `or`, `not`, `in`, …) and list/dict literals work. Full `exec`/`import`/arbitrary
calls are blocked by design.

**Variable resolution order:** `logic:` step results → ast-grep captures → `--vars` externals.
Reference a capture or external with `$NAME`; reference a prior logic step by its id (hyphens
become underscores internally, so `kern-code` is also valid).

**Built-in domain functions:**

| Function | Signature | Returns | Description |
|---|---|---|---|
| `make_range` | `(start: int, length: int)` | `[low, high]` | Converts an `(offset, length)` pair to an inclusive `[start, end]` range. Length ≤ 0 → empty range. |
| `overlaps` | `(a: [int,int], b: [int,int])` | `bool` | True if two `[low, high]` ranges share at least one address. |
| `overlaps_any` | `(a: [int,int], ranges: list)` | `bool` | True if `a` overlaps any range in a list of `[low, high]` pairs. |
| `in_range` | `(value: int, bounds: [int,int])` | `bool` | True if `value` falls within the inclusive `[low, high]` bounds. |
| `in_any_range` | `(value: int, ranges: list)` | `bool` | True if `value` falls within any range in a list of `[low, high]` pairs. |

**Expression examples:**

```yaml
logic:
  # Arithmetic and hex literals — compute the end address of a region
  end-addr: "int($OFFSET, 16) + int($LENGTH, 16)"

  # Boolean logic — combine two prior steps
  suspicious: "kern-code and not smm-region"

  # Comparison — flag regions larger than 4 KB
  big-region: "int($LENGTH, 16) > 0x1000"

  # Membership — check space type is one of several known bad values
  bad-space: "$SPACE_TYPE in ['SystemMemory', 'SystemIO']"

  # Ternary — normalize a value before further evaluation
  normalized-offset: "int($OFFSET, 16) if $OFFSET else 0"

  # Chained steps — reference a prior step result by its id
  region: "make_range(int($OFFSET, 16), int($LENGTH, 16))"
  hits-kernel: "overlaps(region, $KERNEL_CODE_RANGE)"

  # overlaps_any — check against multiple known sensitive ranges at once
  hits-sensitive: "overlaps_any(region, $SENSITIVE_RANGES)"
  # where systemdata.json provides:
  #   "SENSITIVE_RANGES": [[0xfed00000, 0xfed00fff], [0xfee00000, 0xfee00fff]]
```

**Available builtins in expressions:** `int()`, `float()`, `str()`.
Bitwise operators (`&`, `|`, `^`, `<<`, `>>`) also work and are useful for masking addresses.

### Python API

Skip the CLI and import the matcher directly — useful for scripting or embedding in another tool:

```python
from pathlib import Path
from acpixm.acpi_matcher import match, MatchResult

results: list[MatchResult] = match(
    "examples/OpRegionCritical.yml",
    [Path("output/dsdt.dsl"), Path("output/ssdt1.dsl")],
    externals={"KERNEL_CODE_RANGE": [0xFFFFFFFF80000000, 0xFFFFFFFFFFFFFFFF]},
)

for r in results:
    if r.found:
        print(f"FOUND in {r.target}: {len(r.matches)} match(es)")
```

`MatchResult` fields: `target: Path`, `found: bool`, `matches: list[dict]`.

## Rule Examples

The `examples/` directory contains several detection rules:

- `OpRegionCritical.yml`: Detects OperationRegions overlapping kernel memory (uses `make_range` + `overlaps`)
- `OpRegionSuspicious.yml`: Detects OperationRegions in suspicious spaces (GeneralPurposeIO, IPMI, SystemCMOS)
- `LoadStore.yml`: Identifies dynamic code loading patterns
- `StoreCode.yml`: Finds code modification attempts

## Development

### External Tools

- **acpica-tools**: ACPI table manipulation (`acpidump`, `iasl`)
- **ast-grep**: AST-based pattern matching with custom grammar
- **tree-sitter-asl**: Custom ASL grammar for ast-grep

### Custom ASL Grammar

The grammar lives in `tree-sitter-asl/grammar.js`. It defines ACPI ASL syntax as a tree-sitter
grammar, which is compiled to a shared library (`asl.so`) that ast-grep loads at runtime.

**Two copies of `asl.so` exist:**
- `tree-sitter-asl/asl.so` — the build output / dev copy
- `src/acpixm/tree-sitter-asl/asl.so` — committed into the package (what `acpixm analyze` uses)

Both must be kept in sync. After editing the grammar, rebuild and copy:

```bash
# Prerequisites (one-time)
npm install -g tree-sitter-cli      # or: cargo install tree-sitter-cli
# Also needs a C compiler (gcc/clang)

cd tree-sitter-asl

# 1. Regenerate the C parser from grammar.js
tree-sitter generate

# 2. Build the shared library
tree-sitter build
# → produces tree-sitter-asl/asl.so

# 3. Run grammar tests
tree-sitter test

# 4. Copy the artifact into the package
cp asl.so ../src/acpixm/tree-sitter-asl/asl.so
```

---

## Sources

Thanks to my tutor Daniel Gutson for the idea, review and support.

And thanks to John Heasman for the research over ACPI, and Michael Denzel for extending this research and developing a tool to catch some of this ideas, this was based over that.
- [bh-eu-06-Heasman](https://www.blackhat.com/presentations/bh-europe-06/bh-eu-06-Heasman.pdf)
- [ACPI-rootkit-scan](https://github.com/mdenzel/ACPI-rootkit-scan)
- [ACPIxM - Ekoparty 2025](https://www.youtube.com/watch?v=SIo_Q1jKhaE)

