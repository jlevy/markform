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

- If `columnLabels` is omitted AND field has data rows, this is a **parse error** (data
  rows imply the form was previously serialized, which always writes `columnLabels`)

- On serialize, `columnLabels` is always written explicitly (preserves extracted labels)

3. **Column types:** Support simple types only: `string`, `number`, `url`, `date`,
   `year`

   **Per-column required/optional:**

   Columns are **optional by default** — agents can send `null` to skip a cell, which
   serializes as `%SKIP%`. To make a column required, use object syntax in
   `columnTypes`:

   ```md
   columnTypes=["string", {type: "number", required: true}, "url"]
   ```

   - Simple string (`"string"`) — optional, allows `%SKIP%`

   - Object with `required: true` — cell must have a value (not `%SKIP%` or `%ABORT%`)

   This mirrors field-level `required` behavior.
   Required columns produce validation errors if a cell contains a sentinel value.

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

   - `required=true` implies `minRows >= 1` (if `minRows` is 0 or omitted, it’s
     effectively set to 1)

   - `required=false` with `minRows > 0` is valid — the table is optional but if filled,
     must have at least `minRows` rows

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

    Uses sentinel strings directly in cell values for clarity:

    ```json
    {
      "kind": "table",
      "rows": [
        {"name": "John", "title": "CEO", "linkedin_url": "https://...", "background": "20 years in tech"},
        {"name": "Jane", "title": "CTO", "linkedin_url": "%SKIP% (No public profile)", "background": "Former Google"}
      ]
    }
    ```

    Cells use `%SKIP%`, `%SKIP% (reason)`, `%ABORT%`, or `%ABORT% (reason)` directly as
    string values.

**Nice to Have (v2):**

1. Multiline types in cells (would need multi-line cell syntax)

2. Column-level constraints (minLength, pattern, etc.)

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
/** Base column type for table cells - simple types only */
export type ColumnTypeName = 'string' | 'number' | 'url' | 'date' | 'year';

/**
 * Column type specification in attributes.
 * Can be a simple string or an object with required flag.
 */
export type ColumnTypeSpec = ColumnTypeName | { type: ColumnTypeName; required: boolean };

/**
 * Column definition - derived from columnIds, columnLabels, columnTypes attributes.
 * After parsing, columns always have explicit required flag (default: false).
 */
export interface TableColumn {
  id: Id;                 // from columnIds array
  label: string;          // from columnLabels array (defaults to id)
  type: ColumnTypeName;   // from columnTypes array (defaults to 'string')
  required: boolean;      // from columnTypes object or default false
}

/**
 * Table field - structured tabular data with typed columns.
 * Inherits all FieldBase properties including `report?: boolean`.
 */
export interface TableField extends FieldBase {
  kind: 'table';
  columns: TableColumn[];  // column definitions in order
  minRows?: number;
  maxRows?: number;
}

/**
 * Cell value - scalar value only (never null).
 * Empty/skipped cells use %SKIP% sentinel, not null.
 */
export type CellValue = string | number;

/**
 * Table row for patches - simplified format.
 * Values can be:
 * - Actual value (string/number)
 * - null to indicate %SKIP% (serialized as %SKIP% in markdown)
 * - "%SKIP%" or "%ABORT%" sentinel strings with optional reason
 */
export type TableRowPatch = Record<Id, CellValue | null | string>;

/**
 * Cell response - matches FieldResponse pattern.
 * Used in internal representation (ParsedForm).
 */
export interface CellResponse {
  state: 'answered' | 'skipped' | 'aborted';  // cells cannot be 'unanswered'
  value?: CellValue;      // present when state === 'answered'
  reason?: string;        // present when state === 'skipped' or 'aborted'
}

/** Table row response - each cell has a response (internal representation) */
export type TableRowResponse = Record<Id, CellResponse>;

/** Table field value (internal representation) */
export interface TableValue {
  kind: 'table';
  rows: TableRowResponse[];
}

/**
 * Set table field patch.
 * Uses simplified format where null values become %SKIP% on serialize.
 */
export interface SetTablePatch {
  op: 'set_table';
  fieldId: Id;
  rows: TableRowPatch[];
}
```

**Zod Schemas for Table Types:**

```typescript
import { z } from 'zod';
import { IdSchema, AnswerStateSchema } from './coreTypes.js';

/** Base column type name schema */
export const ColumnTypeNameSchema = z.enum(['string', 'number', 'url', 'date', 'year']);

/**
 * Column type specification schema (for parsing attributes).
 * Either a simple type name or an object with type and required.
 */
