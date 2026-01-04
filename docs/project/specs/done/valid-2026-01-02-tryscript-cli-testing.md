# Feature Validation: Tryscript CLI End-to-End Testing

## Purpose

Validate that tryscript-based CLI testing is correctly implemented and integrated.

**Feature Plan:** [plan-2026-01-02-tryscript-cli-testing.md](../done/plan-2026-01-02-tryscript-cli-testing.md)

## Status

**All phases complete.** Upgraded to tryscript v0.1.0 with clean, portable test format.

## Automated Validation (Testing Performed)

### Unit Testing

Existing CLI unit tests remain unchanged (~328 test cases in `tests/unit/cli/`).

### End-to-End Testing

18 tryscript tests across 2 files, now using clean v0.1.0 format:

**`tests/cli/commands.tryscript.md`** (12 tests):
- `--version` - Version output with pattern matching
- `--help` - Help text with command list
- `status` - Form status display
- `validate` - Validation report with issues
- `inspect` - Form inspection output
- `dump` - Raw form dump
- `readme` - README generation
- `docs` - Documentation output
- `export --format yaml` - YAML export
- `schema` - JSON schema output
- `examples --list` - Example listing
- `models` - Model information

**`tests/cli/workflows.tryscript.md`** (6 tests):
- Missing file error for `status`
- Missing file error for `validate`
- Missing file error for `inspect`
- `apply` command with real form
- `inspect --help` subcommand help
- `fill --help` subcommand help

### Test Format (v0.1.0)

Tests now use clean, portable format:

```yaml
---
cwd: ../..
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
  CLI: ./dist/bin.mjs
timeout: 30000
---
```

Commands use shell variable expansion:
```console
$ $CLI status examples/simple/simple.form.md
```

### CI Integration

Tryscript tests run in GitHub Actions CI:
- Step: `pnpm --filter markform test:tryscript`
- Enabled in `.github/workflows/ci.yml`

## Manual Testing Checklist

### 1. Run Tryscript Tests Locally

```bash
cd packages/markform
pnpm test:tryscript
```

**Expected:** All 18 tests pass.

### 2. Verify Test Update Workflow

```bash
cd packages/markform
pnpm test:tryscript:update
```

**Expected:** Command runs successfully. No changes if tests already match.

### 3. Review Test Output

Run commands and compare with test expectations:

```bash
cd packages/markform
./dist/bin.mjs --version
./dist/bin.mjs validate examples/simple/simple.form.md
```

**Expected:** Output matches patterns in test files.

### 4. Verify CI Integration

Check GitHub Actions runs include tryscript step and it passes.

### 5. Review Documentation

Check `docs/development.md` includes tryscript workflow section.

## Resolved Issues

The following tryscript bugs were resolved by upgrading to v0.1.0:

- **markform-518**: `cwd` option to run from package directory ✓
- **markform-519**: `bin` config bug (now using env.CLI instead) ✓
- **markform-520**: `binName` option (now using shell expansion) ✓

## Open Questions

None - implementation complete.
