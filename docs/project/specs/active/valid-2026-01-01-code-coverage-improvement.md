# Feature Validation: Code Coverage Improvement

## Purpose

Validation spec for the code coverage improvement implementation, covering Phases 1-3 of
the plan spec.

**Feature Plan:** [plan-2026-01-01-code-coverage-improvement.md]

## Stage 4: Validation Stage

## Validation Planning

This PR implements Phases 1-3 of the coverage improvement plan, plus additional
improvements:

1. **Phase 1**: Pure function tests (naming, initialValues)
2. **Phase 2**: Engine module tests (scopeRef, scopeRefValidation, parseTable)
3. **Phase 3**: Harness tests (rejectionMockAgent, harnessConfigResolver)
4. **Additional**: Wire format capture flag, movie research golden test

## Automated Validation (Testing Performed)

### Unit Testing

All new tests follow the table-driven pattern as specified in the plan.

#### Phase 1: CLI Pure Functions (50 tests)

- **`tests/unit/cli/naming.test.ts`** (29 tests)
  - `toSnakeCase`: camelCase to snake_case conversion
  - `toCamelCase`: snake_case to camelCase conversion
  - `convertKeysToSnakeCase`: object key conversion
  - `convertKeysToCamelCase`: object key conversion

- **`tests/unit/cli/initialValues.test.ts`** (21 tests)
  - `parseInitialValues`: CLI arg parsing (name=value, name:number=123, name:list=a,b,c)
  - `validateInitialValueFields`: field ID validation against schema
  - Error handling for invalid formats

#### Phase 2: Engine Modules (94 tests)

- **`tests/unit/engine/scopeRef.test.ts`** (34 tests)
  - `parseScopeRef`: field refs, qualified refs, cell refs
  - `serializeScopeRef`: round-trip serialization
  - Type guards: `isFieldRef`, `isQualifiedRef`, `isCellRef`
  - `getFieldId`: extraction from all ref types

- **`tests/unit/engine/scopeRefValidation.test.ts`** (19 tests)
  - Field reference resolution against schema
  - Qualified reference resolution (options, columns)
  - Cell reference resolution for tables
  - `validateCellRowBounds`: row bounds checking

- **`tests/unit/engine/parseTable.test.ts`** (41 tests)
  - `parseCellValue`: all column types, sentinels (%SKIP%, %ABORT%)
  - `extractTableHeaderLabels`: header parsing
  - `parseRawTable`: row normalization, separator validation
  - `parseMarkdownTable`: column matching by label/id
  - `extractColumnsFromTable`: type row parsing
  - `parseInlineTable`: inline format parsing

#### Phase 3: Harness Modules (14 tests)

- **`tests/unit/harness/rejectionMockAgent.test.ts`** (6 tests)
  - Wrong patch generation for table fields on first attempt
  - Correct patch after rejection feedback
  - Correct patch for non-table fields immediately
  - Non-field issue handling
  - `maxPatches` limit enforcement

- **`tests/unit/harness/harnessConfigResolver.test.ts`** (8 tests)
  - Default config values
  - Frontmatter config precedence
  - Options override precedence
  - Partial options merging
  - Metadata edge cases

#### Additional: Golden Tests

- **`tests/golden/golden.test.ts`** additions:
  - Complex Form Parse Tests for movie-deep-research form (42 fields)
  - Field value structure validation for all field types

### Integration and End-to-End Testing

- All 960 tests pass (including 158 new tests added in this PR)
- Pre-commit hooks run full test suite on each commit
- Pre-push hooks run full test suite before push

### Coverage Results

| Metric | Before | After | Target | Status |
| --- | --- | --- | --- | --- |
| Lines | 50.81% | 54.69% | 60% | In Progress |
| Statements | 50.41% | ~54% | 60% | In Progress |
| Branches | 49.27% | ~52% | 55% | In Progress |
| Functions | 49.35% | ~53% | 60% | In Progress |

**Coverage improved by ~4% in this PR.**

### Manual Testing Needed

The following should be verified by the user:

1. **Run tests and coverage locally:**
   ```bash
   pnpm --filter markform test
   pnpm --filter markform test:coverage
   ```

2. **Verify captureWireFormat flag behavior:**
   - The `fillForm()` API now requires `captureWireFormat: boolean` parameter
   - When `true`: wire format (full LLM prompts/responses) is logged in sessions
   - When `false`: wire format is omitted (smaller session files)
   - All existing CLI commands (`run`, `research`) pass `captureWireFormat: false`

3. **Review test patterns:**
   - Verify tests follow table-driven approach per the plan's guidelines
   - Confirm no long mechanistic tests were introduced

4. **Review movie research golden test:**
   - `examples/movie-research/movie-deep-research-mock-filled.form.md` contains Shawshank
     Redemption sample data
   - Verify the filled form parses correctly with all 42 fields

## Open Questions

None - all implementation follows the approved plan spec.
