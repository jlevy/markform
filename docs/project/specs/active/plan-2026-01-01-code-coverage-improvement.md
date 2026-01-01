# Plan Spec: Code Coverage Improvement

## Purpose

Technical design doc for systematically improving code coverage from ~50% to 70%+ by
identifying coverage gaps, analyzing testability, and implementing targeted tests.

## Background

The markform project recently implemented code coverage CI infrastructure (PR #53). Current
coverage metrics (as of 2026-01-01):

| Metric | Current | Target (Phase 2) | Stretch Goal |
| --- | --- | --- | --- |
| Statements | 50.41% | 60% | 70% |
| Branches | 49.27% | 55% | 65% |
| Functions | 49.35% | 60% | 70% |
| Lines | 50.81% | 60% | 70% |

References:

- [Code Coverage Implementation Plan](plan-2025-12-31-code-coverage-implementation.md)
- [Code Coverage Validation](valid-2025-12-31-code-coverage-implementation.md)

## Summary of Task

Improve code coverage by:

1. Identifying files with lowest coverage
2. Analyzing testability and effort required
3. Prioritizing by impact and difficulty
4. Implementing targeted unit and integration tests
5. Adding golden tests for example forms

## Backward Compatibility

- **No breaking changes** - Only adding tests
- **No API changes** - Tests exercise existing code paths
- **Test isolation** - Tests use mocks/stubs, no external dependencies

## Stage 1: Planning Stage

### Coverage Gap Analysis

#### Tier 1: Zero Coverage - CLI Commands (0%)

The entire `src/cli/commands/` directory has 0% coverage. These are commander-based CLI
handlers that invoke library code.

| File | Lines | Branches | Testability | Priority |
| --- | --- | --- | --- | --- |
| `fill.ts` | 239 | 157 | Medium - needs CLI mocking | Medium |
| `run.ts` | 195 | 100 | Hard - orchestration layer | Low |
| `inspect.ts` | 129 | 100 | Medium - thin wrapper | Medium |
| `status.ts` | 101 | 59 | Medium - needs state mocking | Low |
| `examples.ts` | 124 | 75 | Easy - uses registry | High |
| `apply.ts` | 84 | 40 | Easy - already well-tested core | High |
| `browse.ts` | 80 | 37 | Hard - UI interactions | Exclude |
| `research.ts` | 82 | 36 | Hard - LLM integration | Exclude |
| `validate.ts` | 65 | 28 | Easy - validation logic | High |
| `dump.ts` | 58 | 66 | Easy - export logic | High |
| `export.ts` | 39 | 33 | Easy - builds on tested code | High |
| `schema.ts` | 22 | 10 | Easy - simple wrapper | High |

**Decision**: Focus on command handlers that wrap well-tested library code. Skip interactive
commands (browse) and LLM-dependent commands (research, run, fill).

#### Tier 2: Zero Coverage - CLI Library (0%)

| File | Lines | Branches | Testability | Priority |
| --- | --- | --- | --- | --- |
| `fileViewer.ts` | 94 | 40 | Hard - terminal interactions | Exclude |
| `initialValues.ts` | 30 | 15 | Easy - pure functions | High |
| `naming.ts` | 24 | 16 | Easy - pure functions | High |
| `runMode.ts` | 28 | 29 | Medium - mode logic | Medium |
| `fillCallbacks.ts` | 7 | 4 | Easy - small file | High |
| `cliVersion.ts` | 19 | 10 | Easy - version parsing | High |
| `shared.ts` | 78 | 53 | Medium - mixed utilities | Medium |

#### Tier 3: Low Coverage - Engine (0-30%)

| File | Lines | Coverage | Testability | Priority |
| --- | --- | --- | --- | --- |
| `scopeRef.ts` | 31 | 9.67% | Medium - reference resolution | High |
| `scopeRefValidation.ts` | 48 | 0% | Medium - validation logic | High |
| `table/parseTable.ts` | 176 | 30.68% | Easy - parser logic | High |

#### Tier 4: Low Coverage - Harness (0-40%)

| File | Lines | Coverage | Testability | Priority |
| --- | --- | --- | --- | --- |
| `liveAgent.ts` | 203 | 7.38% | Hard - LLM calls | Exclude |
| `modelResolver.ts` | 34 | 38.23% | Medium - config resolution | Medium |
| `rejectionMockAgent.ts` | 29 | 0% | Easy - mock implementation | High |
| `harnessConfigResolver.ts` | 2 | 0% | Easy - trivial | High |

#### Tier 5: Research Module (0%)

| File | Lines | Coverage | Testability | Priority |
| --- | --- | --- | --- | --- |
| `runResearch.ts` | 30 | 0% | Hard - LLM integration | Exclude |
| `researchFormValidation.ts` | 14 | 0% | Medium - validation | Medium |

### Coverage Impact Analysis

By priority, expected coverage gains:

| Priority | Estimated Line Count | % of Uncovered | Effort |
| --- | --- | --- | --- |
| High - Easy | ~400 lines | ~13% | Low |
| High - Engine | ~250 lines | ~8% | Medium |
| Medium | ~300 lines | ~9% | Medium |
| Exclude | ~600 lines | ~19% | N/A |

**Note**: ~50% of uncovered code is in "Exclude" categories (LLM integrations, interactive
UI) which require significant mocking infrastructure or external services.

### Example Form Testing Gaps

Current golden tests cover:

- `simple/simple.session.yaml` - Basic field types
- `simple/simple-mock-filled.form.md` - Export testing
- `rejection-test/` - Rejection handling

Missing coverage for:

- `movie-research/` - Complex forms with research
- `earnings-analysis/` - Financial analysis forms
- `startup-research/` - Multi-section research forms
- Table field parsing edge cases
- Date/year field validation
- URL list validation

### Feature Requirements

**Must Have (Target 60%+):** ✅ All Complete

- [x] Unit tests for CLI lib pure functions (naming, initialValues, cliVersion)
- [x] Unit tests for scopeRef and scopeRefValidation
- [x] Enhanced parseTable tests for edge cases
- [x] Unit tests for rejectionMockAgent
- [x] CLI command wrapper tests (validate, export, schema, dump)

**Should Have (Target 65%+):** ✅ Complete

- [x] Integration tests for CLI apply command
- [x] Golden tests for movie-research example form
- [x] Enhanced interactive prompts tests
- [x] modelResolver tests

**Nice to Have (Stretch to 70%+):** Partially Complete

- [x] Formatting utility tests
- [x] Additional example form golden tests
- [ ] CLI status command tests (future work)

**LLM Mocking (New):** ✅ Complete

- [x] Session replay integration test with MockLanguageModelV3
- [x] Table-driven test refactoring for maintainability

**NOT Included:**

- Tests requiring actual LLM API calls (liveAgent, research)
- Interactive terminal UI tests (browse, fileViewer)
- Tests that would require significant mocking infrastructure

### Acceptance Criteria ✅ All Met

1. ✅ Overall line coverage >= 60% (actual: 60.73%)
2. ✅ Branch coverage >= 55% (actual: 59.30%)
3. ✅ Function coverage >= 60% (actual: 62.42%)
4. ✅ All new tests pass reliably in CI (1318 tests)
5. ✅ No flaky tests introduced

## Stage 2: Architecture Stage

### Testing Approach

#### 1. Pure Function Tests (Simplest)

Files like `naming.ts`, `initialValues.ts`, and `cliVersion.ts` contain pure functions that
can be tested directly without any mocking.

```typescript
// Example test structure for naming.ts
describe('naming utilities', () => {
  describe('generateFieldId', () => {
    it('converts label to snake_case', () => {
      expect(generateFieldId('User Name')).toBe('user_name');
    });
  });
});
```

#### 2. Engine Module Tests

`scopeRef.ts` and `scopeRefValidation.ts` require form fixtures but no external mocking.
Use existing test patterns from `validate.test.ts`.

```typescript
// Example test structure for scopeRef.ts
describe('scopeRef', () => {
  it('resolves simple field reference', () => {
    const form = parseForm(testFormWithRefs);
    const result = resolveRef(form, 'field_id');
    expect(result).toBeDefined();
  });
});
```

#### 3. Table Parser Tests

`parseTable.ts` needs additional fixtures for edge cases:

- Empty tables
- Single row tables
- Tables with all column types
- Malformed table syntax
- Max row limits

#### 4. CLI Command Tests

Test CLI commands by calling the underlying handler functions directly, mocking only
filesystem I/O:

```typescript
// Example test structure for validate command
describe('validate command', () => {
  it('validates well-formed form', async () => {
    const mockFs = createMockFs({ 'form.md': validFormContent });
    const result = await validateHandler('form.md', mockFs);
    expect(result.valid).toBe(true);
  });
});
```

#### 5. Golden Tests for Example Forms

Extend the existing golden test infrastructure to cover more example forms:

```typescript
const EXAMPLE_FORMS = [
  'simple/simple.form.md',
  'movie-research/movie-research-demo.form.md',
  // Add more...
];

for (const formPath of EXAMPLE_FORMS) {
  it(`parses and validates ${formPath}`, () => {
    const form = parseForm(readSync(formPath));
    expect(form.issues).toHaveLength(0);
  });
}
```

### Directory Structure for New Tests

```
packages/markform/tests/
├── unit/
│   ├── cli/
│   │   ├── naming.test.ts        # New
│   │   ├── initialValues.test.ts # New
│   │   ├── cliVersion.test.ts    # New
│   │   └── commands/
│   │       ├── validate.test.ts  # New
│   │       ├── export.test.ts    # New
│   │       ├── schema.test.ts    # New
│   │       └── dump.test.ts      # New
│   ├── engine/
│   │   ├── scopeRef.test.ts      # New
│   │   ├── scopeRefValidation.test.ts # New
│   │   └── parseTable.test.ts    # Enhance existing
│   └── harness/
│       └── rejectionMockAgent.test.ts # New
├── integration/
│   └── cli/
│       └── apply.test.ts         # New
└── golden/
    └── examples.test.ts          # New - validates all example forms
```

## Stage 3: Implementation

### Phase 1: Pure Function Tests (Easy Wins)

Add unit tests for pure functions in CLI lib.

**Tasks:**

- [ ] Create `tests/unit/cli/naming.test.ts`
- [ ] Create `tests/unit/cli/initialValues.test.ts`
- [ ] Create `tests/unit/cli/cliVersion.test.ts`
- [ ] Create `tests/unit/cli/fillCallbacks.test.ts`
- [ ] Verify coverage increase

**Expected coverage gain:** +2-3%

### Phase 2: Engine Module Tests (High Value)

Add tests for scope reference resolution and table parsing.

**Tasks:**

- [ ] Create `tests/unit/engine/scopeRef.test.ts`
- [ ] Create `tests/unit/engine/scopeRefValidation.test.ts`
- [ ] Enhance `tests/unit/engine/parseTable.test.ts` with edge cases
- [ ] Add table parsing fixtures for edge cases

**Expected coverage gain:** +3-4%

### Phase 3: Harness Tests

Add tests for mock agents and harness configuration.

**Tasks:**

- [ ] Create `tests/unit/harness/rejectionMockAgent.test.ts`
- [ ] Add tests for `harnessConfigResolver.ts`
- [ ] Enhance `modelResolver.test.ts`

**Expected coverage gain:** +1-2%

### Phase 4: CLI Command Tests

Add tests for CLI command handlers.

**Tasks:**

- [ ] Create `tests/unit/cli/commands/validate.test.ts`
- [ ] Create `tests/unit/cli/commands/export.test.ts`
- [ ] Create `tests/unit/cli/commands/schema.test.ts`
- [ ] Create `tests/unit/cli/commands/dump.test.ts`
- [ ] Create `tests/unit/cli/commands/apply.test.ts`

**Expected coverage gain:** +3-5%

### Phase 5: Example Form Golden Tests

Validate all example forms parse correctly and exports match expectations.

**Tasks:**

- [ ] Create `tests/golden/examples.test.ts`
- [ ] Add parsing tests for all forms in `/examples`
- [ ] Add export golden tests for filled forms
- [ ] Verify all example forms are valid

**Expected coverage gain:** +1-2% (indirect via code paths exercised)

## Stage 4: Validation Stage

### Coverage Targets

| Phase | Expected Coverage | Cumulative |
| --- | --- | --- |
| Baseline | 50.81% | 50.81% |
| Phase 1 | +2-3% | 53-54% |
| Phase 2 | +3-4% | 56-58% |
| Phase 3 | +1-2% | 57-60% |
| Phase 4 | +3-5% | 60-65% |
| Phase 5 | +1-2% | 61-67% |

### Test Verification

After each phase:

```bash
# Run coverage locally
pnpm --filter markform test:coverage

# Verify specific file coverage
pnpm --filter markform test:coverage -- --reporter=text

# View detailed HTML report
open packages/markform/coverage/index.html
```

### Success Metrics ✅ All Achieved

- [x] Line coverage >= 60% (60.73%)
- [x] Branch coverage >= 55% (59.30%)
- [x] Function coverage >= 60% (62.42%)
- [x] All tests pass in CI (1318 tests)
- [x] No test flakiness over 5 runs
- [x] Coverage thresholds updated in `vitest.config.ts`

### Rollback Plan

If tests cause issues:

1. Revert specific test file commits
2. Keep coverage thresholds at current levels
3. Document issues for future resolution

## Test Writing Guidelines

**IMPORTANT**: Prefer concise, data-driven tests over long mechanistic tests.

### Anti-patterns to Avoid

```typescript
// BAD: Long, repetitive explicit tests
it('converts fieldCount', () => {
  expect(toSnakeCase('fieldCount')).toBe('field_count');
});
it('converts parentFieldId', () => {
  expect(toSnakeCase('parentFieldId')).toBe('parent_field_id');
});
// ... 10 more identical tests
```

### Preferred Patterns

```typescript
// GOOD: Table-driven tests
const CASES: [string, string][] = [
  ['fieldCount', 'field_count'],
  ['parentFieldId', 'parent_field_id'],
  ['maxItems', 'max_items'],
];

for (const [input, expected] of CASES) {
  it(`converts ${input} to ${expected}`, () => {
    expect(toSnakeCase(input)).toBe(expected);
  });
}

// GOOD: Session-based golden tests
it('round-trips session with all field types', () => {
  const session = parseSession(sessionYaml);
  const serialized = serializeSession(session);
  expect(serialized).toBe(sessionYaml);
});

// GOOD: Assertion loops over data structures
it('validates all field types', () => {
  for (const field of form.schema.fields) {
    expect(field.id).toBeDefined();
    expect(field.kind).toMatch(/^(string|number|url)$/);
  }
});
```

### Benefits

- Less code = easier to maintain
- Data-driven tests make adding cases trivial
- Session-based tests catch regressions holistically
- Loop assertions cover edge cases systematically

## Implementation Notes

### Why Exclude Certain Files?

**liveAgent.ts (7.38% -> Keep as-is):**

- Requires mocking OpenAI SDK
- Real behavior depends on external API responses
- Would need to mock streaming, retries, error handling
- Better tested via integration tests with mock server (future work)

**browse.ts, fileViewer.ts (0% -> Exclude):**

- Terminal UI interactions (inquirer, terminal output)
- Would require mocking `process.stdout`, terminal size, etc.
- Low value for regression testing

**research.ts, runResearch.ts (0% -> Exclude):**

- Deep LLM integration
- Research quality varies by model/prompt
- Better validated via LLM eval framework (future work)

### Testing CLI Commands Without Executing Them

The CLI commands use commander.js and can be tested by:

1. Importing the handler function directly (preferred)
2. Mocking filesystem operations
3. Capturing output via mock console

```typescript
// Do this:
import { validateForm } from '../src/cli/commands/validate';
const result = await validateForm(mockFilePath, { fs: mockFs });

// Not this:
exec('npx markform validate form.md'); // Slow, flaky
```

### Incremental Threshold Updates

As coverage improves, update `vitest.config.ts` thresholds:

```typescript
thresholds: {
  statements: 55, // Increase from 50
  branches: 52,   // Increase from 49
  functions: 55,  // Increase from 49
  lines: 55,      // Increase from 50
}
```

## References

- [Vitest Coverage Documentation](https://vitest.dev/guide/coverage.html)
- [Current vitest.config.ts](../../packages/markform/vitest.config.ts)
- [Existing test patterns](../../packages/markform/tests/)
