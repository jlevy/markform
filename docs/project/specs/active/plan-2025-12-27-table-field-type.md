# Plan Spec: Table Field Type

## Purpose

Add a new `table-field` type to Markform for structured tabular data with typed columns.
This enables forms to collect structured data like filmographies, team rosters, award
histories, and other naturally tabular information that is currently awkwardly
represented as string-lists with pipe-delimited formats.

## Background

Currently, forms that need tabular data use workarounds:

1. **Pipe-delimited string-lists** — e.g., `"Oscar | Best Picture | 1995"` in
   instructions with format guidance.
   This is error-prone and requires LLMs to parse/generate correctly.

2. **Multiple related fields** — Separate `string-list` fields for each “column” that
   must be kept in sync.
   This is fragile and hard to validate.

3. **Markdown tables in string fields** — Free-form markdown that can’t be validated or
   typed.

A native `table-field` provides:

- Typed columns with per-column validation

- Standard markdown table syntax (familiar to LLMs and humans)

- Column structure defined via attributes (consistent with other field types)

- Sentinel value support (`%SKIP%`, `%ABORT%`) matching other field types

Reference: `SPEC.md` Layer 2 (Form Data Model) for field type definitions.

## Summary of Task

Add a new field type `table-field` (kind: `'table'`) that:

1. Uses markdown table syntax for values

2. Has columns specified via attribute arrays:

   - `columnIds` (required) — array of snake_case identifiers

   - `columnLabels` (optional) — array of display labels, defaults to `columnIds`

   - `columnTypes` (optional) — array of column types, defaults to all `"string"`

3. Markdown table headers are for display only (not parsed for column structure)

4. Supports row count constraints via `minRows`/`maxRows`

5. Validates cell values against column types

6. Supports sentinel values (`%SKIP%`, `%ABORT%`) in cells

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
| --- | --- | --- |
| `string` | Single-line text | `"John Smith"` |
| `number` | Float or integer | `42.5` |
| `url` | Validated URL | `"https://example.com"` |
| `date` | ISO 8601 date (YYYY-MM-DD) | `"2024-01-15"` |
| `year` | Integer year | `2024` |

**Multiline Types** — Require multiple lines, standalone fields only:

| Type | Description |
| --- | --- |
| `text` | Multi-line text (string with multiline=true) |
| `string_list` | Array of strings, one per line |
| `url_list` | Array of URLs, one per line |

**Structured Types** — Have predefined options, don’t fit in tables:

| Type | Description |
| --- | --- |
| `checkboxes` | Stateful checklist with modes |
| `single_select` | Choose one from enumerated options |
| `multi_select` | Choose multiple from enumerated options |

**Composite Types** — Contain other types:

| Type | Description |
| --- | --- |
| `table` | Rows of typed columns (NEW) |

### Feature Requirements

**Must Have:**

1. **Syntax (clean template):**

   Labels are back-filled from markdown headers — no duplication needed:

   ```md
   {% table-field id="key_people" label="Key People" role="agent" required=true
      minRows=1 maxRows=10
      columnIds=["name", "title", "linkedin_url", "background"]
      columnTypes=["string", "string", "url", "string"] %}
   | Name | Title | LinkedIn URL | Background |
   |------|-------|--------------|------------|
   {% /table-field %}
   ```

   After filling and serialize, `columnLabels` is written explicitly:

   ```md
   {% table-field id="key_people" label="Key People" role="agent" required=true
      minRows=1 maxRows=10
      columnIds=["name", "title", "linkedin_url", "background"]
      columnLabels=["Name", "Title", "LinkedIn URL", "Background"]
      columnTypes=["string", "string", "url", "string"] %}
   | Name | Title | LinkedIn URL | Background |
   |------|-------|--------------|------------|
   | John Smith | CEO | https://linkedin.com/in/jsmith | 20 years in tech |
   {% /table-field %}
   ```

2. **Column attributes:**

| Attribute | Required | Default | Description |
| --- | --- | --- | --- |
| `columnIds` | Yes | — | Array of snake_case identifiers for each column |
| `columnLabels` | No | See below | Array of display labels for headers |
| `columnTypes` | No | All `"string"` | Array of column types |

**Label defaulting behavior:**

- If `columnLabels` is specified, it is authoritative (markdown headers ignored)

- If `columnLabels` is omitted AND field is unanswered (no data rows), labels are
  back-filled from markdown table headers

- If `columnLabels` is omitted AND field has data rows, labels default to `columnIds`

- On serialize, `columnLabels` is always written explicitly (preserves extracted labels)

3. **Column types:** Support simple types only: `string`, `number`, `url`, `date`,
   `year`

4. **Attribute validation:**

   - `columnIds` is always required

   - Each ID must be valid identifier (regex: `^[a-z][a-z0-9_]*$`)

   - IDs must be unique within the table

   - If `columnLabels` specified, length must equal `columnIds.length`

   - If `columnTypes` specified, length must equal `columnIds.length`

   - If back-filling labels from headers, header count must equal `columnIds.length`
     (validation error if mismatch)

5. **Markdown table headers:**

   - When `columnLabels` specified: headers are for display only (not parsed)

   - When `columnLabels` omitted and unanswered: headers are extracted as labels

   - Cell values are matched positionally to `columnIds`

6. **Cell validation:**

   - Each cell validated against its column’s type

   - Empty cells are invalid (must use `%SKIP%` or `%ABORT%` to skip)

   - Clear error messages for type mismatches

7. **Sentinel values in cells:**

   Standard sentinel syntax works in table cells:

   - `%SKIP%` — cell explicitly skipped

   - `%SKIP% (reason)` — skipped with parenthetical reason

   - `%ABORT%` — cell could not be completed

   - `%ABORT% (reason)` — aborted with reason

   The `%` delimiters don’t conflict with markdown table `|` delimiters.

8. **Row constraints:**

   - `minRows` — minimum row count (default: 0)

   - `maxRows` — maximum row count (default: unlimited)

   - `required=true` implies `minRows >= 1`

9. **Patch operation:**
   ```json
   {
     "op": "set_table",
     "fieldId": "key_people",
     "rows": [
       {"name": "John", "title": "CEO", "linkedin_url": "https://...", "background": "..."}
     ]
   }
   ```