export const ColumnTypeSpecSchema = z.union([
  ColumnTypeNameSchema,
  z.object({
    type: ColumnTypeNameSchema,
    required: z.boolean(),
  }),
]);

/**
 * Table column schema (normalized form after parsing).
 * Always has explicit required flag.
 */
export const TableColumnSchema = z.object({
  id: IdSchema,
  label: z.string(),
  type: ColumnTypeNameSchema,
  required: z.boolean(),
});

/** Table field schema (extends FieldBase pattern) */
export const TableFieldSchema = z.object({
  // FieldBase properties
  id: IdSchema,
  label: z.string(),
  required: z.boolean(),
  priority: z.enum(['high', 'medium', 'low']),
  role: z.string(),
  validate: z.array(z.union([z.string(), z.object({ id: z.string() }).passthrough()])).optional(),
  report: z.boolean().optional(),
  // Table-specific properties
  kind: z.literal('table'),
  columns: z.array(TableColumnSchema),
  minRows: z.number().int().nonnegative().optional(),
  maxRows: z.number().int().positive().optional(),
});

/** Cell value schema (never null - use sentinels for skipped) */
export const CellValueSchema = z.union([z.string(), z.number()]);

/** Cell response schema */
export const CellResponseSchema = z.object({
  state: z.enum(['answered', 'skipped', 'aborted']),
  value: CellValueSchema.optional(),
  reason: z.string().optional(),
});

/** Table row response schema */
export const TableRowResponseSchema = z.record(IdSchema, CellResponseSchema);

/** Table value schema */
export const TableValueSchema = z.object({
  kind: z.literal('table'),
  rows: z.array(TableRowResponseSchema),
});

/** Table row patch schema (simplified for patches) */
export const TableRowPatchSchema = z.record(
  IdSchema,
  z.union([CellValueSchema, z.null(), z.string()]),  // null or sentinel string
);

/** Set table patch schema */
export const SetTablePatchSchema = z.object({
  op: z.literal('set_table'),
  fieldId: IdSchema,
  rows: z.array(TableRowPatchSchema),
});
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

   - Else (has data rows but no `columnLabels`) → **parse error** (data rows imply the
     form was previously serialized, which always writes `columnLabels`)

7. Build `columns: TableColumn[]` by combining:

   - `id` from `columnIds[i]`

   - `label` from step 6

   - `type` and `required` from `columnTypes[i]`:

     - If string (e.g., `"string"`) → `type: "string", required: false`

     - If object (e.g., `{type: "number", required: true}`) → extract both

     - If omitted → `type: "string", required: false`

8. Parse each data row:

   - For each cell, check for sentinel pattern first

   - If sentinel, extract state and reason using existing `parseSentinel()`

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
| columnLabels required when table has data | `MISSING_COLUMN_LABELS` | `Table has data rows but no columnLabels attribute. Add columnLabels or remove data rows.` |

**Value validation (semantic):**

| Rule | Error Code | Example Error Message |
| --- | --- | --- |
| Cell must have value or sentinel | `CELL_EMPTY` | `Cell at row 2, column "title" is empty. Provide a value or use %SKIP%.` |
| Number cell must parse | `CELL_TYPE_MISMATCH` | `Cell "abc" at row 1, column "rt_score" is not a valid number.` |
| URL cell must be valid | `CELL_TYPE_MISMATCH` | `Cell "not-a-url" at row 1, column "website" is not a valid URL.` |
| Date cell must be ISO format | `CELL_TYPE_MISMATCH` | `Cell "Jan 15" at row 1, column "release_date" is not a valid date. Use YYYY-MM-DD format.` |
| Year cell must be integer | `CELL_TYPE_MISMATCH` | `Cell "2024.5" at row 1, column "release_year" is not a valid year.` |
| Row count ≥ minRows | `MIN_ROWS_NOT_MET` | `Table "films" has 2 rows but requires at least 5.` |
| Row count ≤ maxRows | `MAX_ROWS_EXCEEDED` | `Table "films" has 20 rows but maximum is 15.` |
| Required column cannot be skipped | `REQUIRED_CELL_SKIPPED` | `Cell at row 1, column "title" is required but contains %SKIP%.` |

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

- Separator row uses minimum dashes (`|---|`) without alignment characters (`:---`,
  `:---:`, `---:` are not used; alignment is not supported in v1)

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
/**
 * Escape a cell value for markdown table serialization.
 * Only pipes need escaping; backslashes before pipes are preserved.
 */
