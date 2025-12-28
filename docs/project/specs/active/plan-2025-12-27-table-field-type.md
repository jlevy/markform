# Plan Spec: Table Field Type

## Purpose

Add a new `table-field` type to Markform for structured tabular data with typed columns.
This enables forms to collect structured data like filmographies, team rosters, award
histories, and other naturally tabular information that is currently awkwardly
represented as string-lists with pipe-delimited formats.

## Background

Currently, forms that need tabular data use workarounds:

1. **Pipe-delimited string-lists** — e.g., `"Oscar | Best Picture | 1995"` in instructions
   with format guidance. This is error-prone and requires LLMs to parse/generate
   correctly.

2. **Multiple related fields** — Separate `string-list` fields for each "column" that must
   be kept in sync. This is fragile and hard to validate.

3. **Markdown tables in string fields** — Free-form markdown that can't be validated or
   typed.

A native `table-field` provides:

- Typed columns with per-column validation
- Standard markdown table syntax (familiar to LLMs and humans)
- Header-as-ID pattern (simple, unambiguous)
- Sentinel value support (`|SKIP|`, `|ABORT|`) matching other field types

Reference: `SPEC.md` Layer 2 (Form Data Model) for field type definitions.

## Summary of Task

Add a new field type `table-field` (kind: `'table'`) that:

1. Uses markdown table syntax for values
2. Has typed columns specified via `columnTypes` attribute
3. Uses header row as column IDs (must be valid snake_case identifiers)
4. Supports row count constraints via `minRows`/`maxRows`
5. Validates cell values against column types
6. Supports sentinel values (`|SKIP|`, `|ABORT|`) in cells

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN - Adding new field
  type is additive

- **Library APIs**: DO NOT MAINTAIN - New field type; existing forms unaffected

- **Server APIs**: N/A

- **File formats**: DO NOT MAINTAIN - New optional field type; old forms parse correctly

- **Database schemas**: N/A

## Stage 1: Planning Stage

### Type Taxonomy

Before defining `table-field`, we formalize the existing field type categories:

**Simple Types (Scalar)** — Single-value, can be table columns:

| Type | Description | Example Value |
|------|-------------|---------------|
| `string` | Single-line text | `"John Smith"` |
| `number` | Float or integer | `42.5` |
| `url` | Validated URL | `"https://example.com"` |
| `date` | ISO 8601 date (YYYY-MM-DD) | `"2024-01-15"` |
| `year` | Integer year | `2024` |

**Multiline Types** — Require multiple lines, standalone fields only:

| Type | Description |
|------|-------------|
| `text` | Multi-line text (string with multiline=true) |
| `string_list` | Array of strings, one per line |
| `url_list` | Array of URLs, one per line |

**Structured Types** — Have predefined options, don't fit in tables:

| Type | Description |
|------|-------------|
| `checkboxes` | Stateful checklist with modes |
| `single_select` | Choose one from enumerated options |
| `multi_select` | Choose multiple from enumerated options |

**Composite Types** — Contain other types:

| Type | Description |
|------|-------------|
| `table` | Rows of typed columns (NEW) |

### Feature Requirements

**Must Have:**

1. **Syntax:**
   ```md
   {% table-field id="key_people" label="Key People" role="agent" required=true
      minRows=1 maxRows=10 columnTypes=["string", "string", "url", "string"] %}
   | name | title | linkedin_url | background |
   |------|-------|--------------|------------|
   | John Smith | CEO | https://linkedin.com/in/jsmith | 20 years in tech |
   {% /table-field %}
   ```

2. **Column types:** Support simple types only: `string`, `number`, `url`, `date`, `year`

3. **Header validation:**
   - Headers must be valid identifiers (regex: `^[a-z][a-z0-9_]*$`)
   - Headers must be unique within the table
   - Header count must match `columnTypes` array length

4. **Cell validation:**
   - Each cell validated against its column's type
   - Empty cells are invalid (must use `|SKIP|` or `|ABORT|` to skip)
   - Clear error messages for type mismatches

