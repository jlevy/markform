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

**All 639 tests pass.** Key test coverage includes:

---

#### Type System Tests (`coreTypes.test.ts`)

**Schema validation for table-related types:**

- `TableField` schema validation with all required and optional attributes
- `TableColumn` schema with id, label, type, and required fields
- `TableValue` schema with kind='table' and rows array
- `CellResponse` schema with state ('answered', 'skipped', 'aborted') and value
- `TableRowPatch` schema for row objects in patches
- `SetTablePatch` schema with op='set_table', fieldId, and rows
- `ColumnTypeName` enum validation ('string', 'number', 'url', 'date', 'year')

---

#### Field Registry Tests (`fieldRegistry.test.ts`)

**Registry includes table field support:**

- 'table' field kind is registered
- `createEmptyValue('table')` returns `{ kind: 'table', rows: [] }`

---

#### Table Parsing Tests (`parse.test.ts`)

**Markdoc AST table parsing:**

- Parsing table-field with columnIds attribute
- Parsing table-field with inline column extraction from header row
- Header row extraction for column labels backfilling
- Column ID validation (snake_case identifiers only)
- Duplicate column ID detection and error reporting
- Array length validation between columnIds, columnLabels, columnTypes

**Sentinel value parsing in table cells:**

- `%SKIP%` sentinel detection in cell values
- `%SKIP% (reason)` with parenthesized reason extraction
- `%ABORT%` sentinel detection
- `%ABORT% (reason)` with reason extraction
- Sentinel rejection for required columns

**Cell value parsing with type coercion:**

- String columns: any text value accepted
- Number columns: integer and float parsing
- URL columns: URL format validation
- Date columns: ISO 8601 (YYYY-MM-DD) validation
- Year columns: integer year (1000-9999) validation

**Edge cases:**

- Empty tables (header + separator only)
- Single row tables
- Escaped pipe characters (`\|`) in cell values
- Whitespace handling in cells

**Attribute-based column validation:**

- Header reordering with attribute columns maps values by header name
- Invalid separator rejection with attribute columns

---

#### Table Serialization Tests (`serialize.test.ts`)

**Markdown table generation:**

- Header row with column labels
- Separator row with `---` markers
- Data rows with cell values
- Proper column alignment in output

**Cell value escaping:**

- Pipe character escaping (`|` → `\|`)
- Backslash-pipe preservation (`\|` → `\\|`)

**Sentinel value preservation:**

- `%SKIP%` serializes as-is
- `%SKIP% (reason)` includes reason in parentheses
- `%ABORT%` and `%ABORT% (reason)` preserved

**Attribute serialization:**

- columnIds array formatting
- columnLabels array formatting
- columnTypes array (omitted if all 'string')
- minRows, maxRows constraints
- required, role, priority, report attributes

---

#### Table Validation Tests (`validate.test.ts`)

**Row count constraints:**

- minRows validation with specific error codes
- maxRows validation with specific error codes
- required=true implies minRows >= 1

**Cell type validation:**

- String cells accept any text
- Number cells reject non-numeric input
- URL cells reject invalid URL formats
- Date cells reject invalid ISO 8601 formats
- Year cells reject out-of-range integers

**Empty cell handling:**

- Empty cells without sentinels produce validation errors
- Error message includes field.column reference

**Required column validation:**

- REQUIRED_CELL_SKIPPED error when required column has %SKIP%
- Required flag respected from columnTypes attribute

---

#### Apply/Patch Tests (`apply.test.ts`)

**set_table patch application:**

- Creates TableValue from PatchTableRow array
- Wraps cell values in CellResponse with state='answered'
- Converts sentinel strings to skipped/aborted state

**Row structure validation:**

- All columns must be present in each row
- Extra columns are ignored

**Cell type coercion during apply:**

- String values preserved as-is
- Number values stored as numbers
- Null values preserved for optional cells

---

#### Session Tests (`session.test.ts`)

**Session serialization with table patches:**

- set_table patches serialize to YAML correctly
- Row arrays preserve structure

**Column ID preservation:**

- Column IDs like `start_date` NOT converted to `startDate`
- YAML snake_case conversion preserves user-defined IDs
- Round-trip serialization maintains column ID integrity

---

#### Value Coercion Tests (`valueCoercion.test.ts`)

**coerceToTable function:**

- Array of row objects → SetTablePatch conversion
- Empty array handling
- Invalid input (non-array) rejection
- Nested object row structure preserved

---

#### Harness/Fill Tests

**harness.test.ts:**

- Harness with table fields in schema
- Table field appears in pending fields
- Table patches applied correctly

**programmaticFill.test.ts:**

- Programmatic fill with inputContext containing table values
- Table values coerced to patches
- Fill completion with table fields

---

#### Golden Tests (`golden.test.ts`)

**Session replay with table field turns:**

- `simple/simple.session.yaml` - Mock fill with table data
  - Turn 3: set_table patch with 2 rows
  - Column IDs preserved in patches
- `simple/simple-with-skips.session.yaml` - Mock fill with table skips
  - Table field with skip_field patch

---

#### Summary Tests (`summaries.test.ts`)

**Structure summary with table fields:**

- columnCount: total columns across all table fields
- columnsById: map of qualified refs (e.g., "people.name") to column metadata
- fieldCountByKind includes 'table' count

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