function escapeTableCell(value: string): string {
  // Reject newlines and control characters
  if (/[\n\r]/.test(value)) {
    throw new Error('Cell value cannot contain newlines');
  }
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value)) {
    throw new Error('Cell value contains invalid control characters');
  }

  // Escape only unescaped pipes using negative lookbehind
  // This correctly handles: "A|B" → "A\|B", "A\|B" → "A\|B" (already escaped)
  return value.replace(/(?<!\\)\|/g, '\\|');
}

/**
 * Unescape a cell value from markdown table parsing.
 * Markdoc handles most of this, but we may need to handle \| → |
 */
function unescapeTableCell(escaped: string): string {
  // Simple replacement: \| → |
  // If we need to preserve literal \|, the user must write \\|
  return escaped.replace(/\\\|/g, '|');
}
```

**Note:** Since we’re using Markdoc’s built-in table parser, escaping is primarily
needed for serialization.
Markdoc handles unescaping during parsing.
The unescape function is provided for cases where we need to manually process cell
content.

**Test cases (TDD):**

```typescript
describe('escapeTableCell', () => {
  it('leaves plain text unchanged', () => {
    expect(escapeTableCell('Hello world')).toBe('Hello world');
  });

  it('escapes unescaped pipe', () => {
    expect(escapeTableCell('A|B')).toBe('A\\|B');
  });

  it('escapes multiple pipes', () => {
    expect(escapeTableCell('A|B|C')).toBe('A\\|B\\|C');
  });

  it('leaves already-escaped pipe unchanged', () => {
    expect(escapeTableCell('A\\|B')).toBe('A\\|B');
  });

  it('handles mixed escaped and unescaped pipes', () => {
    expect(escapeTableCell('A\\|B|C')).toBe('A\\|B\\|C');
  });

  it('rejects newlines', () => {
    expect(() => escapeTableCell('line1\nline2')).toThrow('newlines');
  });

  it('rejects control characters', () => {
    expect(() => escapeTableCell('text\x00more')).toThrow('control characters');
  });
});

describe('unescapeTableCell', () => {
  it('leaves plain text unchanged', () => {
    expect(unescapeTableCell('Hello world')).toBe('Hello world');
  });

  it('unescapes escaped pipe', () => {
    expect(unescapeTableCell('A\\|B')).toBe('A|B');
  });

  it('unescapes multiple escaped pipes', () => {
    expect(unescapeTableCell('A\\|B\\|C')).toBe('A|B|C');
  });
});

describe('round-trip', () => {
  it('preserves plain text', () => {
    const original = 'Hello world';
    expect(unescapeTableCell(escapeTableCell(original))).toBe(original);
  });

  it('preserves text with pipes', () => {
    const original = 'A|B|C';
    const escaped = escapeTableCell(original);
    expect(escaped).toBe('A\\|B\\|C');
    expect(unescapeTableCell(escaped)).toBe(original);
  });
});
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

   - Reuse `parseSentinel()` from `parseSentinels.ts`

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
This requires a **two-phase approach** to scope reference handling:

1. **Phase 1 (Parsing):** Syntactic parsing that produces an intermediate representation

2. **Phase 2 (Resolution):** Schema-aware resolution that determines the actual scope

#### Reference Type Hierarchy

```
IssueRef = Id | QualifiedRef | CellRef

Where:
  Id            = /^[a-z][a-z0-9_]*$/           → "company_name"
  QualifiedRef  = {fieldId}.{qualifierId}       → "rating.bullish" or "key_people.name"
  CellRef       = {fieldId}.{columnId}[{row}]   → "key_people.name[0]"
```

**Key insight:** `QualifiedRef` is syntactically ambiguous—it could be an option ref
(for select/checkbox fields) or a column ref (for table fields).
Resolution requires schema context.

#### Scope Enum Extension

```typescript
// Extended for tables
type IssueScope = 'form' | 'group' | 'field' | 'option' | 'column' | 'cell';
```

#### Type Definitions (in `scopeRef.ts`)

**Phase 1 types (parsing only, no schema):**

```typescript
/**
 * Parsed scope reference - intermediate representation.
 * QualifiedRef is ambiguous (could be option or column) until resolved.
 */
export type ParsedScopeRef =
  | { kind: 'field'; fieldId: Id }
  | { kind: 'qualified'; fieldId: Id; qualifierId: Id }  // ambiguous: option or column
  | { kind: 'cell'; fieldId: Id; columnId: Id; rowIndex: number };

/** Result of parsing a scope ref string */
export interface ParseScopeRefResult {
  ok: boolean;
  ref?: ParsedScopeRef;
  error?: string;
}
```

**Phase 2 types (after schema resolution):**