10. **Export format:**
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

**Not in Scope:**

1. Nested tables

2. Spanning cells (colspan/rowspan)

3. Rich formatting in cells

4. Structured types (checkboxes, selects) in cells

### Acceptance Criteria

1. **Parsing:** Form with table-field parses correctly, extracts columns and rows

2. **Column ID validation:** Invalid ID (e.g., “First Name”) produces clear parse error

3. **Array length mismatch:** Error if `columnLabels` or `columnTypes` length ≠
   `columnIds.length`

4. **Cell type validation:** Non-numeric value in number column produces clear error

5. **Sentinel parsing:** `%SKIP% (reason)` in cell parses correctly

6. **Row constraints:** minRows/maxRows validated correctly

7. **Serialization:** Round-trip preserves table structure and values

8. **Patch:** set_table patch applies correctly

9. **Export:** Table values export as array of row objects

### Open Questions

1. **Empty table syntax:** How to represent a table with no data rows?
   **Resolution:** Header + separator row only:
   ```md
   | Name | Title |
   |------|-------|
   ```

2. **Pipe in cell content:** How to escape `|` in cell values?
   **Resolution:** Use `\|` for literal pipe.
   Sentinel syntax (`%SKIP%`, `%ABORT%`) uses `%` delimiters which don’t conflict with
   table pipes.

3. **Whitespace handling:** How to handle leading/trailing whitespace in cells?
   **Resolution:** Trim whitespace from cell values (standard markdown table behavior).

4. **Row validation completeness:** Must every cell in a row have a value?
   **Resolution:** Yes.
   Empty cells are invalid.
   Use `%SKIP%` to explicitly skip.

5. **Why not infer column IDs from headers?** **Resolution:** Headers are for display
   only. Column structure comes entirely from attributes for consistency with other field
   types and to allow friendly labels (with spaces, etc.)
   that can’t be IDs.

6. **Why back-fill labels from headers when unanswered?** **Resolution:** Makes
   templates prettier and easier to read.
   Authors write natural markdown tables with friendly headers — no need to duplicate
   them in `columnLabels`. On first serialize, the extracted labels are written to the
   attribute, making subsequent parses authoritative.
   If the table has data rows, we assume it was previously serialized with labels.

## Stage 2: Architecture Stage

### Type Definitions

**New types in `coreTypes.ts`:**

```typescript
/** Column type for table cells - simple types only */
export type ColumnType = 'string' | 'number' | 'url' | 'date' | 'year';

/** Column definition - derived from columnIds, columnLabels, columnTypes attributes */
export interface TableColumn {
  id: Id;           // from columnIds array
  label: string;    // from columnLabels array (defaults to id)
  type: ColumnType; // from columnTypes array (defaults to 'string')
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

1. Extract `columnIds`, `columnLabels`, `columnTypes` from tag attributes

2. Validate `columnIds` is present and all IDs are valid identifiers

3. If `columnLabels` present, validate length matches `columnIds.length`

4. If `columnTypes` present, validate length matches `columnIds.length`

5. Parse markdown table from tag body:

   - Extract header row (row 1)

   - Skip separator row (row 2 with `|---|---|`)

   - Parse data rows (row 3+)

6. Determine labels:

   - If `columnLabels` attribute present → use those

   - Else if no data rows (unanswered) → extract from markdown headers

     - Validate header count equals `columnIds.length`

   - Else (has data rows but no `columnLabels`) → default to `columnIds`

7. Build `columns: TableColumn[]` by combining:

   - `id` from `columnIds[i]`

   - `label` from step 6

   - `type` from `columnTypes[i]` (or `'string'` if not specified)

8. Parse each data row:

   - For each cell, check for sentinel pattern first

   - If sentinel, extract state and reason using existing `parseSentinelValue()`

   - If not sentinel, coerce value to column type

   - Build `TableRowResponse` for each row

### Validation Rules

**Parse-time validation (structural):**

| Rule | Error Code | Example Error Message |
| --- | --- | --- |
| columnIds must be present | `MISSING_COLUMN_IDS` | `table-field 'people' missing required 'columnIds' attribute.` |
| Column ID must be valid | `INVALID_COLUMN_ID` | `Column ID "First Name" is not a valid identifier. Use snake_case like "first_name".` |
| Column IDs must be unique | `DUPLICATE_COLUMN_ID` | `Duplicate column ID "name" at position 3.` |
| columnLabels length must match | `COLUMN_LABELS_MISMATCH` | `columnLabels has 3 entries but columnIds has 4.` |
| columnTypes length must match | `COLUMN_TYPES_MISMATCH` | `columnTypes has 3 entries but columnIds has 4.` |
| columnTypes values must be valid | `INVALID_COLUMN_TYPE` | `Column type "text" is not valid. Use: string, number, url, date, year.` |
| Header count must match when back-filling | `HEADER_COUNT_MISMATCH` | `Table has 3 headers but columnIds has 4. Add columnLabels attribute or fix headers.` |

**Value validation (semantic):**

| Rule | Error Code | Example Error Message |
| --- | --- | --- |
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
{% table-field id="key_people" label="Key People" columnIds=["name", "title", "linkedin_url", "background"]
   columnLabels=["Name", "Title", "LinkedIn URL", "Background"]
   columnTypes=["string", "string", "url", "string"] minRows=1 %}
| Name | Title | LinkedIn URL | Background |
|------|-------|--------------|------------|
| John Smith | CEO | https://linkedin.com/in/jsmith | 20 years in tech |
| Jane Doe | CTO | %SKIP% (No public profile) | Former Google engineer |
{% /table-field %}
```

**Formatting rules:**

- Attributes:

  - `columnIds` always serialized

  - `columnLabels` always serialized (ensures back-filled labels are preserved)

  - `columnTypes` only if not all strings

- Header row uses labels from `columnLabels`

- No padding in cells (canonical)

- Separator row uses minimum dashes (`|---|`)

- Sentinel values (`%SKIP%`, `%ABORT%`) serialized as-is with optional reason

- Empty table = header + separator only

#### Cell Value Escaping (Robust Serialization)

When serializing cell values to markdown table syntax, proper escaping is required to
ensure round-trip fidelity.
The following escaping rules apply:

**Escape sequences (serialize → parse):**