5. **Sentinel values in cells:**
   - `|SKIP|` — cell explicitly skipped
   - `|SKIP| (reason)` — skipped with parenthetical reason
   - `|ABORT|` — cell could not be completed
   - `|ABORT| (reason)` — aborted with reason
   - Reuse existing `parseSentinelValue()` logic from `parseSentinels.ts`

6. **Row constraints:**
   - `minRows` — minimum row count (default: 0)
   - `maxRows` — maximum row count (default: unlimited)
   - `required=true` implies `minRows >= 1`

7. **Patch operation:**
   ```json
   {
     "op": "set_table",
     "fieldId": "key_people",
     "rows": [
       {"name": "John", "title": "CEO", "linkedin_url": "https://...", "background": "..."}
     ]
   }
   ```

8. **Export format:**
   ```json
   {
     "kind": "table",
     "rows": [
       {"name": "John", "title": "CEO", "linkedin_url": "https://...", "background": "..."}
     ]
   }
   ```

**Nice to Have (v2):**

1. Column-level `required` attribute (some columns optional)
2. Multiline types in cells (would need multi-line cell syntax)
3. Column-level constraints (minLength, pattern, etc.)
4. Column display labels separate from IDs

**Not in Scope:**

1. Nested tables
2. Spanning cells (colspan/rowspan)
3. Rich formatting in cells
4. Structured types (checkboxes, selects) in cells

### Acceptance Criteria

1. **Parsing:** Form with table-field parses correctly, extracts columns and rows
2. **Header validation:** Invalid header (e.g., "First Name") produces clear parse error
3. **Column count mismatch:** Error if columnTypes length ≠ header count
4. **Cell type validation:** Non-numeric value in number column produces clear error
5. **Sentinel parsing:** `|SKIP| (reason)` in cell parses correctly
6. **Row constraints:** minRows/maxRows validated correctly
7. **Serialization:** Round-trip preserves table structure and values
8. **Patch:** set_table patch applies correctly
9. **Export:** Table values export as array of row objects

### Open Questions

1. **Empty table syntax:** How to represent a table with no data rows?
   **Resolution:** Header + separator row only:
   ```md
   | name | title |
   |------|-------|
   ```

2. **Pipe in cell content:** How to escape `|` in cell values?
   **Resolution:** Use `\|` for literal pipe. Sentinel patterns `|SKIP|` and `|ABORT|`
   are recognized specially.

3. **Whitespace handling:** How to handle leading/trailing whitespace in cells?
   **Resolution:** Trim whitespace from cell values (standard markdown table behavior).

4. **Row validation completeness:** Must every cell in a row have a value?
   **Resolution:** Yes. Empty cells are invalid. Use `|SKIP|` to explicitly skip.

## Stage 2: Architecture Stage

### Type Definitions

**New types in `coreTypes.ts`:**

```typescript
/** Column type for table cells - simple types only */
export type ColumnType = 'string' | 'number' | 'url' | 'date' | 'year';

/** Column definition - derived from header + columnTypes */
export interface TableColumn {
  id: Id;           // from header cell (e.g., "linkedin_url")
  type: ColumnType; // from columnTypes array
}

/** Table field - structured tabular data with typed columns */
export interface TableField extends FieldBase {
  kind: 'table';
  columns: TableColumn[];  // column definitions in order
  minRows?: number;
  maxRows?: number;
}

/** Cell value - scalar value or null */
export type CellValue = string | number | null;

/** Table row - record from column ID to cell value */
export type TableRow = Record<Id, CellValue>;

/** Cell response - matches FieldResponse pattern */
export interface CellResponse {
  state: AnswerState;     // 'answered' | 'skipped' | 'aborted'
  value?: CellValue;      // present when state === 'answered'
  reason?: string;        // present when state === 'skipped' or 'aborted'
}

/** Table row response - each cell has a response */
export type TableRowResponse = Record<Id, CellResponse>;

/** Table field value */
export interface TableValue {
  kind: 'table';
  rows: TableRowResponse[];
}

/** Set table field patch */
export interface SetTablePatch {
  op: 'set_table';
  fieldId: Id;
  rows: TableRow[];  // simplified for patches (no sentinel structure)
}
```

### Parsing Strategy