```typescript
/**
 * Resolved scope reference - unambiguous after schema lookup.
 */
export type ResolvedScopeRef =
  | { scope: 'form'; formId: Id }
  | { scope: 'group'; groupId: Id }
  | { scope: 'field'; fieldId: Id }
  | { scope: 'option'; fieldId: Id; optionId: Id }
  | { scope: 'column'; fieldId: Id; columnId: Id }
  | { scope: 'cell'; fieldId: Id; columnId: Id; rowIndex: number };

/** Result of resolving a parsed scope ref against schema */
export interface ResolveScopeRefResult {
  ok: boolean;
  resolved?: ResolvedScopeRef;
  error?: string;
}
```

#### Phase 1: Parsing Implementation (in `scopeRef.ts`)

```typescript
const PATTERNS = {
  // field.column[row] - must check first (most specific)
  cell: /^([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\[(\d+)\]$/,
  // field.qualifier - ambiguous until resolved
  qualified: /^([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)$/,
  // simple field id
  field: /^[a-z][a-z0-9_]*$/,
};

/**
 * Parse a scope reference string into structured form.
 * This is pure parsing - no schema validation.
 * Qualified refs are left ambiguous (resolved in phase 2).
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
    return { ok: true, ref: { kind: 'cell', fieldId, columnId, rowIndex } };
  }

  // Try qualified pattern (ambiguous: option or column)
  const qualifiedMatch = PATTERNS.qualified.exec(ref);
  if (qualifiedMatch) {
    const [, fieldId, qualifierId] = qualifiedMatch;
    return { ok: true, ref: { kind: 'qualified', fieldId, qualifierId } };
  }

  // Try simple field pattern
  if (PATTERNS.field.test(ref)) {
    return { ok: true, ref: { kind: 'field', fieldId: ref } };
  }

  return { ok: false, error: `Invalid scope reference format: "${ref}"` };
}

/**
 * Serialize a parsed scope ref back to string form.
 */
export function serializeScopeRef(ref: ParsedScopeRef): string {
  switch (ref.kind) {
    case 'field':
      return ref.fieldId;
    case 'qualified':
      return `${ref.fieldId}.${ref.qualifierId}`;
    case 'cell':
      return `${ref.fieldId}.${ref.columnId}[${ref.rowIndex}]`;
  }
}
```

#### Phase 2: Schema Resolution (in `scopeRefValidation.ts`)

```typescript
import type { FormSchema, StructureSummary } from './coreTypes.js';
import type { ParsedScopeRef, ResolvedScopeRef, ResolveScopeRefResult } from './scopeRef.js';

/**
 * Resolve a parsed scope ref against the form schema.
 * Disambiguates qualified refs (option vs column) based on field type.
 */
export function resolveScopeRef(
  ref: ParsedScopeRef,
  schema: FormSchema,
  summary: StructureSummary,
  rowCounts?: Record<Id, number>,  // for cell bounds checking
): ResolveScopeRefResult {
  const { fieldsById, optionsById } = summary;

  // Check field exists
  const fieldKind = fieldsById[ref.fieldId];
  if (!fieldKind) {
    return { ok: false, error: `Unknown field: "${ref.fieldId}"` };
  }

  switch (ref.kind) {
    case 'field':
      return { ok: true, resolved: { scope: 'field', fieldId: ref.fieldId } };

    case 'qualified': {
      // Disambiguate based on field type and what exists
      const qualifiedRef = `${ref.fieldId}.${ref.qualifierId}`;

      // Check if it's an option (select/checkbox field)
      if (optionsById[qualifiedRef]) {
        return {
          ok: true,
          resolved: { scope: 'option', fieldId: ref.fieldId, optionId: ref.qualifierId },
        };
      }

      // Check if it's a column (table field)
      if (fieldKind === 'table') {
        const colResult = resolveColumnRef(ref.fieldId, ref.qualifierId, schema);
        if (colResult.ok) {
          return {
            ok: true,
            resolved: { scope: 'column', fieldId: ref.fieldId, columnId: ref.qualifierId },
          };
        }
        return colResult;
      }

      return { ok: false, error: `Unknown option or column: "${qualifiedRef}"` };
    }

    case 'cell': {
      if (fieldKind !== 'table') {
        return {
          ok: false,
          error: `Cell ref "${ref.fieldId}.${ref.columnId}[${ref.rowIndex}]" invalid: ` +
                 `field "${ref.fieldId}" is ${fieldKind}, not table`,
        };
      }

      // Validate column exists
      const colResult = resolveColumnRef(ref.fieldId, ref.columnId, schema);
      if (!colResult.ok) return colResult;

      // Validate row index bounds (if row counts provided)
      if (rowCounts) {
        const rowCount = rowCounts[ref.fieldId] ?? 0;
        if (ref.rowIndex >= rowCount) {
          return {
            ok: false,
            error: `Cell ref "${ref.fieldId}.${ref.columnId}[${ref.rowIndex}]" invalid: ` +
                   `row index ${ref.rowIndex} out of bounds (table has ${rowCount} rows)`,
          };
        }
      }

      return {
        ok: true,
        resolved: {
          scope: 'cell',
          fieldId: ref.fieldId,
          columnId: ref.columnId,
          rowIndex: ref.rowIndex,
        },
      };
    }
  }
}

function resolveColumnRef(
  fieldId: Id,
  columnId: Id,
  schema: FormSchema,
): ResolveScopeRefResult {
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
        return {
          ok: true,
          resolved: { scope: 'column', fieldId, columnId },
        };
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
│   ├── scopeRef.ts              # Phase 1: Standalone scope parsing (no deps)
│   ├── scopeRefValidation.ts    # Phase 2: Schema-aware resolution
│   ├── table/                   # Table-specific modules
│   │   ├── parseTable.ts        # Extract table from Markdoc AST
│   │   ├── serializeTable.ts    # Table serialization with escaping
│   │   ├── validateTable.ts     # Table value validation
│   │   └── tableTypes.ts        # Table-specific type helpers
│   └── validate.ts              # Existing validation (imports scopeRefValidation)
├── tests/unit/
│   ├── scopeRef.test.ts         # Unit tests for scope parsing
│   ├── scopeRefValidation.test.ts  # Unit tests for resolution
│   └── table/
│       ├── parseTable.test.ts   # Tests for Markdoc AST extraction
│       ├── serializeTable.test.ts
│       └── escaping.test.ts     # TDD tests for cell escaping
```