| Character | Escaped Form | Notes |
| --- | --- | --- |
| `\|` (pipe) | `\\|` | Required - pipe is the cell delimiter |
| `\\` before `\|` | `\\\\|` | Preserve literal backslash-pipe sequence |

**Rejected characters (invalid in cells):**

| Character | Reason | Error Message |
| --- | --- | --- |
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

Standard sentinel syntax with `%` delimiters:

- Pattern: `/^%(SKIP|ABORT)%(\s*\(.*\))?$/`

- Recognized forms: `%SKIP%`, `%SKIP% (reason)`, `%ABORT%`, `%ABORT% (reason)`

Sentinel values don’t require escaping (no pipe characters).

**Parsing flow:**

1. Split row on unescaped `|` (using `(?<!\\)\|`)

2. Trim each cell

3. Check if cell matches sentinel pattern

4. If sentinel, extract state and reason

5. If not sentinel, unescape `\|` → `|` and validate against column type

**Serialization flow:**

1. Check if CellResponse has `state: 'skipped'` or `state: 'aborted'`

2. If so, serialize as `%SKIP%` or `%ABORT%` (with reason if present)

3. If answered, escape any `|` in value as `\|`

**Examples:**

| Original Value | Serialized Cell | Notes |
| --- | --- | --- |
| `Hello` | `Hello` | No escaping needed |
| `A\|B` | `A\\|B` | Pipe escaped |
| `%SKIP%` | `%SKIP%` | Sentinel (skipped cell) |
| `%SKIP% (No data)` | `%SKIP% (No data)` | Sentinel with reason |
| `%ABORT%` | `%ABORT%` | Sentinel (aborted cell) |
| `Use %SKIP% here` | `Use %SKIP% here` | NOT a sentinel (not at start) |

### Reusable Components

1. **Sentinel parsing:**

   - Reuse `parseSentinelValue()` from `parseSentinels.ts`

   - Pattern: `/^%(SKIP|ABORT)%(\s*\(.*\))?$/`

   - Same syntax works in all field types including table cells

2. **URL validation from `validate.ts`:**

   - Reuse for `url` column type validation

3. **Date/year validation:**

   - Reuse existing patterns from `date-field` and `year-field`

4. **Field registry pattern from `fieldRegistry.ts`:**

   - Add `table` to `FIELD_KINDS`

   - Add `FieldTypeMap['table']` entry

### Scope Reference Parsing and Validation

Tables introduce nested references (field → column → cell).
This requires a standalone, reusable scope parsing module that can be shared across
validation, error reporting, and doc block resolution.

#### Reference Type Hierarchy

```
IssueRef = Id | QualifiedOptionRef | QualifiedColumnRef | QualifiedCellRef

Where:
  Id                  = /^[a-z][a-z0-9_]*$/           → "company_name"
  QualifiedOptionRef  = {fieldId}.{optionId}          → "rating.bullish"
  QualifiedColumnRef  = {fieldId}.{columnId}          → "key_people.name"
  QualifiedCellRef    = {fieldId}.{columnId}[{row}]   → "key_people.name[0]"
```

Note: `QualifiedOptionRef` and `QualifiedColumnRef` have identical syntax.
Disambiguation requires schema context (lookup in `optionsById` vs `columnsById`).

#### Scope Enum Extension

```typescript
// Existing scopes
type IssueScope = 'form' | 'group' | 'field' | 'option';

// Extended for tables
type IssueScope = 'form' | 'group' | 'field' | 'option' | 'column' | 'cell';
```

#### Type Definitions (in `scopeRef.ts`)

```typescript
/** Parsed scope reference - discriminated union */
export type ParsedScopeRef =
  | { type: 'field'; fieldId: Id }
  | { type: 'option'; fieldId: Id; optionId: Id }
  | { type: 'column'; fieldId: Id; columnId: Id }
  | { type: 'cell'; fieldId: Id; columnId: Id; rowIndex: number };

/** Result of parsing a scope ref string */
export interface ParseScopeRefResult {
  ok: boolean;
  ref?: ParsedScopeRef;
  error?: string;
}

/** Result of validating a parsed scope ref against schema */
export interface ValidateScopeRefResult {
  ok: boolean;
  scope?: IssueScope;
  error?: string;
}
```

#### Parsing Implementation (in `scopeRef.ts`)

```typescript
const PATTERNS = {
  // field.column[row] - must check first (most specific)
  cell: /^([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\[(\d+)\]$/,
  // field.qualifier - could be option or column (disambiguate later)
  qualified: /^([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)$/,
  // simple field id
  field: /^[a-z][a-z0-9_]*$/,
};

/**
 * Parse a scope reference string into structured form.
 * This is pure parsing - no schema validation.
 */
export function parseScopeRef(ref: string): ParseScopeRefResult {
  // Try cell pattern first (most specific)
  const cellMatch = PATTERNS.cell.exec(ref);
  if (cellMatch) {
    const [, fieldId, columnId, rowStr] = cellMatch;
    const rowIndex = parseInt(rowStr, 10);
    if (rowIndex < 0 || !Number.isFinite(rowIndex)) {
      return { ok: false, error: `Invalid row index: ${rowStr}` };
    }
    return { ok: true, ref: { type: 'cell', fieldId, columnId, rowIndex } };
  }

  // Try qualified pattern (option or column - can't tell yet)
  const qualifiedMatch = PATTERNS.qualified.exec(ref);
  if (qualifiedMatch) {
    const [, fieldId, qualifierId] = qualifiedMatch;
    // Return as 'option' by default; caller uses schema to disambiguate
    return { ok: true, ref: { type: 'option', fieldId, optionId: qualifierId } };
  }

  // Try simple field pattern
  if (PATTERNS.field.test(ref)) {
    return { ok: true, ref: { type: 'field', fieldId: ref } };
  }

  return { ok: false, error: `Invalid scope reference format: "${ref}"` };
}

/**
 * Serialize a parsed scope ref back to string form.
 */
export function serializeScopeRef(ref: ParsedScopeRef): string {
  switch (ref.type) {
    case 'field':
      return ref.fieldId;
    case 'option':
      return `${ref.fieldId}.${ref.optionId}`;
    case 'column':
      return `${ref.fieldId}.${ref.columnId}`;
    case 'cell':
      return `${ref.fieldId}.${ref.columnId}[${ref.rowIndex}]`;
  }
}
```