1. Extract markdown table from tag body
2. Parse first row as header → extract column IDs
3. Validate each header is valid identifier (`^[a-z][a-z0-9_]*$`)
4. Validate columnTypes array length matches header count
5. Build `columns: TableColumn[]` by zipping headers with types
6. Skip separator row (row 2 with `|---|---|`)
7. Parse data rows (row 3+):
   - For each cell, check for sentinel pattern first
   - If sentinel, extract state and reason using existing `parseSentinelValue()`
   - If not sentinel, coerce value to column type
   - Build `TableRowResponse` for each row

### Validation Rules

**Parse-time validation (structural):**

| Rule | Error Code | Example Error Message |
|------|------------|----------------------|
| Header must be valid ID | `INVALID_COLUMN_ID` | `Column header "First Name" is not a valid identifier. Use snake_case like "first_name".` |
| Headers must be unique | `DUPLICATE_COLUMN_ID` | `Duplicate column header "name" at position 3.` |
| columnTypes length must match headers | `COLUMN_TYPE_MISMATCH` | `columnTypes has 3 entries but table has 4 columns.` |
| columnTypes values must be valid | `INVALID_COLUMN_TYPE` | `Column type "text" is not valid. Use: string, number, url, date, year.` |

**Value validation (semantic):**

| Rule | Error Code | Example Error Message |
|------|------------|----------------------|
| Cell must have value or sentinel | `CELL_EMPTY` | `Cell at row 2, column "title" is empty. Provide a value or use \|SKIP\|.` |
| Number cell must parse | `CELL_TYPE_MISMATCH` | `Cell "abc" at row 1, column "rt_score" is not a valid number.` |
| URL cell must be valid | `CELL_TYPE_MISMATCH` | `Cell "not-a-url" at row 1, column "website" is not a valid URL.` |
| Date cell must be ISO format | `CELL_TYPE_MISMATCH` | `Cell "Jan 15" at row 1, column "release_date" is not a valid date. Use YYYY-MM-DD format.` |
| Year cell must be integer | `CELL_TYPE_MISMATCH` | `Cell "2024.5" at row 1, column "release_year" is not a valid year.` |
| Row count ≥ minRows | `MIN_ROWS_NOT_MET` | `Table "films" has 2 rows but requires at least 5.` |
| Row count ≤ maxRows | `MAX_ROWS_EXCEEDED` | `Table "films" has 20 rows but maximum is 15.` |

### Serialization Strategy

Serialize as canonical markdown table:

```md
{% table-field id="key_people" label="Key People" columnTypes=["string", "string", "url", "string"] minRows=1 %}
| name | title | linkedin_url | background |
|------|-------|--------------|------------|
| John Smith | CEO | https://linkedin.com/in/jsmith | 20 years in tech |
| Jane Doe | CTO | |SKIP| (No public profile) | Former Google engineer |
{% /table-field %}
```

**Formatting rules:**
- No padding in cells (canonical)
- Separator row uses minimum dashes (`|---|`)
- Sentinel values serialized as-is with parenthetical reason
- Empty table = header + separator only

#### Cell Value Escaping (Robust Serialization)

When serializing cell values to markdown table syntax, proper escaping is required
to ensure round-trip fidelity. The following escaping rules apply:

**Escape sequences (serialize → parse):**

| Character | Escaped Form | Notes |
|-----------|--------------|-------|
| `\|` (pipe) | `\\|` | Required - pipe is the cell delimiter |
| `\\` before `\|` | `\\\\|` | Preserve literal backslash-pipe sequence |

**Rejected characters (invalid in cells):**

| Character | Reason | Error Message |
|-----------|--------|---------------|
| Newline (`\n`, `\r`) | Tables are single-line | `Cell value cannot contain newlines` |
| Control characters | Not renderable | `Cell value contains invalid control characters` |

**Serialization algorithm:**