#### Unit Test Coverage (scopeRef.test.ts)

```typescript
describe('parseScopeRef', () => {
  describe('field references', () => {
    it('parses simple field id', () => {
      expect(parseScopeRef('company_name')).toEqual({
        ok: true,
        ref: { kind: 'field', fieldId: 'company_name' },
      });
    });

    it('rejects invalid characters', () => {
      expect(parseScopeRef('Company-Name').ok).toBe(false);
      expect(parseScopeRef('123_field').ok).toBe(false);
      expect(parseScopeRef('field name').ok).toBe(false);
    });
  });

  describe('qualified references (ambiguous)', () => {
    it('parses qualified ref as ambiguous', () => {
      // Note: kind is 'qualified', not 'option' - ambiguity resolved in phase 2
      expect(parseScopeRef('rating.bullish')).toEqual({
        ok: true,
        ref: { kind: 'qualified', fieldId: 'rating', qualifierId: 'bullish' },
      });
    });

    it('parses multi-segment field id', () => {
      expect(parseScopeRef('docs_reviewed.ten_k')).toEqual({
        ok: true,
        ref: { kind: 'qualified', fieldId: 'docs_reviewed', qualifierId: 'ten_k' },
      });
    });
  });

  describe('cell references', () => {
    it('parses cell ref with row index', () => {
      expect(parseScopeRef('key_people.name[0]')).toEqual({
        ok: true,
        ref: { kind: 'cell', fieldId: 'key_people', columnId: 'name', rowIndex: 0 },
      });
    });

    it('parses large row index', () => {
      expect(parseScopeRef('films.title[999]')).toEqual({
        ok: true,
        ref: { kind: 'cell', fieldId: 'films', columnId: 'title', rowIndex: 999 },
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
    const ref = { kind: 'field' as const, fieldId: 'company' };
    expect(serializeScopeRef(ref)).toBe('company');
  });

  it('round-trips qualified ref', () => {
    const ref = { kind: 'qualified' as const, fieldId: 'rating', qualifierId: 'bullish' };
    expect(serializeScopeRef(ref)).toBe('rating.bullish');
  });

  it('round-trips cell ref', () => {
    const ref = { kind: 'cell' as const, fieldId: 'people', columnId: 'name', rowIndex: 5 };
    expect(serializeScopeRef(ref)).toBe('people.name[5]');
  });
});
```

#### Unit Test Coverage (scopeRefValidation.test.ts)

