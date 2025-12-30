# Feature Validation: Examples/Run/Status CLI Redesign

## Purpose

This is a validation spec, used to list post-testing validation that must be performed
by the user to confirm the feature implementation and testing is adequate.

It should be updated during the development process, then kept as a record for later
context once implementation is complete.

**Feature Plan:** [plan-2025-12-29-examples-run-commands.md](plan-2025-12-29-examples-run-commands.md)

**Implementation Plan:** N/A (single-phase implementation)

## Stage 4: Validation Stage

## Validation Planning

This implementation adds three new CLI commands (`examples`, `run`, `status`), a new
`run_mode` frontmatter field, and a global `--overwrite` CLI option.

## Automated Validation (Testing Performed)

### Unit Testing

The following unit tests validate the implementation:

1. **Parse Tests** (`tests/unit/engine/parse.test.ts`):
   - Tests for frontmatter parsing (roles, harness config, run_mode)
   - 86 tests passing including frontmatter extraction and metadata parsing

2. **Core Types Tests** (`tests/unit/engine/coreTypes.test.ts`):
   - Schema validation tests including RunModeSchema
   - 29 tests passing

3. **Examples Tests** (`tests/unit/cli/examples.test.ts`):
   - Tests for example registry and example loading
   - 19 tests passing

4. **All Tests**:
   - 682 tests passing across 28 test files
   - Comprehensive coverage of parse, serialize, validate, harness, and CLI functionality

### Integration and End-to-End Testing

1. **Golden Tests** (`tests/golden/golden.test.ts`):
   - End-to-end session replay tests (3 tests passing)

2. **Programmatic Fill Tests** (`tests/integration/programmaticFill.test.ts`):
   - Integration tests for form filling workflows (8 tests passing)

3. **Build Validation**:
   - TypeScript compilation passes
   - ESLint passes with 0 warnings
   - publint validates package exports

## Manual Testing Needed

### 1. Validate `markform examples` Command

Test the copy-only examples workflow:

```bash
# Test listing examples
markform examples --list

# Test copying all examples
rm -rf ./forms
markform examples
# Verify: Should create ./forms/ with all example forms
ls -la ./forms/

# Test copying specific example
markform examples --name=simple
# Verify: Should copy simple.form.md to ./forms/

# Test --overwrite behavior
markform examples --overwrite
# Verify: Should overwrite existing files
```

### 2. Validate `markform status` Command

Test the form status display:

```bash
# Test status on simple form
markform status forms/simple.form.md
# Verify output shows:
#   - Overall field counts (answered/total)
#   - By Role breakdown (user role stats)
#   - Run Mode: interactive (explicit)

# Test status on research form
markform status forms/movie-research-demo.form.md
# Verify output shows:
#   - By Role breakdown (user and agent)
#   - Run Mode: research (explicit)
```

### 3. Validate `markform run` Command

Test the menu-based form launcher:

```bash
# Test menu display (with no argument)
markform run
# Verify: Shows menu of forms in ./forms/ sorted by mtime
# Verify: Can cancel with Ctrl+C

# Test direct file execution
markform run forms/simple.form.md
# Verify: Detects run_mode=interactive, starts interactive fill

# Test with research form (cancel before model selection)
markform run forms/movie-research-demo.form.md
# Verify: Detects run_mode=research, prompts for model selection
```

### 4. Validate `run_mode` Frontmatter Field

Verify the example forms have the correct run_mode:

```bash
# Check simple form
head -10 packages/markform/examples/simple/simple.form.md
# Verify: run_mode: interactive

# Check research form
head -10 packages/markform/examples/movie-research/movie-research-demo.form.md
# Verify: run_mode: research
```

### 5. Validate Global `--overwrite` Option

```bash
markform --help
# Verify: --overwrite option is listed in global options
```

### 6. Validate Documentation

```bash
# Check development.md has new commands
grep -A 5 "CLI Commands" docs/development.md
# Verify: examples, run, status commands are documented
```

## User Feedback

> To be filled in after user review

---

**Validation Status:** Ready for user review
