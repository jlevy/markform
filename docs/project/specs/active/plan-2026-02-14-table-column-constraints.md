---
title: Per-Column Constraints for Table Fields
description: Add minLength, maxLength, min, max, and integer constraints to table column definitions
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Per-Column Constraints for Table Fields

**Date:** 2026-02-14 (last updated 2026-02-14)

**Author:** Claude (with Joshua Levy)

**Status:** Draft

## Overview

Table fields currently support only `type` and `required` per column.
Scalar fields (string, number) support rich constraints (`minLength`, `maxLength`,
`min`, `max`, `integer`, `pattern`), but none of these are available on table columns.

This means constraints like “each tweet must be ≤280 characters” in the twitter-thread
form are purely instructional — the LLM is told the limit in prose, but Markform’s
validation engine does not enforce it.
If the agent writes a 300-character tweet, no validation error is raised.

This feature extends `columnTypes` to support the same constraints that scalar fields
already have, enforced by the Markform validation engine.

## Goals

- Table string columns support `minLength`, `maxLength` constraints with validation
- Table number columns support `min`, `max`, `integer` constraints with validation
- Syntax is a natural extension of the existing `columnTypes` object format
- Constraints appear in JSON Schema export
- Round-trip: parse → serialize → parse preserves all constraints
- The twitter-thread form uses real validation for the 280-char tweet limit

## Non-Goals

- `pattern` (regex) constraint on table columns (can be added later with the same
  pattern but not needed for the immediate use case)
- `date` column `min`/`max` constraints (date fields use string-based ISO date
  comparison, which is more complex than numeric constraints; can follow later)
- `url` column `minLength`/`maxLength` constraints (url columns primarily validate
  format; length constraints can follow later if needed)
- Per-column validation hooks or LLM-based validation
- Changes to the table value editing UI

## Background

The twitter-thread form (`examples/twitter-thread/twitter-thread.form.md`) has a
`drafts_table` with a `draft_content` string column and a `char_count` number column.
The form instructions say “must be ≤280 characters” and “character count must be
accurate,” but the Markform engine treats these as plain strings with no length
constraints.

During QA testing, we confirmed:
- All tweets happened to be under 280 chars (the LLM followed instructions)
- But the agent’s self-reported char counts were inaccurate (off by 5-13 chars)
- No validation error was raised for either issue

The current `TableColumn` interface (`src/engine/coreTypes.ts:139-144`):

```typescript
export interface TableColumn {
  id: Id;
  label: string;
  type: ColumnTypeName;
  required: boolean;
}
```

The existing `ColumnTypeSpec` already supports an object form for the `required` flag:

```
columnTypes=[{type: "string", required: true}, "number", "url"]
```

This feature extends that object form with constraint properties.

## Design

### Syntax

Column constraints use the existing object syntax in `columnTypes`, extended with
constraint properties:

```markdown
<!-- field kind="table" id="drafts_table" label="Tweet Drafts"
   columnIds=["tweet_num", "draft_content", "char_count", "issues"]
   columnLabels=["#", "Draft Content", "Chars", "Issues"]
   columnTypes=["number", {type: "string", maxLength: 280}, {type: "number", min: 1, max: 280, integer: true}, "string"]
   minRows=5 maxRows=20 -->
```

Supported constraints by column type:

| Column Type | Constraint | Description |
| --- | --- | --- |
| `string` | `minLength` | Minimum character length |
| `string` | `maxLength` | Maximum character length |
| `number` | `min` | Minimum numeric value |
| `number` | `max` | Maximum numeric value |
| `number` | `integer` | Must be an integer |
| `year` | `min` | Minimum year value |
| `year` | `max` | Maximum year value |

### Components

**Files to modify:**

| File | Change |
| --- | --- |
| `src/engine/coreTypes.ts` | Extend `TableColumn`, `ColumnTypeSpec`, Zod schemas |
| `src/engine/parseFields.ts` | Extract constraints from `columnTypes` objects |
| `src/engine/validate.ts` | Check constraints in `validateCellValue()` |
| `src/engine/serialize.ts` | Include constraints in `columnTypes` serialization |
| `src/engine/jsonSchema.ts` | Emit constraints in `columnToJsonSchema()` |
| `examples/twitter-thread/twitter-thread.form.md` | Use `maxLength: 280` on draft_content |
| `docs/markform-spec.md` | Document column constraints |
| `docs/markform-reference.md` | Document column constraints |
| `tests/unit/engine/validate.test.ts` | Add constraint validation test cases |
| `tests/unit/engine/parseTable.test.ts` | Add constraint-aware parsing tests |
| `tests/unit/engine/parse.test.ts` | Add `parseColumnsFromAttributes` constraint tests |