```typescript
function escapeTableCell(value: string): string {
  // Reject newlines and control characters
  if (/[\n\r]/.test(value)) {
    throw new Error('Cell value cannot contain newlines');
  }
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value)) {
    throw new Error('Cell value contains invalid control characters');
  }
  
  // Escape backslash-before-pipe first, then standalone pipes
  return value.replace(/\\\|/g, '\\\\|').replace(/\|/g, '\\|');
}

function unescapeTableCell(escaped: string): string {
  // Reverse: unescape \\| → \| and \| → |
  return escaped.replace(/\\\\\|/g, '\u0000ESCAPED_BACKSLASH_PIPE\u0000')
                .replace(/\\\|/g, '|')
                .replace(/\u0000ESCAPED_BACKSLASH_PIPE\u0000/g, '\\|');
}
```

**Sentinel value handling:**

Sentinel patterns (`|SKIP|`, `|ABORT|`) are NOT escaped during serialization.
They are recognized as special patterns before general escaping applies:

1. Check if value matches sentinel pattern: `/^\|(SKIP|ABORT)\|(\s*\(.*\))?$/`
2. If sentinel, serialize as-is (no escaping)
3. If not sentinel, apply cell escaping rules

**Examples:**

| Original Value | Serialized Cell | Notes |
|----------------|-----------------|-------|
| `Hello` | `Hello` | No escaping needed |
| `A\|B` | `A\\|B` | Pipe escaped |
| `Path: C:\\\|files` | `Path: C:\\\\|files` | Backslash-pipe preserved |
| `\|SKIP\|` | `\|SKIP\|` | Sentinel - no escaping |
| `\|SKIP\| (reason)` | `\|SKIP\| (reason)` | Sentinel with reason |
| `Not \|SKIP\| sentinel` | `Not \\|SKIP\\| sentinel` | Not a sentinel pattern |

### Reusable Components

1. **`parseSentinelValue()` from `parseSentinels.ts`:**
   - Reuse for cell sentinel detection
   - Already handles `|SKIP|`, `|ABORT|`, parenthetical reasons

2. **URL validation from `validate.ts`:**
   - Reuse for `url` column type validation

3. **Date/year validation:**
   - Reuse existing patterns from `date-field` and `year-field`

4. **Field registry pattern from `fieldRegistry.ts`:**
   - Add `table` to `FIELD_KINDS`
   - Add `FieldTypeMap['table']` entry

## Stage 3: Refine Architecture

### Code Reuse Analysis

| Component | Existing Code | Reuse Strategy |
|-----------|--------------|----------------|
| Sentinel parsing | `parseSentinels.ts` | Direct import of `parseSentinelValue()` |
| URL validation | `validate.ts` | Import existing URL regex/validator |
| Date validation | `validate.ts` | Import ISO date pattern |
| Field registry | `fieldRegistry.ts` | Add new entry following existing pattern |
| Zod schemas | `coreTypes.ts` | Follow existing schema patterns |

### Markdown Table Parsing

Need to add markdown table parsing. Options:

1. **Simple regex-based parser** — Split on `|`, handle escaping
2. **Use existing markdown library** — marked, remark, etc.

**Recommendation:** Simple regex parser. Markdown table syntax is simple and we need
tight control over validation. No external dependency needed.

```typescript
function parseMarkdownTable(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.trim().split('\n').filter(line => line.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  
  const parseRow = (line: string): string[] => {
    // Remove leading/trailing pipes, split on unescaped |, trim cells
    return line.replace(/^\||\|$/g, '')
               .split(/(?<!\\)\|/)
               .map(cell => cell.trim().replace(/\\\|/g, '|'));
  };
  
  const headers = parseRow(lines[0]);
  // Skip separator row (lines[1])
  const rows = lines.slice(2).map(parseRow);
  
  return { headers, rows };
}
```

### Integration Points

1. **Parser (`parse.ts`):** Add `table-field` tag handling
2. **Serializer (`serialize.ts`):** Add table serialization
3. **Validator (`validate.ts`):** Add table-specific validation
4. **Apply (`apply.ts`):** Add `set_table` patch handling
5. **Summaries (`summaries.ts`):** Include table in field counts
6. **Export (`exportHelpers.ts`):** Export table values

## Stage 4: Implementation

### Phase 1: Type Definitions and Registry