#### Schema Validation (in `scopeRefValidation.ts`)

```typescript
import type { FormSchema, StructureSummary } from './coreTypes.js';
import type { ParsedScopeRef, ValidateScopeRefResult } from './scopeRef.js';

/**
 * Validate a parsed scope ref against the form schema.
 * Checks that referenced elements exist and are valid for their type.
 */
export function validateScopeRef(
  ref: ParsedScopeRef,
  schema: FormSchema,
  summary: StructureSummary,
  rowCounts?: Record<Id, number>,  // for cell bounds checking
): ValidateScopeRefResult {
  const { fieldsById, optionsById } = summary;

  // Check field exists
  const fieldKind = fieldsById[ref.fieldId];
  if (!fieldKind) {
    return { ok: false, error: `Unknown field: "${ref.fieldId}"` };
  }

  switch (ref.type) {
    case 'field':
      return { ok: true, scope: 'field' };

    case 'option': {
      // Check if it's an option (select/checkbox field)
      const qualifiedRef = `${ref.fieldId}.${ref.optionId}`;
      if (optionsById[qualifiedRef]) {
        return { ok: true, scope: 'option' };
      }
      // Maybe it's a column? Check if field is a table
      if (fieldKind === 'table') {
        // Re-interpret as column ref
        return validateColumnRef(ref.fieldId, ref.optionId, schema);
      }
      return { ok: false, error: `Unknown option: "${qualifiedRef}"` };
    }

    case 'column': {
      if (fieldKind !== 'table') {
        return {
          ok: false,
          error: `Column ref "${ref.fieldId}.${ref.columnId}" invalid: ` +
                 `field "${ref.fieldId}" is ${fieldKind}, not table`,
        };
      }
      return validateColumnRef(ref.fieldId, ref.columnId, schema);
    }

    case 'cell': {
      if (fieldKind !== 'table') {
        return {
          ok: false,
          error: `Cell ref "${serializeScopeRef(ref)}" invalid: ` +
                 `field "${ref.fieldId}" is ${fieldKind}, not table`,
        };
      }
      // Validate column exists
      const colResult = validateColumnRef(ref.fieldId, ref.columnId, schema);
      if (!colResult.ok) return colResult;

      // Validate row index bounds (if row counts provided)
      if (rowCounts) {
        const rowCount = rowCounts[ref.fieldId] ?? 0;
        if (ref.rowIndex >= rowCount) {
          return {
            ok: false,
            error: `Cell ref "${serializeScopeRef(ref)}" invalid: ` +
                   `row index ${ref.rowIndex} out of bounds (table has ${rowCount} rows)`,
          };
        }
      }
      return { ok: true, scope: 'cell' };
    }
  }
}

function validateColumnRef(
  fieldId: Id,
  columnId: Id,
  schema: FormSchema,
): ValidateScopeRefResult {
  // Find the table field and check column exists
  for (const group of schema.groups) {
    for (const field of group.children) {
      if (field.id === fieldId && field.kind === 'table') {
        const column = field.columns.find(c => c.id === columnId);
        if (!column) {
          const validColumns = field.columns.map(c => c.id).join(', ');
          return {
            ok: false,
            error: `Unknown column "${columnId}" in table "${fieldId}". ` +
                   `Valid columns: ${validColumns}`,
          };
        }
        return { ok: true, scope: 'column' };
      }
    }
  }
  return { ok: false, error: `Table field "${fieldId}" not found` };
}
```

#### File Organization

```
packages/markform/src/
├── engine/
│   ├── scopeRef.ts              # Standalone scope parsing (no deps)
│   ├── scopeRef.test.ts         # Unit tests for parsing
│   ├── scopeRefValidation.ts    # Schema-aware validation
│   ├── scopeRefValidation.test.ts
│   ├── table/                   # Table-specific modules
│   │   ├── parseTable.ts        # Markdown table parsing
│   │   ├── serializeTable.ts    # Table serialization with escaping
│   │   ├── validateTable.ts     # Table value validation
│   │   └── tableTypes.ts        # Table-specific type helpers
│   └── validate.ts              # Existing validation (imports scopeRefValidation)
```

#### Unit Test Coverage (scopeRef.test.ts)

```typescript
describe('parseScopeRef', () => {
  describe('field references', () => {
    it('parses simple field id', () => {
      expect(parseScopeRef('company_name')).toEqual({
        ok: true,
        ref: { type: 'field', fieldId: 'company_name' },
      });
    });

    it('rejects invalid characters', () => {
      expect(parseScopeRef('Company-Name').ok).toBe(false);
      expect(parseScopeRef('123_field').ok).toBe(false);
      expect(parseScopeRef('field name').ok).toBe(false);
    });
  });

  describe('qualified references (option/column)', () => {
    it('parses qualified ref', () => {
      expect(parseScopeRef('rating.bullish')).toEqual({
        ok: true,
        ref: { type: 'option', fieldId: 'rating', optionId: 'bullish' },
      });
    });

    it('parses multi-segment field id', () => {
      expect(parseScopeRef('docs_reviewed.ten_k')).toEqual({
        ok: true,
        ref: { type: 'option', fieldId: 'docs_reviewed', optionId: 'ten_k' },
      });
    });
  });

  describe('cell references', () => {
    it('parses cell ref with row index', () => {
      expect(parseScopeRef('key_people.name[0]')).toEqual({
        ok: true,
        ref: { type: 'cell', fieldId: 'key_people', columnId: 'name', rowIndex: 0 },
      });
    });

    it('parses large row index', () => {
      expect(parseScopeRef('films.title[999]')).toEqual({
        ok: true,
        ref: { type: 'cell', fieldId: 'films', columnId: 'title', rowIndex: 999 },
      });
    });

    it('rejects negative row index', () => {
      // Note: regex won't match negative, so this becomes invalid format
      expect(parseScopeRef('films.title[-1]').ok).toBe(false);
    });

    it('rejects non-numeric row index', () => {
      expect(parseScopeRef('films.title[abc]').ok).toBe(false);
    });
  });
});

describe('serializeScopeRef', () => {
  it('round-trips field ref', () => {
    const ref = { type: 'field' as const, fieldId: 'company' };
    expect(serializeScopeRef(ref)).toBe('company');
  });

  it('round-trips cell ref', () => {
    const ref = { type: 'cell' as const, fieldId: 'people', columnId: 'name', rowIndex: 5 };
    expect(serializeScopeRef(ref)).toBe('people.name[5]');
  });
});
```

