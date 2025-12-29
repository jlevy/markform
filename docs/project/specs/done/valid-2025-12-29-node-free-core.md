# Feature Validation: Node-Free Core Library

## Purpose

This is a validation spec, used to list post-testing validation that must be performed
by the user to confirm the feature implementation and testing is adequate.

It should be updated during the development process, then kept as a record for later
context once implementation is complete.

**Feature Plan:** [plan-2025-12-29-node-free-core.md](plan-2025-12-29-node-free-core.md)

**Implementation Plan:** N/A (single-phase refactor, implementation details in feature
plan)

## Stage 4: Validation Stage

## Validation Planning

This feature makes the core markform library Node.js-free by:

1. Moving `getFormsDir()` from `settings.ts` to `cli/lib/paths.ts`

2. Using build-time VERSION injection via tsdown `define`

3. Adding guard tests to prevent future regressions

## Automated Validation (Testing Performed)

### Unit Testing

The following automated tests are in place:

**Guard tests** (`tests/unit/node-free-core.test.ts`):

- [x] Source files outside `cli/` should not import from `node:`

- [x] `dist/index.mjs` should not reference `node:` modules

- [x] `dist/ai-sdk.mjs` should not reference `node:` modules

- [x] Built VERSION should match `package.json` version

**Existing tests updated**:

- [x] `tests/unit/index.test.ts` - VERSION export accepts both semver and ‘development’

- [x] `tests/unit/cli/formsDir.test.ts` - Updated import path to `cli/lib/paths.js`

**Full test suite**: All 682 tests pass.

### Integration and End-to-End Testing

- [x] `npm run build` succeeds with tsdown VERSION injection

- [x] Pre-push hooks run full test suite (verified during git push)

### Manual Testing Needed

The following manual validation steps should be performed:

#### 1. CLI Version Display

Verify the CLI shows the correct version from package.json:

```bash
markform --version
```

**Expected output**: `0.1.5` (or current version from package.json)

#### 2. Library VERSION Export

Verify the VERSION is correctly exported from the library:

```bash
node -e "import('markform').then(m => console.log('VERSION:', m.VERSION))"
```

**Expected output**: `VERSION: 0.1.5` (or current version)

#### 3. No Node.js Imports in Core (Manual Spot-Check)

Quick sanity check that grep confirms no Node imports leaked:

```bash
grep -r "from 'node:" packages/markform/src/ | grep -v "/cli/"
```

**Expected output**: No output (empty result)

#### 4. CLI Commands Still Work

Verify key CLI commands still function:

```bash
# Validate a form
markform validate packages/markform/examples/movie-research/movie-research-minimal.form.md

# Inspect a form
markform inspect packages/markform/examples/movie-research/movie-research-minimal.form.md

# Show help
markform --help
```

**Expected**: All commands execute without errors

#### 5. Guard Test Demonstration

Verify the guard test would catch a regression by temporarily adding a Node import:

```bash
# This is optional but confirms the guard works
# Temporarily edit src/settings.ts to add: import { join } from 'node:path';
# Run: npm test -- --run packages/markform/tests/unit/node-free-core.test.ts
# Expected: Test fails with clear message about violation
# Revert the change after testing
```

## Validation Checklist

- [ ] CLI version displays correctly

- [ ] Library VERSION export works

- [ ] No Node.js imports outside cli/ (manual grep check)

- [ ] CLI commands function normally

- [ ] Guard test would catch future regressions (optional)