### API Changes

**`TableColumn` interface** — add optional constraint fields:

```typescript
export interface TableColumn {
  id: Id;
  label: string;
  type: ColumnTypeName;
  required: boolean;
  // String column constraints
  minLength?: number;
  maxLength?: number;
  // Number/year column constraints
  min?: number;
  max?: number;
  integer?: boolean;
}
```

**`ColumnTypeSpec` type** — extend object variant:

```typescript
export type ColumnTypeSpec =
  | ColumnTypeName
  | {
      type: ColumnTypeName;
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      min?: number;
      max?: number;
      integer?: boolean;
    };
```

Note: `required` changes from mandatory `boolean` to optional `boolean` (defaults to
`false`) since you may want to specify constraints without requiring the column.
The parser already handles undefined (`typeObj.required ?? false`), so only the
TypeScript type and Zod schema need updating.

**`ColumnTypeSpecSchema` Zod schema** — extend with optional constraint fields:

```typescript
export const ColumnTypeSpecSchema = z.union([
  ColumnTypeNameSchema,
  z.object({
    type: ColumnTypeNameSchema,
    required: z.boolean().optional(),       // was: z.boolean()
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    integer: z.boolean().optional(),
  }),
]);
```

**`TableColumnSchema` Zod schema** — add constraint fields:

```typescript
export const TableColumnSchema = z.object({
  id: IdSchema,
  label: z.string(),
  type: ColumnTypeNameSchema,
  required: z.boolean(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  integer: z.boolean().optional(),
});
```

**Serialization logic** — use object form when any constraint is set, not just
`required`:

```typescript
// Current: only uses object form for required columns
if (c.required) return { type: c.type, required: true };
return c.type;

// New: uses object form if required OR any constraint is set
const hasConstraints = c.minLength !== undefined || c.maxLength !== undefined
  || c.min !== undefined || c.max !== undefined || c.integer !== undefined;
if (c.required || hasConstraints) {
  const spec: Record<string, unknown> = { type: c.type };
  if (c.required) spec.required = true;
  if (c.minLength !== undefined) spec.minLength = c.minLength;
  if (c.maxLength !== undefined) spec.maxLength = c.maxLength;
  if (c.min !== undefined) spec.min = c.min;
  if (c.max !== undefined) spec.max = c.max;
  if (c.integer !== undefined) spec.integer = c.integer;
  return spec;
}
return c.type;
```

**JSON Schema mapping** — constraint properties map to standard JSON Schema:

| TableColumn | JSON Schema | Notes |
| --- | --- | --- |
| `minLength` | `minLength` | Same name |
| `maxLength` | `maxLength` | Same name |
| `min` | `minimum` | JSON Schema uses `minimum` |
| `max` | `maximum` | JSON Schema uses `maximum` |
| `integer` | `type: "integer"` | Changes `type` from `"number"` to `"integer"` |

**Validation messages** follow the existing cell error pattern
(`Cell "LABEL" in row N ...`):

```
Cell "Draft Content" in row 3 must be at most 280 characters (got 312)
Cell "Chars" in row 3 must be at most 280 (got 312)
Cell "Chars" in row 5 must be an integer (got 127.5)
```

## Implementation Plan

### Phase 1: Types and schemas

- [ ] Extend `TableColumn` interface with optional constraint fields in `coreTypes.ts`
- [ ] Extend `ColumnTypeSpec` type: `required` becomes optional in object variant
- [ ] Update `ColumnTypeSpecSchema` Zod schema with optional constraint fields
- [ ] Update `TableColumnSchema` Zod schema with optional constraint fields

### Phase 2: Parse, validate, serialize, export

- [ ] Update `parseColumnsFromAttributes()` in `parseFields.ts` to extract constraints
  from object-form column types and populate `TableColumn` fields
- [ ] Add constraint checks in `validateCellValue()` in `validate.ts`: string columns
  check `minLength`/`maxLength`, number columns check `min`/`max`/`integer`, year
  columns check `min`/`max`
- [ ] Update `serializeTableField()` in `serialize.ts`: emit object form when any
  constraint is set (not just when `required` is true)
- [ ] Update `columnToJsonSchema()` in `jsonSchema.ts`: emit `minLength`, `maxLength`,
  `minimum`, `maximum`, and `type: "integer"` as appropriate

### Phase 3: Tests

- [ ] Add validation tests for column constraints (`validate.test.ts`)
- [ ] Add parse tests for constraint extraction (`parse.test.ts`)
- [ ] Add round-trip tests: parse → serialize → parse preserves constraints
- [ ] Add JSON Schema constraint emission tests

### Phase 4: Form update and docs