#### Unit Test Coverage (scopeRefValidation.test.ts)

```typescript
describe('validateScopeRef', () => {
  const mockSchema: FormSchema = { /* ... with table field */ };
  const mockSummary: StructureSummary = { /* ... */ };

  describe('type compatibility', () => {
    it('rejects cell ref on non-table field', () => {
      const ref = { type: 'cell', fieldId: 'company_name', columnId: 'x', rowIndex: 0 };
      const result = validateScopeRef(ref, mockSchema, mockSummary);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('is string, not table');
    });

    it('rejects column ref on non-table field', () => {
      const ref = { type: 'column', fieldId: 'rating', columnId: 'score' };
      const result = validateScopeRef(ref, mockSchema, mockSummary);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('is single_select, not table');
    });
  });

  describe('column validation', () => {
    it('accepts valid column', () => {
      const ref = { type: 'column', fieldId: 'films', columnId: 'title' };
      const result = validateScopeRef(ref, mockSchema, mockSummary);
      expect(result.ok).toBe(true);
      expect(result.scope).toBe('column');
    });

    it('rejects unknown column', () => {
      const ref = { type: 'column', fieldId: 'films', columnId: 'nonexistent' };
      const result = validateScopeRef(ref, mockSchema, mockSummary);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unknown column');
      expect(result.error).toContain('Valid columns:');
    });
  });

  describe('row bounds validation', () => {
    it('accepts in-bounds row index', () => {
      const ref = { type: 'cell', fieldId: 'films', columnId: 'title', rowIndex: 2 };
      const result = validateScopeRef(ref, mockSchema, mockSummary, { films: 5 });
      expect(result.ok).toBe(true);
    });

    it('rejects out-of-bounds row index', () => {
      const ref = { type: 'cell', fieldId: 'films', columnId: 'title', rowIndex: 10 };
      const result = validateScopeRef(ref, mockSchema, mockSummary, { films: 5 });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('out of bounds');
      expect(result.error).toContain('has 5 rows');
    });

    it('skips bounds check when rowCounts not provided', () => {
      const ref = { type: 'cell', fieldId: 'films', columnId: 'title', rowIndex: 999 };
      const result = validateScopeRef(ref, mockSchema, mockSummary);
      expect(result.ok).toBe(true); // No bounds check without rowCounts
    });
  });

  describe('option/column disambiguation', () => {
    it('resolves qualified ref as option for select field', () => {
      const ref = { type: 'option', fieldId: 'rating', optionId: 'bullish' };
      const result = validateScopeRef(ref, mockSchema, mockSummary);
      expect(result.ok).toBe(true);
      expect(result.scope).toBe('option');
    });

    it('resolves qualified ref as column for table field', () => {
      const ref = { type: 'option', fieldId: 'films', optionId: 'title' };
      const result = validateScopeRef(ref, mockSchema, mockSummary);
      expect(result.ok).toBe(true);
      expect(result.scope).toBe('column');
    });
  });
});
```

## Stage 3: Refine Architecture

### Code Reuse Analysis

| Component | Existing Code | Reuse Strategy |
| --- | --- | --- |
| Sentinel parsing | `parseSentinels.ts` | Direct import of `parseSentinelValue()` |
| URL validation | `validate.ts` | Import existing URL regex/validator |
| Date validation | `validate.ts` | Import ISO date pattern |
| Field registry | `fieldRegistry.ts` | Add new entry following existing pattern |
| Zod schemas | `coreTypes.ts` | Follow existing schema patterns |

### Markdown Table Parsing

Need to add markdown table parsing.
Options:

1. **Simple regex-based parser** — Split on `|`, handle escaping

2. **Use existing markdown library** — marked, remark, etc.

**Recommendation:** Simple regex parser.
Markdown table syntax is simple and we need tight control over validation.
No external dependency needed.

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

### Phase 2: Scope Reference Parsing (Shared Module)

- [ ] Create `scopeRef.ts` with `ParsedScopeRef` types

- [ ] Implement `parseScopeRef()` with regex patterns for field/option/column/cell

- [ ] Implement `serializeScopeRef()` for round-trip

- [ ] Add `'column'` and `'cell'` to `IssueScope` enum in `coreTypes.ts`

- [ ] Write unit tests: valid field refs, qualified refs, cell refs

- [ ] Write unit tests: invalid formats, edge cases

- [ ] Create `scopeRefValidation.ts` with `validateScopeRef()`

- [ ] Implement field type checking (cell refs only valid for tables)

- [ ] Implement column existence validation

- [ ] Implement row bounds validation (when rowCounts provided)

- [ ] Implement option/column disambiguation logic

- [ ] Write unit tests for type compatibility errors

- [ ] Write unit tests for column validation errors

- [ ] Write unit tests for row bounds errors

- [ ] Write unit tests for option/column disambiguation

### Phase 3: Markdown Table Parser

- [ ] Create `table/parseTable.ts` with `parseMarkdownTable()` function

- [ ] Handle pipe escaping (`\|` → `|`)

- [ ] Handle empty cells

- [ ] Handle whitespace trimming

- [ ] Write unit tests for table parsing

- [ ] Test edge cases: empty table, single row, many columns

### Phase 4: Field Parsing

- [ ] Add `table-field` to Markdoc tag config

- [ ] Extract `columnIds`, `columnLabels`, `columnTypes` attributes

- [ ] Validate `columnIds` is present and all IDs are valid identifiers

- [ ] Validate `columnLabels` length matches `columnIds.length` if specified

- [ ] Validate `columnTypes` is array of valid type names if specified

- [ ] Validate `columnTypes` length matches `columnIds.length` if specified

- [ ] Build `TableColumn[]` from attributes (id, label, type)

- [ ] Parse markdown table body (skip headers, parse data rows)

- [ ] Parse data rows with sentinel detection

- [ ] Coerce cell values to column types

- [ ] Build `TableValue` from parsed rows