```typescript
describe('resolveScopeRef', () => {
  const mockSchema: FormSchema = { /* ... with table field */ };
  const mockSummary: StructureSummary = { /* ... */ };

  describe('field references', () => {
    it('resolves simple field ref', () => {
      const ref = { kind: 'field' as const, fieldId: 'company_name' };
      const result = resolveScopeRef(ref, mockSchema, mockSummary);
      expect(result.ok).toBe(true);
      expect(result.resolved?.scope).toBe('field');
    });
  });

  describe('qualified reference disambiguation', () => {
    it('resolves qualified ref as option for select field', () => {
      const ref = { kind: 'qualified' as const, fieldId: 'rating', qualifierId: 'bullish' };
      const result = resolveScopeRef(ref, mockSchema, mockSummary);
      expect(result.ok).toBe(true);
      expect(result.resolved?.scope).toBe('option');
    });

    it('resolves qualified ref as column for table field', () => {
      const ref = { kind: 'qualified' as const, fieldId: 'films', qualifierId: 'title' };
      const result = resolveScopeRef(ref, mockSchema, mockSummary);
      expect(result.ok).toBe(true);
      expect(result.resolved?.scope).toBe('column');
    });

    it('rejects unknown qualifier', () => {
      const ref = { kind: 'qualified' as const, fieldId: 'company_name', qualifierId: 'unknown' };
      const result = resolveScopeRef(ref, mockSchema, mockSummary);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unknown option or column');
    });
  });

  describe('cell references', () => {
    it('rejects cell ref on non-table field', () => {
      const ref = { kind: 'cell' as const, fieldId: 'company_name', columnId: 'x', rowIndex: 0 };
      const result = resolveScopeRef(ref, mockSchema, mockSummary);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('is string, not table');
    });

    it('accepts valid cell ref', () => {
      const ref = { kind: 'cell' as const, fieldId: 'films', columnId: 'title', rowIndex: 0 };
      const result = resolveScopeRef(ref, mockSchema, mockSummary, { films: 5 });
      expect(result.ok).toBe(true);
      expect(result.resolved?.scope).toBe('cell');
    });

    it('rejects unknown column', () => {
      const ref = { kind: 'cell' as const, fieldId: 'films', columnId: 'nonexistent', rowIndex: 0 };
      const result = resolveScopeRef(ref, mockSchema, mockSummary);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unknown column');
      expect(result.error).toContain('Valid columns:');
    });

    it('rejects out-of-bounds row index', () => {
      const ref = { kind: 'cell' as const, fieldId: 'films', columnId: 'title', rowIndex: 10 };
      const result = resolveScopeRef(ref, mockSchema, mockSummary, { films: 5 });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('out of bounds');
      expect(result.error).toContain('has 5 rows');
    });

    it('skips bounds check when rowCounts not provided', () => {
      const ref = { kind: 'cell' as const, fieldId: 'films', columnId: 'title', rowIndex: 999 };
      const result = resolveScopeRef(ref, mockSchema, mockSummary);
      expect(result.ok).toBe(true); // No bounds check without rowCounts
    });
  });
});
```

## Stage 3: Refine Architecture

### Code Reuse Analysis

| Component | Existing Code | Reuse Strategy |
| --- | --- | --- |
| Sentinel parsing | `parseSentinels.ts` | Direct import of `parseSentinel()` |
| URL validation | `validate.ts` | Import existing URL regex/validator |
| Date validation | `validate.ts` | Import ISO date pattern |
| Field registry | `fieldRegistry.ts` | Add new entry following existing pattern |
| Zod schemas | `coreTypes.ts` | Follow existing schema patterns |

### Markdown Table Parsing

Markdoc already parses markdown tables as part of its AST. The table-field tag body
contains Markdoc’s parsed table nodes.

**Strategy:** Leverage Markdoc’s built-in table parsing rather than writing a custom
parser:

1. Markdoc parses the tag body and produces table nodes (thead, tbody, tr, td)

2. We traverse the Markdoc AST to extract:

   - Header cells from `thead > tr > th` nodes

   - Data rows from `tbody > tr > td` nodes

3. Cell content is extracted from the text content of each cell node

4. Pipe escaping (`\|`) is handled by Markdoc during parsing

**Implementation:**

```typescript
import type { Node } from '@markdoc/markdoc';

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

/**
 * Extract table data from Markdoc's parsed AST.
 * Relies on Markdoc's built-in table parsing.
 */
function parseTableFromAst(node: Node): ParsedTable {
  const headers: string[] = [];
  const rows: string[][] = [];

  // Find thead and tbody in the node's children
  for (const child of node.children ?? []) {
    if (child.type === 'thead') {
      // Extract header cells
      for (const tr of child.children ?? []) {
        if (tr.type === 'tr') {
          for (const th of tr.children ?? []) {
            headers.push(extractCellText(th));
          }
        }
      }
    } else if (child.type === 'tbody') {
      // Extract data rows
      for (const tr of child.children ?? []) {
        if (tr.type === 'tr') {
          const row: string[] = [];
          for (const td of tr.children ?? []) {
            row.push(extractCellText(td));
          }
          rows.push(row);
        }
      }
    }
  }

  return { headers, rows };
}

function extractCellText(cell: Node): string {
  // Extract text content from cell, handling inline nodes
  if (cell.type === 'text') return cell.attributes?.content ?? '';
  if (!cell.children) return '';
  return cell.children.map(extractCellText).join('');
}
```

