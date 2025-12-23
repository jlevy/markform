# Feature Validation: Markform v0.1 Full Implementation

## Purpose

This is a validation spec for the Markform v0.1 full implementation, used to list
post-testing validation that must be performed by the user to confirm the feature
implementation and testing is adequate.

**Feature Plan:** [plan-2025-12-22-markform-v01-implementation.md](plan-2025-12-22-markform-v01-implementation.md)

**Architecture:** [arch-markform-initial-design.md](../../architecture/current/arch-markform-initial-design.md)

## Stage 4: Validation Stage

## Automated Validation (Testing Performed)

All automated tests pass (199 total tests across 13 test files).

### Unit Testing

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/unit/engine/types.test.ts` | 29 | Zod schemas, type validation |
| `tests/unit/engine/parse.test.ts` | 16 | Form parsing, field extraction |
| `tests/unit/engine/serialize.test.ts` | 11 | Canonical serialization, round-trip |
| `tests/unit/engine/summaries.test.ts` | 18 | Structure/progress summaries |
| `tests/unit/engine/validate.test.ts` | 26 | Built-in validators, patterns |
| `tests/unit/engine/apply.test.ts` | 12 | Patch application, transactions |
| `tests/unit/engine/inspect.test.ts` | 15 | Issue prioritization, completeness |
| `tests/unit/engine/session.test.ts` | 11 | Session transcript handling |
| `tests/unit/engine/simple-form-validation.test.ts` | 14 | Real form integration |
| `tests/unit/harness/harness.test.ts` | 18 | Form harness state machine |
| `tests/unit/integrations/ai-sdk.test.ts` | 26 | AI SDK tools |
| `tests/unit/index.test.ts` | 1 | Package exports |

### Integration and End-to-End Testing

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/golden/golden.test.ts` | 2 | Golden session replay (simple + company forms) |

**Golden Tests verify:**
- Session transcript parsing and validation
- Multi-turn form filling with mock agent
- Final form state matches expected output
- Issue counts match at each turn

### Build and Lint Validation

```bash
pnpm lint        # ESLint with type-aware rules - PASS
pnpm typecheck   # TypeScript strict mode - PASS
pnpm build       # tsdown dual ESM/CJS output - PASS
pnpm publint     # Package export validation - PASS
pnpm test        # 199 tests passing - PASS
```

## Manual Testing Needed

The following manual validation steps should be performed by the user. Use the
checkboxes to track progress.

### 0. Prerequisites

```bash
# Build the project first
pnpm build

# Verify all tests pass
pnpm test
```

- [ ] Build completes without errors
- [ ] All 199 tests pass

### 1. CLI Help and Version

Verify CLI help and version output for all commands:

```bash
pnpm markform --version
pnpm markform --help
pnpm markform inspect --help
pnpm markform export --help
pnpm markform apply --help
pnpm markform serve --help
pnpm markform run --help
```

- [ ] Version shows `0.1.0`
- [ ] Main help lists all 5 commands (inspect, export, apply, serve, run)
- [ ] Each command help shows relevant options
- [ ] Global flags documented: `--verbose`, `--quiet`, `--dry-run`

### 2. Golden Session Tests (Manual Verification)

Run golden tests and verify they work correctly:

```bash
# Run golden tests
pnpm test:golden

# Inspect the session files
cat packages/markform/tests/golden/sessions/simple.session.yaml
cat packages/markform/tests/golden/sessions/company-quarterly-analysis.session.yaml
```

- [ ] Golden tests pass (2 tests)
- [ ] Session YAML files are readable and well-structured
- [ ] Session contains turns with patches and expected issue counts

### 3. CLI Inspect Command

```bash
# Inspect simple form (YAML output)
pnpm markform inspect packages/markform/examples/simple/simple.form.md

# Inspect with JSON output
pnpm markform inspect packages/markform/examples/simple/simple.form.md --json
```

- [ ] YAML output shows structure, progress, form_state, and issues
- [ ] JSON output is valid JSON with same content
- [ ] Shows 12 fields across 5 groups
- [ ] Shows 9 required fields missing (form is empty)
- [ ] Terminal colors work for section headers

### 4. CLI Export Command

```bash
pnpm markform export packages/markform/examples/simple/simple.form.md
```

- [ ] Outputs valid JSON
- [ ] Contains `schema.id` and `schema.groups`
- [ ] Contains `values` object (empty for unfilled form)
- [ ] Contains `markdown` string

### 5. CLI Apply Command