- [ ] Add `ColumnType` type to `coreTypes.ts`
- [ ] Add `TableColumn` interface to `coreTypes.ts`
- [ ] Add `TableField` interface extending `FieldBase`
- [ ] Add `CellValue`, `CellResponse`, `TableRowResponse` types
- [ ] Add `TableValue` interface
- [ ] Add `SetTablePatch` interface
- [ ] Add `'table'` to `FieldKind` union
- [ ] Add Zod schemas for all new types
- [ ] Add `table` to `FIELD_KINDS` in `fieldRegistry.ts`
- [ ] Add `FieldTypeMap['table']` entry
- [ ] Update `Patch` union to include `SetTablePatch`
- [ ] Add `createEmptyValue` case for `'table'`

### Phase 2: Markdown Table Parser

- [ ] Create `parseMarkdownTable()` function
- [ ] Handle pipe escaping (`\|` → `|`)
- [ ] Handle empty cells
- [ ] Handle whitespace trimming
- [ ] Write unit tests for table parsing
- [ ] Test edge cases: empty table, single row, many columns

### Phase 3: Field Parsing

- [ ] Add `table-field` to Markdoc tag config
- [ ] Extract `columnTypes` attribute
- [ ] Validate columnTypes is array of valid type names
- [ ] Parse header row, validate as identifiers
- [ ] Validate header count matches columnTypes length
- [ ] Build `TableColumn[]` from headers + types
- [ ] Parse data rows with sentinel detection
- [ ] Coerce cell values to column types
- [ ] Build `TableValue` from parsed rows
- [ ] Add parse error codes for table validation
- [ ] Write parser tests for valid tables
- [ ] Write parser tests for invalid headers
- [ ] Write parser tests for column type mismatches
- [ ] Write parser tests for cell type errors
- [ ] Write parser tests for sentinel values in cells

### Phase 4: Serialization

- [ ] Add table serialization to `serialize.ts`
- [ ] Implement `escapeTableCell()` function with pipe escaping
- [ ] Implement `unescapeTableCell()` function for parsing
- [ ] Reject newlines and control characters in cell values
- [ ] Handle sentinel value detection (no escaping for `|SKIP|`, `|ABORT|`)
- [ ] Generate canonical markdown table format
- [ ] Handle empty tables (header only)
- [ ] Attribute ordering (alphabetical)
- [ ] Write round-trip tests (parse → serialize → parse)
- [ ] Write escaping tests (pipes, backslash-pipes, sentinels)

### Phase 5: Validation

- [ ] Add table validation to `validate.ts`
- [ ] Validate minRows/maxRows constraints
- [ ] Validate cell values against column types
- [ ] Validate no empty cells (must use sentinel)
- [ ] Add validation error codes to taxonomy
- [ ] Write validation tests for row constraints
- [ ] Write validation tests for cell type errors

### Phase 6: Patch Application

- [ ] Add `set_table` case to `apply.ts`
- [ ] Validate row structure matches schema
- [ ] Validate cell values against column types
- [ ] Handle sentinel strings in patch values
- [ ] Write patch application tests

### Phase 7: Export and Summaries

- [ ] Add table to `ExportedField` handling
- [ ] Export table values as array of row objects
- [ ] Update `StructureSummary` to count table columns
- [ ] Update `ProgressSummary` for table fields
- [ ] Write export tests

### Phase 8: Documentation

- [ ] Update SPEC.md Layer 1: Add `table-field` tag documentation
- [ ] Update SPEC.md Layer 2: Add table types to Field Type Reference
- [ ] Update SPEC.md Layer 3: Add table validation rules
- [ ] Update SPEC.md Layer 4: Add `set_table` patch
- [ ] Update DOCS.md with table-field usage
- [ ] Add table-field example to an example form
- [ ] Update README if appropriate

## Stage 5: Validation

### Automated Test Coverage

**Parser tests:**
- [ ] Valid table parses correctly
- [ ] Invalid header (spaces) produces clear error
- [ ] Invalid header (uppercase) produces clear error
- [ ] Duplicate header produces clear error
- [ ] columnTypes length mismatch produces clear error
- [ ] Invalid column type produces clear error
- [ ] Empty cell produces clear error
- [ ] `|SKIP|` in cell parses as skipped
- [ ] `|SKIP| (reason)` extracts reason
- [ ] `|ABORT|` in cell parses as aborted
- [ ] Non-numeric value in number column produces clear error
- [ ] Invalid URL in url column produces clear error
- [ ] Invalid date format produces clear error