- [ ] Add parse error codes for table validation

- [ ] Write parser tests for valid tables

- [ ] Write parser tests for invalid column IDs

- [ ] Write parser tests for array length mismatches

- [ ] Write parser tests for cell type errors

- [ ] Write parser tests for sentinel values in cells

### Phase 5: Serialization

- [ ] Add table serialization to `table/serializeTable.ts`

- [ ] Serialize `columnIds` always

- [ ] Serialize `columnLabels` always (preserves back-filled labels)

- [ ] Serialize `columnTypes` only if not all strings

- [ ] Generate header row from `columnLabels`

- [ ] Implement `escapeTableCell()` function with pipe escaping

- [ ] Implement `unescapeTableCell()` function for parsing

- [ ] Reject newlines and control characters in cell values

- [ ] Handle sentinel value detection (`%SKIP%`, `%ABORT%`)

- [ ] Generate canonical markdown table format

- [ ] Handle empty tables (header only)

- [ ] Attribute ordering (alphabetical)

- [ ] Write round-trip tests (parse → serialize → parse)

- [ ] Write escaping tests (pipes, backslash-pipes, sentinels)

### Phase 6: Table Validation

- [ ] Create `table/validateTable.ts` for table-specific validation

- [ ] Validate minRows/maxRows constraints

- [ ] Validate cell values against column types

- [ ] Validate no empty cells (must use sentinel)

- [ ] Add validation error codes to taxonomy

- [ ] Use `scopeRefValidation.ts` for cell reference validation in errors

- [ ] Write validation tests for row constraints

- [ ] Write validation tests for cell type errors

### Phase 7: Patch Application

- [ ] Add `set_table` case to `apply.ts`

- [ ] Validate row structure matches schema

- [ ] Validate cell values against column types

- [ ] Handle sentinel strings in patch values

- [ ] Write patch application tests

### Phase 8: Export and Summaries

- [ ] Add table to `ExportedField` handling

- [ ] Export table values as array of row objects

- [ ] Update `StructureSummary` to count table columns (add `columnsById`)

- [ ] Update `ProgressSummary` for table fields

- [ ] Write export tests

### Phase 9: Documentation

**SPEC.md updates:**

- [ ] Layer 1 (Syntax): Add `table-field` tag to Field Tags table

- [ ] Layer 1 (Syntax): Document column attributes (`columnIds`, `columnLabels`,
  `columnTypes`) with defaults and label back-filling behavior

- [ ] Layer 1 (Syntax): Add table-field value encoding section (markdown table syntax)

- [ ] Layer 2 (Data Model): Add `TableField`, `TableColumn`, `TableValue` types

- [ ] Layer 2 (Data Model): Add `ColumnType` to type definitions

- [ ] Layer 2 (Data Model): Add scope reference types for columns and cells

- [ ] Layer 2 (Data Model): Update `FieldKind` to include `'table'`

- [ ] Layer 2 (Data Model): Update Field Type Reference table with table-field mapping

- [ ] Layer 3 (Validation): Add table-specific validation rules

- [ ] Layer 4 (Tool API): Add `set_table` to Patch Schema

**DOCS.md updates:**

- [ ] Add Table Field section with syntax and examples

- [ ] Document column attributes with defaults

- [ ] Explain label back-filling from headers (cleaner templates)

- [ ] Show examples: clean template syntax, typed columns, after-serialize form

- [ ] Document sentinel values in cells

**README.md updates:**

- [ ] Add `table-field` to field types list in Quick Start section

**Example form migrations (see Appendix for details):**

- [ ] Migrate `movie-research-basic.form.md` — 1 field (`notable_awards`)

- [ ] Migrate `movie-research-deep.form.md` — 2 fields (`lead_cast`, `notable_awards`)

- [ ] Migrate `celebrity-deep-research.form.md` — ~20 fields (major migration)

- [ ] Migrate `startup-deep-research.form.md` — ~8 fields

- [ ] Migrate `earnings-analysis.form.md` — 2 fields (`sources_accessed`,
  `experts_list`)

- [ ] Create simple table-field example in `examples/simple/`

## Stage 5: Validation

### Automated Test Coverage

**Scope ref parsing tests (scopeRef.test.ts):**

- [ ] Parses simple field id: `company_name`

- [ ] Parses qualified ref: `rating.bullish`

- [ ] Parses cell ref: `key_people.name[0]`

- [ ] Parses large row index: `films.title[999]`

- [ ] Rejects invalid characters in field id

- [ ] Rejects negative row index pattern

- [ ] Rejects non-numeric row index

- [ ] Round-trips all ref types through serialize/parse

**Scope ref validation tests (scopeRefValidation.test.ts):**

- [ ] Rejects cell ref on non-table field

- [ ] Rejects column ref on non-table field

- [ ] Accepts valid column ref on table field

- [ ] Rejects unknown column with helpful error

- [ ] Accepts in-bounds row index

- [ ] Rejects out-of-bounds row index with helpful error

- [ ] Skips bounds check when rowCounts not provided

- [ ] Disambiguates qualified ref as option for select field

- [ ] Disambiguates qualified ref as column for table field

**Table parser tests:**

- [ ] Valid table parses correctly

- [ ] Missing `columnIds` produces clear error

- [ ] Invalid column ID (spaces) produces clear error

- [ ] Invalid column ID (uppercase) produces clear error

- [ ] Duplicate column ID produces clear error

- [ ] `columnLabels` length mismatch produces clear error

- [ ] `columnTypes` length mismatch produces clear error

- [ ] Invalid column type produces clear error

- [ ] Empty cell produces clear error

- [ ] `%SKIP%` in cell parses as skipped

- [ ] `%SKIP% (reason)` extracts reason

- [ ] `%ABORT%` in cell parses as aborted

- [ ] Non-numeric value in number column produces clear error

- [ ] Invalid URL in url column produces clear error

- [ ] Invalid date format produces clear error

- [ ] Default types (all string) when `columnTypes` omitted

- [ ] Default labels (same as IDs) when `columnLabels` omitted and has data rows

- [ ] Labels back-filled from headers when `columnLabels` omitted and unanswered

- [ ] Header count mismatch error when back-filling labels