**Benefits of using Markdoc’s parser:**

- No custom regex parsing (less error-prone)

- Consistent with how other Markdoc content is handled

- Automatically handles edge cases Markdoc already solves

- Pipe escaping handled by Markdoc

### Integration Points

1. **Parser (`parse.ts`):** Add `table-field` tag handling

2. **Serializer (`serialize.ts`):** Add table serialization

3. **Validator (`validate.ts`):** Add table-specific validation

4. **Apply (`apply.ts`):** Add `set_table` patch handling

5. **Summaries (`summaries.ts`):** Include table in field counts

6. **Export (`exportHelpers.ts`):** Export table values

## Stage 4: Implementation

### Phase 1: Type Definitions, Registry, and Scope Parsing

**Type definitions (`coreTypes.ts`):**

- [ ] Add `ColumnType` type

- [ ] Add `TableColumn` interface

- [ ] Add `TableField` interface extending `FieldBase`

- [ ] Add `CellValue`, `CellResponse`, `TableRowResponse` types

- [ ] Add `TableValue` interface

- [ ] Add `SetTablePatch` interface

- [ ] Add `'table'` to `FieldKind` union

- [ ] Add `'column'` and `'cell'` to `IssueScope` enum

- [ ] Add Zod schemas: `ColumnTypeSchema`, `TableColumnSchema`, `TableFieldSchema`,
  `CellValueSchema`, `CellResponseSchema`, `TableRowResponseSchema`, `TableValueSchema`,
  `TableRowPatchSchema`, `SetTablePatchSchema`

- [ ] Update `Field` union to include `TableField`

- [ ] Update `FieldValue` union to include `TableValue`

- [ ] Update `Patch` union to include `SetTablePatch`

**Field registry (`fieldRegistry.ts`):**

- [ ] Add `table` to `FIELD_KINDS`

- [ ] Add `FieldTypeMap['table']` entry

- [ ] Add `createEmptyValue` case for `'table'`

**Scope reference parsing (`scopeRef.ts`):**

- [ ] Create `ParsedScopeRef` types (field, qualified, cell)

- [ ] Create `ResolvedScopeRef` types (field, option, column, cell)

- [ ] Implement `parseScopeRef()` with regex patterns

- [ ] Implement `serializeScopeRef()` for round-trip

- [ ] Write unit tests: valid field refs, qualified refs, cell refs

- [ ] Write unit tests: invalid formats, edge cases

**Scope reference resolution (`scopeRefValidation.ts`):**

- [ ] Implement `resolveScopeRef()` for schema-aware resolution

- [ ] Implement qualified ref disambiguation (option vs column)

- [ ] Implement column existence validation

- [ ] Implement row bounds validation (when rowCounts provided)

- [ ] Write unit tests for disambiguation

- [ ] Write unit tests for column validation errors

- [ ] Write unit tests for row bounds errors

### Phase 2: Markdown Table Parsing

- [ ] Create `table/parseTable.ts` with `parseTableFromAst()` function

- [ ] Extract headers from Markdoc’s `thead` nodes

- [ ] Extract data rows from Markdoc’s `tbody` nodes

- [ ] Handle whitespace trimming in cells

- [ ] Write unit tests for table parsing from AST

- [ ] Test edge cases: empty table, single row, many columns

### Phase 3: Field Parsing

- [ ] Add `table-field` to Markdoc tag config

- [ ] Extract `columnIds`, `columnLabels`, `columnTypes` attributes

- [ ] Validate `columnIds` is present and all IDs are valid identifiers

- [ ] Validate `columnLabels` length matches `columnIds.length` if specified

- [ ] Validate `columnTypes` entries are valid (string or `{type, required}` object)

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

### Phase 4: Serialization

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

### Phase 5: Table Validation

- [ ] Create `table/validateTable.ts` for table-specific validation

- [ ] Validate minRows/maxRows constraints

- [ ] Validate cell values against column types

- [ ] Validate no empty cells (must use sentinel)

- [ ] Validate required columns don’t contain sentinels (`REQUIRED_CELL_SKIPPED`)

- [ ] Add validation error codes to taxonomy

- [ ] Use `scopeRefValidation.ts` for cell reference validation in errors

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

- [ ] Update `StructureSummary` to count table columns (add `columnsById`)

- [ ] Update `ProgressSummary` for table fields

