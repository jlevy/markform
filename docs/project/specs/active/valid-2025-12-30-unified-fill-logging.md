# Feature Validation: Unified Fill Logging Architecture

## Purpose

This is a validation spec, used to list post-testing validation that must be performed
by the user to confirm the feature implementation and testing is adequate.

It should be updated during the development process, then kept as a record for later
context once implementation is complete.

**Feature Plan:** [plan-2025-12-30-unified-fill-logging.md](plan-2025-12-30-unified-fill-logging.md)

**Implementation Plan:** N/A (single-phase implementation)

## Stage 4: Validation Stage

## Validation Planning

This implementation unifies logging across all CLI commands that run agent fills
(`fill`, `run`, `examples`) using an expanded FillCallbacks architecture with new
`onIssuesIdentified` and `onPatchesGenerated` callbacks.

## Automated Validation (Testing Performed)

### Unit Testing

The following unit tests validate the implementation:

1. **fillLogging Tests** (`tests/unit/cli/fillLogging.test.ts`):
   - Tests `createFillLoggingCallbacks()` factory returns all expected callbacks
   - Tests `onIssuesIdentified` logs turn numbers and issue details
   - Tests `onPatchesGenerated` logs patches with field IDs and values
   - Tests verbose-only token count logging
   - Tests verbose-only tool start/end logging with timing
   - Tests verbose-only LLM call metadata logging
   - Tests quiet mode suppresses output
   - Tests spinner integration for web search
   - **13 tests passing**

2. **Harness Tests** (`tests/unit/harness/harness.test.ts`):
   - Tests harness step/apply workflow
   - **28 tests passing**

3. **Programmatic Fill Tests** (`tests/unit/harness/programmaticFill.test.ts`):
   - Tests fillForm API including callback invocation
   - **24 tests passing**

4. **All Tests**:
   - 732 tests passing across 30 test files
   - TypeScript compilation passes
   - ESLint passes with 0 warnings

### Integration and End-to-End Testing

1. **Golden Tests** (`tests/golden/golden.test.ts`):
   - End-to-end session replay tests (3 tests passing)

2. **Integration Tests** (`tests/integration/programmaticFill.test.ts`):
   - Tests fillForm with mock agents (8 tests passing)

3. **Build Validation**:
   - `pnpm typecheck` passes
   - `pnpm lint` passes
   - All pre-push hooks pass

## Manual Testing Needed

### 1. Verify Default Logging in `run` Command

Test that `markform run` now shows detailed turn/patch logging by default:

```bash
# Run an agent fill and observe the output
markform run forms/movie-research-demo.form.md

# Expected output (default verbosity):
# Turn 1: full_title (missing), imdb_url (missing), ...
#   -> 5 patch(es):
#     full_title (set_string) = "Inception (2010)"
#     imdb_url (set_string) = "https://www.imdb.com/title/tt1375666/"
#     ...
#   Complete

# Verify: Output shows turn numbers, issue field IDs, patch field IDs + values
```

### 2. Verify --verbose Shows Additional Detail

Test that `--verbose` adds token counts and tool timing:

```bash
# Run with verbose flag
markform run forms/movie-research-demo.form.md --verbose

# Expected additional output in verbose mode:
#   Tokens: in=1234 out=567
#   Tool started: web_search
#   Tool web_search completed (1234ms)
#   LLM call: anthropic/claude-sonnet-4-5
#   LLM response: anthropic/claude-sonnet-4-5 (in=1234 out=567)
```

### 3. Verify --quiet Suppresses Output

Test that `--quiet` shows minimal output:

```bash
markform run forms/movie-research-demo.form.md --quiet

# Expected: Only final success/failure message, no turn-by-turn output
```

### 4. Verify `fill` Command Has Same Output

Compare output between `fill` and `run` commands to ensure consistency:

```bash
# These two should produce identical turn/patch logging format:
markform fill forms/movie-research-demo.form.md --model anthropic/claude-sonnet-4-5
markform run forms/movie-research-demo.form.md
```

### 5. Verify API Callbacks Work

For API consumers, verify callbacks receive correct data:

```typescript
import { fillForm } from 'markform';

const result = await fillForm({
  form: formMarkdown,
  model: 'anthropic/claude-sonnet-4-5',
  callbacks: {
    onIssuesIdentified: ({ turnNumber, issues }) => {
      console.log(`Turn ${turnNumber}: ${issues.length} issues`);
      // Verify: issues array contains InspectIssue objects with ref, message, severity
    },
    onPatchesGenerated: ({ turnNumber, patches, stats }) => {
      console.log(`Turn ${turnNumber}: ${patches.length} patches`);
      // Verify: patches array contains Patch objects with op, fieldId, value
      // Verify: stats contains inputTokens, outputTokens
    },
  },
});
```

### 6. Verify TurnProgress Has New Fields

Check that `onTurnComplete` receives the new `issues` and `patches` arrays:

```typescript
callbacks: {
  onTurnComplete: (progress) => {
    // Verify these new fields exist:
    console.log(progress.issues);   // InspectIssue[]
    console.log(progress.patches);  // Patch[]
  },
},
```

## Summary of Changes

| File | Change |
|------|--------|
| [harnessTypes.ts](packages/markform/src/harness/harnessTypes.ts) | Added `onIssuesIdentified`, `onPatchesGenerated` to FillCallbacks; added `issues`, `patches` to TurnProgress |
| [programmaticFill.ts](packages/markform/src/harness/programmaticFill.ts) | Call new callbacks in harness loop |
| [fillLogging.ts](packages/markform/src/cli/lib/fillLogging.ts) | **NEW** - Factory for CLI logging callbacks |
| [run.ts](packages/markform/src/cli/commands/run.ts) | Refactored to use `fillForm()` with logging callbacks |
| [fillLogging.test.ts](packages/markform/tests/unit/cli/fillLogging.test.ts) | **NEW** - 13 unit tests for logging callbacks |

## User Feedback

> To be filled in after user review

---

**Validation Status:** Ready for user review