```bash
# Test applying a patch (use --dry-run first)
pnpm markform apply packages/markform/examples/simple/simple.form.md --dry-run \
  --patch '[{"op":"set_string","fieldId":"name","value":"Test User"}]'

# Apply for real to a copy
cp packages/markform/examples/simple/simple.form.md /tmp/test-form.md
pnpm markform apply /tmp/test-form.md \
  --patch '[{"op":"set_string","fieldId":"name","value":"Test User"}]'
cat /tmp/test-form.md | grep "Test User"
```

- [ ] Dry run shows what would change without modifying
- [ ] Real apply modifies the form file
- [ ] Value appears in the modified form

### 6. CLI Run Command (Mock Mode)

```bash
# Run with mock agent
pnpm markform run packages/markform/examples/simple/simple.form.md --mock \
  --completed-mock packages/markform/examples/simple/simple.mock.filled.form.md
```

- [ ] Mock agent runs without errors
- [ ] Shows multiple turns filling the form
- [ ] Form reaches complete state
- [ ] Session transcript displays at end

### 7. Serve Command (Web UI)

```bash
pnpm markform serve packages/markform/examples/simple/simple.form.md
# Open http://localhost:3000 in browser
```

In browser at http://localhost:3000:

- [ ] Form renders with all 5 field groups
- [ ] Field labels and descriptions display correctly
- [ ] Text inputs, number inputs render properly
- [ ] Checkboxes render with correct markers (`[ ]`, `[x]`, etc.)
- [ ] Documentation blocks render as styled text
- [ ] "Save" button is visible
- [ ] Click "Save" creates a versioned file (check terminal output)
- [ ] CSS styling is clean and readable

### 8. Package Exports Verification

```bash
# Verify main ESM exports
node --input-type=module -e "import * as m from './packages/markform/dist/index.mjs'; console.log(Object.keys(m))"

# Verify AI SDK ESM exports
node --input-type=module -e "import * as m from './packages/markform/dist/ai-sdk.mjs'; console.log(Object.keys(m))"

# Verify publint passes
pnpm publint
```

Expected main exports:
- [ ] `parseForm`, `serialize`, `validate`, `inspect`, `applyPatches`
- [ ] `FormHarness`, `MockAgent`
- [ ] Type schemas (FieldSchema, PatchSchema, etc.)

Expected AI SDK exports:
- [ ] `createMarkformTools`, `MarkformSessionStore`, `PatchSchema`

Note: Package is ESM-only (no CommonJS exports).

### 9. Example Forms Validation

#### 9.1 Simple Form

```bash
pnpm markform inspect packages/markform/examples/simple/simple.form.md
```

- [ ] All field types recognized: string, number, string_list, single_select, multi_select, checkboxes
- [ ] All three checkbox modes work (multi, simple, explicit)
- [ ] Field count: 12 fields

#### 9.2 Company Quarterly Analysis Form

```bash
pnpm markform inspect packages/markform/examples/company-quarterly-analysis/company-quarterly-analysis.form.md
```

- [ ] Complex form with multiple field groups parses correctly
- [ ] Field count matches expectations (9+ groups)
- [ ] Custom validators logged (may show warnings if not loaded)

### 10. Documentation Review

- [ ] [README.md](../../../../README.md): Quick start instructions work
- [ ] [docs/development.md](../../../development.md): CLI usage section accurate
- [ ] [docs/development.md](../../../development.md): Testing section matches CI
- [ ] Architecture doc links are valid

### 11. CI Workflow Verification

```bash
# If gh CLI is available, check CI status
gh pr checks
```

- [ ] GitHub Actions CI workflow passes on PR
- [ ] CI logs show all steps complete:
  - [ ] pnpm install
  - [ ] pnpm lint
  - [ ] pnpm typecheck
  - [ ] pnpm build
  - [ ] pnpm publint
  - [ ] pnpm test

### 12. AI SDK Integration (Optional - Requires API Key)

```bash
# If you have ANTHROPIC_API_KEY set:
ANTHROPIC_API_KEY=your-key npx tsx packages/markform/scripts/test-live-agent.ts
```

- [ ] Agent makes tool calls (markform_inspect, markform_apply)
- [ ] Form is progressively filled
- [ ] Final form is marked complete
- [ ] Session transcript is logged

**Note:** Without API key, the script falls back to mock mode.

## User Feedback

> (To be filled after user review)

## Revision History

- 2025-12-23: Initial validation spec created for v0.1 implementation