- [ ] Update twitter-thread form: `drafts_table` with `maxLength: 280` on draft_content
  and `{type: "number", min: 1, max: 280, integer: true}` on char_count
- [ ] Update `docs/markform-spec.md` table field section: add constraint docs, update
  `columnTypes` type from `string[]` to `(string | object)[]`
- [ ] Update `docs/markform-reference.md` table field section: add constraint docs,
  update `columnTypes` type description
- [ ] Add `test-output/` to root `.gitignore`

### Phase 5: Twitter thread example improvements

Depends on Phases 1-4 being complete.
Fixes issues found during QA testing and improves the form to take advantage of the new
column constraints.

- [ ] Add `maxLength: 280` on `draft_content` column and
  `{type: "number", min: 1, max: 280, integer: true}` on `char_count` column in
  `drafts_table`
- [ ] Add agent instruction to keep tweet content on a single line within table cells
  (multi-line content in table cells breaks the Markdown table parser, causing extra
  rows and `tweet_num` validation failures — 11 P2 issues observed in QA)
- [ ] Fix priority/structure table `role` column: agent used free-text values like
  “attention-grabbing opener” instead of the specified values (`hook`, `context`,
  `main_point`, `cta`, etc.). Add clearer instruction or constrain the vocabulary.
- [ ] Update QA test file (`tests/qa/twitter-thread-manual-test.qa.md`): correct the
  form path from `examples/twitter-thread/...` to
  `packages/markform/examples/twitter-thread/...` (since `pnpm markform` runs from repo
  root), and update verification checklist to reflect that column constraints now
  enforce character limits via validation (not just instructions)
- [ ] Re-run the twitter-thread fill end-to-end to verify column constraints catch
  violations, and that multi-line table cell instructions are followed

## Testing Strategy

**Validation tests** (`tests/unit/engine/validate.test.ts`):

- String column with `maxLength`: value within limit passes, over limit fails
- String column with `minLength`: value within limit passes, under limit fails
- Number column with `min`/`max`: value in range passes, out of range fails
- Number column with `integer`: integer passes, float fails
- Year column with `min`/`max`: value in range passes, out of range fails
- Constraints combined with `required`: empty required cell still fails
- Constraints on non-required column: empty cell passes (no constraint check)

**Parse tests** (`tests/unit/engine/parse.test.ts`,
`tests/unit/engine/parseTable.test.ts`):

- `parseColumnsFromAttributes` extracts constraints from object-form column types
- Constraints with no `required` flag defaults required to false
- Constraints with `required: true` preserves both
- Invalid constraint types (e.g., `minLength` on a number column) are accepted at parse
  time (validation catches mismatches, not the parser)

**Round-trip tests**:

- Parse → serialize → parse preserves all constraints
- Columns with no constraints still serialize to simple string form
- Columns with only `required` use object form (backward compatible)

**JSON Schema tests**:

- Column constraints appear in JSON Schema export
- `min`/`max` map to `minimum`/`maximum`
- `integer` changes `type` from `"number"` to `"integer"`

**Integration test**:

- Re-run twitter-thread fill: `drafts_table` validation should now catch any tweet over
  280 characters via the Markform engine (not just LLM instructions)
- `markform inspect` should show constraint violations if any exist

## Rollout Plan

Single PR. All changes are backward compatible — existing forms without column
constraints continue to work identically.
The only behavioral change is that the twitter-thread form now enforces character
limits.

## Open Questions

- Should we also support `pattern` (regex) on string columns in this phase, or defer?
  (Recommendation: defer — not needed for the immediate use case and can follow the same
  pattern later.)

## References

- Current `TableColumn` interface: `src/engine/coreTypes.ts:139-144`
- `ColumnTypeSpec` type: `src/engine/coreTypes.ts:133`
- `ColumnTypeSpecSchema` Zod schema: `src/engine/coreTypes.ts:1322-1328`
- `TableColumnSchema` Zod schema: `src/engine/coreTypes.ts:1334-1339`
- Column parsing: `src/engine/parseFields.ts:929-991`
- Cell validation: `src/engine/validate.ts:745-844`
- String field validation pattern: `src/engine/validate.ts:94-112`
- Number field validation pattern: `src/engine/validate.ts:165-193`
- Year field validation pattern: `src/engine/validate.ts:700-740`
- Column serialization: `src/engine/serialize.ts:1146-1154`
- JSON Schema column export: `src/engine/jsonSchema.ts:556-582`
- Twitter thread form: `examples/twitter-thread/twitter-thread.form.md`
- Existing table parse tests: `tests/unit/engine/parseTable.test.ts`
- Existing table validation tests: `tests/unit/engine/validate.test.ts:1343+`
- QA test: `tests/qa/twitter-thread-manual-test.qa.md`
