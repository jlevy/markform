# Feature Validation: Table Field Type

## Purpose

This validation spec documents the testing and validation performed for the `table-field`
type implementation, which adds support for structured tabular data with typed columns
to Markform.

**Feature Plan:** [plan-2025-12-27-table-field-type.md](plan-2025-12-27-table-field-type.md)

**Implementation Plan:** N/A (implemented directly from plan spec)

## Stage 4: Validation Stage

## Validation Planning

The table-field feature is a comprehensive addition requiring validation of:
- Type system extensions (TableField, TableColumn, TableValue, etc.)
- Markdown table parsing from Markdoc AST
- Cell value parsing with type coercion
- Sentinel value detection (%SKIP%, %ABORT%) in cells
- Serialization back to markdown table format
- Patch application (set_table operation)
- Session handling with table row column ID preservation
- Mock agent support for golden testing

## Automated Validation (Testing Performed)

### Unit Testing

**All 637 tests pass.** Key test coverage includes:

#### Type System Tests
- `tests/unit/engine/coreTypes.test.ts` - Schema validation for TableField, TableColumn,
  TableValue, CellResponse, TableRowPatch, SetTablePatch types
- `tests/unit/engine/fieldRegistry.test.ts` - Registry includes 'table' field kind,
  createEmptyValue for table fields

#### Parsing Tests
- `tests/unit/engine/parse.test.ts` - Table field parsing from Markdoc AST
- `tests/unit/engine/simple-form-validation.test.ts` - Simple form with table fields
  (21 fields including 2 tables, 8 groups)

#### Serialization Tests
- `tests/unit/engine/serialize.test.ts` - Table field serialization to markdown
- `tests/unit/engine/serialize-fence.test.ts` - Value fence handling

#### Validation Tests
- `tests/unit/engine/validate.test.ts` - Table validation including:
  - minRows/maxRows constraints
  - Cell type validation (string, number, url, date, year)
  - Required column validation (REQUIRED_CELL_SKIPPED)
  - Empty cell detection

#### Apply/Patch Tests
- `tests/unit/engine/apply.test.ts` - set_table patch application
  - Row structure validation
  - Cell type coercion
  - Sentinel value handling in patches

#### Session Tests
- `tests/unit/engine/session.test.ts` - Session serialization/parsing with table patches
  - Column ID preservation during YAML snake_case/camelCase conversion

#### Value Coercion Tests
- `tests/unit/valueCoercion.test.ts` - coerceToTable function
  - Array of row objects → SetTablePatch
  - Empty array handling
  - Invalid input rejection

#### Harness/Fill Tests
- `tests/unit/harness/harness.test.ts` - Harness with table fields
- `tests/unit/harness/programmaticFill.test.ts` - Programmatic fill with tables
- `tests/integration/programmaticFill.test.ts` - End-to-end programmatic fill

#### Golden Tests
- `tests/golden/golden.test.ts` - Session replay with table field turns
  - `simple/simple.session.yaml` - Mock fill with table data
  - `simple/simple-with-skips.session.yaml` - Mock fill with table skips

### Integration and End-to-End Testing

- **Golden Session Tests**: All 3 golden tests pass, including full session replay with
  table field patches
- **Programmatic Fill Tests**: 8 integration tests covering form filling with table
  fields via inputContext

## Manual Testing Needed

### 1. CLI Inspection

Verify table fields appear correctly in form inspection:

```bash
cd packages/markform
node dist/bin.mjs inspect examples/simple/simple.form.md
```

**Expected output includes:**
- "Table Fields" section showing team_members and project_tasks
- Proper field counts: 21 fields, 8 groups
- Table field labels and constraints (minRows, maxRows)

### 2. Mock Fill with Tables

Verify mock agent properly fills table fields:

```bash
node dist/bin.mjs fill --mock --mock-source examples/simple/simple-mock-filled.form.md \
  --roles='*' examples/simple/simple.form.md --dry-run
```

**Expected:**
- Turn 3 shows table patch application: `team_members (table) = [2 rows]`
- Form completes successfully in 3 turns

### 3. Export Verification

Verify table values export correctly:

```bash
node dist/bin.mjs export examples/simple/simple-mock-filled.form.md --format=json | \
  grep -A 20 team_members
```

**Expected:** Table value as array of row objects with column keys

### 4. Table Field Syntax Validation

Test error messages for common mistakes:

```bash
# Create a test form with invalid table syntax and verify error messages
```

Check for clear errors on:
- Invalid column ID (spaces in name)
- columnLabels length mismatch
- Invalid column type
- Empty cell without sentinel

### 5. Session Recording

Verify session transcripts correctly capture table patches:

```bash
node dist/bin.mjs fill --mock --mock-source examples/simple/simple-mock-filled.form.md \
  --roles='*' --record /tmp/test-session.yaml examples/simple/simple.form.md
cat /tmp/test-session.yaml | grep -A 10 "set_table"
```

**Expected:** Table rows with column IDs preserved (not converted to camelCase)

### 6. Visual Review of Examples

Review the example files to ensure table syntax is readable and correct:
- `examples/simple/simple.form.md` - Template with empty tables
- `examples/simple/simple-mock-filled.form.md` - Filled table with sample data
- `examples/simple/simple-skipped-filled.form.md` - Table field skipped

## User Acceptance Checklist

- [ ] CLI inspection shows table fields correctly
- [ ] Mock fill applies table patches successfully
- [ ] Table values export in expected JSON format
- [ ] Error messages are clear for common syntax mistakes
- [ ] Session recording preserves table row column IDs
- [ ] Example forms are readable and properly formatted
- [ ] No regressions in existing field types