**Validation tests:**
- [ ] Table with fewer than minRows fails
- [ ] Table with more than maxRows fails
- [ ] required=true with 0 rows fails

**Serialization tests:**
- [ ] Round-trip preserves structure
- [ ] Sentinel values serialize correctly
- [ ] Empty table serializes as header only
- [ ] Pipe in cell value escapes to `\|`
- [ ] Backslash-pipe in cell value escapes to `\\|`
- [ ] Cell with newline is rejected
- [ ] Cell with control characters is rejected
- [ ] Sentinel pattern not escaped (recognized as sentinel)
- [ ] Non-sentinel with pipe chars inside is properly escaped

**Patch tests:**
- [ ] set_table applies correctly
- [ ] Invalid row structure rejected
- [ ] Invalid cell type rejected

### Manual Testing Checklist

- [ ] Create form with table-field
- [ ] Run `markform inspect` and verify table appears in summary
- [ ] Run `markform fill --mock` with table in mock source
- [ ] Run `markform export --format=json` and verify table values
- [ ] Test error messages are clear for common mistakes:
  - [ ] Header with spaces
  - [ ] Wrong number of columnTypes
  - [ ] Type mismatch in cell
  - [ ] Empty cell without sentinel

## Appendix: Example Syntax

### Valid Table Field

```md
{% table-field id="notable_films" label="Notable Filmography" role="agent" required=true
   minRows=5 maxRows=15 columnTypes=["year", "string", "string", "number", "number", "string"] %}
| release_year | title | role | rt_score | box_office_m | notes |
|--------------|-------|------|----------|--------------|-------|
| 2023 | Barbie | Barbie | 88 | 1441.8 | Highest-grossing film of 2023 |
| 2019 | Once Upon a Time in Hollywood | Sharon Tate | 85 | 374.3 | Oscar-nominated ensemble |
| 2017 | I, Tonya | Tonya Harding | 90 | 53.9 | |SKIP| (Box office not tracked) |
{% /table-field %}
```

### Empty Table (Template)

```md
{% table-field id="awards" label="Awards" columnTypes=["year", "string", "string", "string"] %}
| award_year | award_name | category | result |
|------------|------------|----------|--------|
{% /table-field %}
```

### Invalid Examples (Parse Errors)

```md
<!-- ERROR: Header "First Name" is not valid identifier -->
{% table-field id="people" columnTypes=["string", "string"] %}
| First Name | last_name |
|------------|-----------|
{% /table-field %}

<!-- ERROR: columnTypes has 2 entries but table has 3 columns -->
{% table-field id="people" columnTypes=["string", "string"] %}
| name | title | department |
|------|-------|------------|
{% /table-field %}

<!-- ERROR: Column type "text" is not valid -->
{% table-field id="notes" columnTypes=["text", "string"] %}
| content | author |
|---------|--------|
{% /table-field %}
```

### Cell Validation Errors

```md
{% table-field id="films" columnTypes=["year", "string", "number"] %}
| release_year | title | rt_score |
|--------------|-------|----------|
| 2023 | Barbie | not-a-number |
{% /table-field %}
<!-- ERROR: Cell "not-a-number" at row 1, column "rt_score" is not a valid number. -->

{% table-field id="films" columnTypes=["year", "string", "number"] %}
| release_year | title | rt_score |
|--------------|-------|----------|
| 2023 | Barbie | |
{% /table-field %}
<!-- ERROR: Cell at row 1, column "rt_score" is empty. Provide a value or use |SKIP|. -->
```

## Appendix: Type Taxonomy Reference

For reference, the complete type taxonomy after this feature:

| Category | Types | Can Be Table Column? |
|----------|-------|---------------------|
| Simple | `string`, `number`, `url`, `date`, `year` | Yes |
| Multiline | `text` (string+multiline), `string_list`, `url_list` | No (v1) |
| Structured | `checkboxes`, `single_select`, `multi_select` | No |
| Composite | `table` | N/A (is the table) |