- [ ] Write export tests

### Phase 8: Documentation

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

- [ ] Migrate `movie-deep-research.form.md` — 2 fields (`lead_cast`, `notable_awards`)

- [ ] Migrate `celebrity-deep-research.form.md` — ~20 fields (major migration)

- [ ] Migrate `startup-deep-research.form.md` — ~8 fields

- [ ] Migrate `earnings-analysis.form.md` — 2 fields (`sources_accessed`,
  `experts_list`)

- [ ] Create simple table-field example in `examples/simple/`

## Stage 5: Validation

### Automated Test Coverage

**Scope ref parsing tests (scopeRef.test.ts):**

- [ ] Parses simple field id: `company_name` → `{ kind: 'field' }`

- [ ] Parses qualified ref: `rating.bullish` → `{ kind: 'qualified' }` (ambiguous)

- [ ] Parses cell ref: `key_people.name[0]` → `{ kind: 'cell' }`

- [ ] Parses large row index: `films.title[999]`

- [ ] Rejects invalid characters in field id

- [ ] Rejects negative row index pattern

- [ ] Rejects non-numeric row index

- [ ] Round-trips all ref types through serialize/parse

**Scope ref resolution tests (scopeRefValidation.test.ts):**

- [ ] Resolves field ref → `{ scope: 'field' }`

- [ ] Disambiguates qualified ref as option for select field → `{ scope: 'option' }`

- [ ] Disambiguates qualified ref as column for table field → `{ scope: 'column' }`

- [ ] Rejects unknown qualifier with helpful error

- [ ] Rejects cell ref on non-table field

- [ ] Accepts valid cell ref on table field → `{ scope: 'cell' }`

- [ ] Rejects unknown column with helpful error

- [ ] Accepts in-bounds row index

- [ ] Rejects out-of-bounds row index with helpful error

- [ ] Skips bounds check when rowCounts not provided

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

- [ ] Labels back-filled from headers when `columnLabels` omitted and unanswered

- [ ] Header count mismatch error when back-filling labels

- [ ] **Parse error** when `columnLabels` omitted but has data rows

**Table validation tests:**

- [ ] Table with fewer than minRows fails

- [ ] Table with more than maxRows fails

- [ ] required=true with 0 rows fails

- [ ] Required column with `%SKIP%` produces `REQUIRED_CELL_SKIPPED` error

- [ ] Required column with `%ABORT%` produces `REQUIRED_CELL_SKIPPED` error

- [ ] Optional column (default) allows `%SKIP%`

- [ ] Column with `{type: "string", required: true}` parsed correctly

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

- [ ] Null value in patch becomes `%SKIP%` in serialized form

- [ ] `%SKIP%` string in patch parsed as skipped cell

- [ ] `%SKIP% (reason)` string in patch preserves reason

- [ ] `%ABORT%` string in patch parsed as aborted cell

**Golden test updates:**

- [ ] Regenerate golden tests after format changes (`pnpm test:golden:regen`)

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

### Per-Column Required (Mixed Syntax)

Use object syntax in `columnTypes` to mark specific columns as required:

```md
{% table-field id="contacts" label="Contact List"
   columnIds=["name", "email", "phone", "notes"]
   columnTypes=[{type: "string", required: true}, {type: "string", required: true}, "string", "string"] %}
| Name | Email | Phone | Notes |
|------|-------|-------|-------|
| John Smith | john@example.com | %SKIP% | Primary contact |
{% /table-field %}
```

In this example, `name` and `email` are required (cannot be `%SKIP%`), while `phone` and
`notes` are optional (agents can send `null` which becomes `%SKIP%`).

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

{% table-field id="contacts" columnIds=["name", "email"]
   columnTypes=[{type: "string", required: true}, "string"] %}
| Name | Email |
|------|-------|
| %SKIP% | john@example.com |
{% /table-field %}

<!-- ERROR: Cell at row 1, column "name" is required but contains %SKIP%. -->
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
should be migrated to `table-field`.

**Migration priority:**

1. **Phase 1 (smoke test):** `movie-research-basic.form.md` — 1 field

2. **Phase 2 (small batch):** `movie-deep-research.form.md` — 2 fields

3. **Phase 3 (medium):** `startup-deep-research.form.md`, `earnings-analysis.form.md`

4. **Phase 4 (large, separate PR):** `celebrity-deep-research.form.md` — ~20 fields

### movie-research-basic.form.md

| Current Field | Format | Migration |
| --- | --- | --- |
| `notable_awards` | `Award \| Category \| Year` | `table-field` with `columnIds=["award", "category", "year"]` |

### movie-deep-research.form.md

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
