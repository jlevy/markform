# Feature Validation: Forms Directory Feature

## Purpose

This validation spec documents the testing performed and manual validation needed for the
forms directory feature (markform-271), which centralizes all form output to a
configurable `./forms` directory.

**Feature Specification:** Beads markform-271 through markform-279 in `.beads/issues.jsonl`

## Stage 4: Validation Stage

## Validation Planning

This feature adds centralized form output to a `./forms` directory by default, with CLI
override capability via `--forms-dir`. The implementation includes:

- `DEFAULT_FORMS_DIR` setting (`./forms`) in `settings.ts`
- `getFormsDir()` helper function for path resolution
- `ensureFormsDir()` utility for directory creation
- `generateVersionedPathInFormsDir()` for versioned output paths
- Updates to `examples` and `fill` commands
- Global `--forms-dir` CLI option
- `forms/` added to `.gitignore`

## Automated Validation (Testing Performed)

### Unit Testing

All new functionality is covered by unit tests (538 tests total, all passing):

1. **`formsDir.test.ts`** (7 tests) - New test file covering:
   - `getFormsDir()` returns default forms dir when no override provided
   - `getFormsDir()` uses override when provided
   - `getFormsDir()` handles absolute override paths
   - `getFormsDir()` resolves relative paths correctly
   - `ensureFormsDir()` creates directory with recursive option
   - `ensureFormsDir()` handles nested paths
   - `DEFAULT_FORMS_DIR` constant is set to `./forms`

2. **`versioning.test.ts`** (24 tests, 5 new) - Extended to cover:
   - `generateVersionedPathInFormsDir()` returns `-filled1` when no files exist
   - `generateVersionedPathInFormsDir()` returns `-filled2` when `-filled1` exists
   - `generateVersionedPathInFormsDir()` strips existing version from input filename
   - `generateVersionedPathInFormsDir()` skips to next available version
   - `generateVersionedPathInFormsDir()` handles input with just filename

### Integration and End-to-End Testing

- Pre-commit hooks run full test suite (538 tests passing)
- Pre-push hooks run full test suite (538 tests passing)
- TypeScript type checking passes
- ESLint linting passes with zero warnings
- Build succeeds (542.65 kB total)

## Manual Testing Needed

The following manual validation should be performed to confirm the feature works as
expected in real-world usage:

### 1. Verify `--forms-dir` Global Option Appears in Help

```bash
markform --help
```

Expected: Should show `--forms-dir <dir>` option with description mentioning default of
`./forms`.

### 2. Test `examples` Command Creates Forms Directory

```bash
# From a fresh directory
cd /tmp && mkdir test-markform && cd test-markform
markform examples --list
# Select an example interactively or use --name
markform examples --name simple
```

Expected:
- Should prompt for filename with message showing `(in ./forms):`
- Should create `./forms/` directory if it doesn't exist
- Output files should be written to `./forms/simple-filled1.form.md` (and .raw.md, .yml)

### 3. Test `fill` Command Uses Forms Directory

```bash
# Create a test form first
echo '---
markform: "1.0"
schema:
  id: test-form
  title: Test Form
fields:
  - id: name
    type: text
    required: true
---

# Test Form

Name: {% field #name /%}
' > test.form.md

# Run fill in interactive mode
markform fill test.form.md --interactive
```

Expected:
- Should create `./forms/` directory if needed
- Output should be written to `./forms/test-filled1.form.md`

### 4. Test `--forms-dir` Override

```bash
markform fill test.form.md --interactive --forms-dir ./custom-output
```

Expected:
- Should create `./custom-output/` directory
- Output should be written to `./custom-output/test-filled1.form.md`

### 5. Verify `.gitignore` Entry

```bash
cat .gitignore | grep "forms/"
```

Expected: Should show `forms/` entry in the project's `.gitignore`.

### 6. Verify Version Incrementing in Forms Directory

```bash
# Run fill multiple times
markform fill test.form.md --interactive
markform fill test.form.md --interactive
markform fill test.form.md --interactive
ls ./forms/
```

Expected: Should show `test-filled1.form.md`, `test-filled2.form.md`, `test-filled3.form.md`
(and corresponding `.raw.md` and `.yml` files).

### 7. Verify Dry Run Mode

```bash
markform fill test.form.md --interactive --dry-run
```

Expected: Should show `[DRY RUN] Would write form to: ./forms/test-filled1.form.md` without
creating the directory or files.

## User Acceptance Review

Please perform the manual validation steps above and confirm:

1. All CLI commands work as expected
2. Output paths and messaging are clear
3. The forms directory is created automatically when needed
4. The `--forms-dir` override works correctly
5. Version incrementing works within the forms directory

Please provide any feedback or requests for revisions.