**Table validation tests:**

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
   minRows=5 maxRows=15
   columnIds=["release_year", "title", "role", "rt_score", "box_office_m", "notes"]
   columnLabels=["Year", "Title", "Role", "RT Score", "Box Office ($M)", "Notes"]
   columnTypes=["year", "string", "string", "number", "number", "string"] %}
| Year | Title | Role | RT Score | Box Office ($M) | Notes |
|------|-------|------|----------|-----------------|-------|
| 2023 | Barbie | Barbie | 88 | 1441.8 | Highest-grossing film of 2023 |
| 2019 | Once Upon a Time in Hollywood | Sharon Tate | 85 | 374.3 | Oscar-nominated ensemble |
| 2017 | I, Tonya | Tonya Harding | 90 | 53.9 | %SKIP% (Box office not tracked) |
{% /table-field %}
```

### All-String Table (Clean Template Syntax)

Labels are back-filled from headers — no need to duplicate in `columnLabels`:

```md
{% table-field id="team" label="Team Members" columnIds=["name", "title", "department"] %}
| Full Name | Job Title | Department |
|-----------|-----------|------------|
| John Smith | CEO | Executive |
| Jane Doe | CTO | Engineering |
{% /table-field %}
```

After serialize, becomes (labels preserved in attribute):

```md
{% table-field id="team" label="Team Members"
   columnIds=["name", "title", "department"]
   columnLabels=["Full Name", "Job Title", "Department"] %}
| Full Name | Job Title | Department |
|-----------|-----------|------------|
| John Smith | CEO | Executive |
| Jane Doe | CTO | Engineering |
{% /table-field %}
```

### Empty Table Template (Typed Columns)

Clean template with types — labels extracted from headers:

```md
{% table-field id="awards" label="Awards"
   columnIds=["award_year", "award_name", "category", "result"]
   columnTypes=["year", "string", "string", "string"] %}
| Year | Award | Category | Result |
|------|-------|----------|--------|
{% /table-field %}
```

### Invalid Examples (Parse Errors)

```md

<!-- ERROR: table-field 'people' missing required 'columnIds' attribute. -->

{% table-field id="people" %}
| First Name | Last Name |
|------------|-----------|
{% /table-field %}

<!-- ERROR: Column ID "First Name" is not a valid identifier. Use snake_case. -->

{% table-field id="people" columnIds=["First Name", "last_name"] %}
| First Name | Last Name |
|------------|-----------|
{% /table-field %}

<!-- ERROR: columnLabels has 2 entries but columnIds has 3. -->

{% table-field id="people" columnIds=["name", "title", "dept"] columnLabels=["Name", "Title"] %}
| Name | Title | Dept |
|------|-------|------|
{% /table-field %}

<!-- ERROR: Column type "text" is not valid. Use: string, number, url, date, year. -->

{% table-field id="notes" columnIds=["content", "author"] columnTypes=["text", "string"] %}
| Content | Author |
|---------|--------|
{% /table-field %}

<!-- ERROR: Table has 2 headers but columnIds has 3. Add columnLabels or fix headers. -->

{% table-field id="people" columnIds=["name", "title", "dept"] %}
| Name | Title |
|------|-------|
{% /table-field %}
```

### Cell Validation Errors

```md
{% table-field id="films" columnIds=["release_year", "title", "rt_score"]
   columnTypes=["year", "string", "number"] %}
| Year | Title | RT Score |
|------|-------|----------|
| 2023 | Barbie | not-a-number |
{% /table-field %}

<!-- ERROR: Cell "not-a-number" at row 1, column "rt_score" is not a valid number. -->

{% table-field id="films" columnIds=["release_year", "title", "rt_score"]
   columnTypes=["year", "string", "number"] %}
| Year | Title | RT Score |
|------|-------|----------|
| 2023 | Barbie | |
{% /table-field %}

<!-- ERROR: Cell at row 1, column "rt_score" is empty. Provide a value or use %SKIP%. -->
```

## Appendix: Type Taxonomy Reference

For reference, the complete type taxonomy after this feature:

| Category | Types | Can Be Table Column? |
| --- | --- | --- |
| Simple | `string`, `number`, `url`, `date`, `year` | Yes |
| Multiline | `text` (string+multiline), `string_list`, `url_list` | No (v1) |
| Structured | `checkboxes`, `single_select`, `multi_select` | No |
| Composite | `table` | N/A (is the table) |

## Appendix: Example Form Migrations

The following example forms currently use pipe-delimited `string-list` syntax that
should be migrated to `table-field`:

### movie-research-basic.form.md

| Current Field | Format | Migration |
| --- | --- | --- |
| `notable_awards` | `Award \| Category \| Year` | `table-field` with `columnIds=["award", "category", "year"]` |

### movie-research-deep.form.md

| Current Field | Format | Migration |
| --- | --- | --- |
| `lead_cast` | `Actor Name \| Character Name` | `table-field` with `columnIds=["actor_name", "character_name"]` |
| `notable_awards` | `Award \| Category \| Year` | `table-field` with `columnIds=["award", "category", "year"]` |

### celebrity-deep-research.form.md

**Biographical fields:**

| Current Field | Format | Migration |
| --- | --- | --- |
| `death_info` | `YYYY-MM-DD \| Location \| Cause \| Age` | Single-row table or keep as string (structured but single value) |
| `causes_activism` | `Cause \| Role \| Source` | `table-field` with `columnIds=["cause", "role_involvement", "source"]` |
| `education` | `Institution \| Degree \| Years \| Notes` | `table-field` with `columnIds=["institution", "degree_program", "years", "notes"]` |

**Family/relationships fields:**

| Current Field | Format | Migration |
| --- | --- | --- |
| `siblings` | `Name \| Relationship \| Notable info` | `table-field` with `columnIds=["name", "relationship", "notable_info"]` |
| `marriages` | `Spouse \| Wedding \| Divorce \| Duration \| Source` | `table-field` with `columnIds=["spouse", "wedding_date", "divorce_date", "duration", "source"]` |
| `children` | `Name \| Birth Year \| Other Parent \| Notes` | `table-field` with `columnIds=["name", "birth_year", "other_parent", "notes"]`, `columnTypes=["string", "year", "string", "string"]` |
| `notable_relationships` | `Partner \| Dates \| Reliability` | `table-field` with `columnIds=["partner", "dates", "reliability"]` |

**Career fields (already markdown tables — validate/enhance):**

| Current Field | Notes |
| --- | --- |
| `notable_films_table` | Already markdown table in instructions; convert to proper `table-field` |
| `notable_tv_table` | Already markdown table in instructions; convert to proper `table-field` |
| `oscar_history` | Already markdown table in instructions; convert to proper `table-field` |
| `other_major_awards` | Already markdown table in instructions; convert to proper `table-field` |

**Career statistics fields:**

| Current Field | Format | Migration |
| --- | --- | --- |
| `box_office_stats` | `Total \| # Films \| Average \| Highest \| Source` | Keep as string (summary, not list) |
| `rt_career_stats` | `Avg \| # Fresh \| # Rotten \| Notable` | Keep as string (summary, not list) |
| `major_awards_summary` | `# Oscar \| # Emmy \| # Grammy \| # GG \| Other` | Keep as string (summary, not list) |

**Financial/business fields:**

| Current Field | Format | Migration |
| --- | --- | --- |
| `known_salaries` | `Project \| Amount \| Year \| Source` | `table-field` with `columnIds=["project", "amount", "year", "source"]` |
| `business_ventures` | `Company \| Role \| Industry \| Status \| Source` | `table-field` with `columnIds=["company", "role", "industry", "status", "source"]` |
| `endorsements` | `Brand \| Type \| Value \| Years \| Source` | `table-field` with `columnIds=["brand", "deal_type", "value", "years", "source"]` |
| `real_estate` | `Property \| Location \| Price \| Year \| Source` | `table-field` with `columnIds=["property", "location", "price", "year", "source"]` |

**Legal/controversy fields:**

| Current Field | Format | Migration |
| --- | --- | --- |
| `legal_cases` | `Type \| Year \| Parties \| Outcome \| Source` | `table-field` with `columnIds=["case_type", "year", "parties", "outcome", "source"]` |
| `arrests_charges` | `Year \| Charge \| Location \| Outcome \| Source` | `table-field` with `columnIds=["year", "charge", "location", "outcome", "source"]`, `columnTypes=["year", "string", "string", "string", "string"]` |
| `controversies` | `Year \| Issue \| Description \| Outcome \| Reliability` | `table-field` with `columnIds=["year", "issue", "description", "outcome", "reliability"]` |

**Social media fields:**

| Current Field | Format | Migration |
| --- | --- | --- |
| `instagram`, `twitter_x`, `tiktok`, etc. | `@handle \| Followers \| Verified? \| Activity \| URL` | Keep as string (single platform per field) |

**Interview/media fields:**

| Current Field | Format | Migration |
| --- | --- | --- |
| `notable_interviews` | `Outlet \| Date \| Topic \| URL` | `table-field` with `columnIds=["outlet", "date", "topic", "url"]`, `columnTypes=["string", "date", "string", "url"]` |
| `talk_show_appearances` | `Show \| Date \| Notable moment \| URL` | `table-field` with `columnIds=["show", "date", "notable_moment", "url"]`, `columnTypes=["string", "date", "string", "url"]` |
| `obituary_sources` | `Publication \| Headline \| URL` | `table-field` with `columnIds=["publication", "headline", "url"]`, `columnTypes=["string", "string", "url"]` |

### startup-deep-research.form.md

**Funding/competitors:**

| Current Field | Format | Migration |
| --- | --- | --- |
| `funding_rounds` | `Round \| Date \| Amount \| Lead \| Source` | `table-field` with `columnIds=["round_type", "date", "amount", "lead_investor", "source"]` |
| `competitors` | `Company \| Website \| One-liner \| Funding \| Source` | `table-field` with `columnIds=["company", "website", "one_liner", "funding_stage", "source"]`, `columnTypes=["string", "url", "string", "string", "url"]` |

**Social media fields:**

| Current Field | Format | Notes |
| --- | --- | --- |
| `twitter_x`, `linkedin_company`, `youtube`, etc. | Various `\|`-delimited | Keep as string (single platform per field) |

**Community presence:**

| Current Field | Format | Migration |
| --- | --- | --- |
| `hn_posts` | `Title \| Date \| Points \| Comments \| URL` | `table-field` with `columnIds=["title", "date", "points", "comments", "url"]`, `columnTypes=["string", "date", "number", "number", "url"]` |
| `product_hunt_launches` | `Product \| Date \| Upvotes \| Badges \| URL` | `table-field` with `columnIds=["product", "date", "upvotes", "badges", "url"]`, `columnTypes=["string", "date", "number", "string", "url"]` |
| `podcasts_interviews` | `Title \| Podcast \| Date \| URL` | `table-field` with `columnIds=["title", "podcast", "date", "url"]`, `columnTypes=["string", "string", "date", "url"]` |
| `press_coverage` | `Title \| Publication \| Date \| URL` | `table-field` with `columnIds=["title", "publication", "date", "url"]`, `columnTypes=["string", "string", "date", "url"]` |

### earnings-analysis.form.md

| Current Field | Format | Migration |
| --- | --- | --- |
| `sources_accessed` | `Date \| Source \| Type \| Link \| Takeaways` | `table-field` with `columnIds=["date", "source", "type", "link", "takeaways"]`, `columnTypes=["date", "string", "string", "url", "string"]` |
| `experts_list` | `Name \| Angle \| Lead time \| Hit rate \| Tier` | `table-field` with `columnIds=["name", "angle", "lead_time", "hit_rate", "tier"]` |

### Migration Notes

1. **Summary fields vs list fields:** Some pipe-delimited fields are single-value
   summaries (e.g., `box_office_stats`), not lists.
   These should remain as `string-field`.

2. **Single-platform social media:** Fields like `instagram`, `twitter_x` represent one
   platform each and are better as `string-field` than `table-field`.

3. **Already-table fields:** Some fields (`notable_films_table`, `oscar_history`)
   already use markdown table syntax in their instructions but are typed as
   `string-field`. These should become proper `table-field` tags.

4. **Typed columns:** Many tables benefit from typed columns (dates, URLs, numbers) for
   validation. The migration column shows suggested types.

5. **Template syntax:** All migrated tables should use clean template syntax (omit
   `columnLabels`, let headers provide them).
