---
title: Table Row Validation — Empty Row Dropping, Cell-Level Warnings, and minRows/maxRows Enforcement
description: >
  Strengthen table field validation by dropping fully-empty rows on normalization,
  adding warnings for mostly-empty rows, and ensuring minRows/maxRows count only
  substantive rows.
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Table Row Validation — Empty Row Dropping, Cell-Level Warnings, and minRows/maxRows Enforcement

**Date:** 2026-02-20 (last updated 2026-02-20)

**Author:** Claude (with Joshua Levy)

**Status:** Draft

## Overview

Table fields currently have no distinction between substantive rows and fully-empty
rows. A row where every cell is `skipped` (empty) counts toward `minRows`, appears in
progress summaries as "submitted" data, and persists through serialization. This creates
several problems:

1. **Empty rows satisfy `minRows`:** A table with `minRows=5` that contains 5 all-empty
   rows passes validation, even though no data was actually provided.

2. **No warning for mostly-empty rows:** A row with one cell filled and four cells empty
   silently passes, even when this likely indicates the agent skipped required work.

3. **Template/placeholder rows are indistinguishable from real data:** Forms that
   include sample rows have no way to signal that those rows should be replaced.

This spec addresses all three problems through three complementary changes:

- **A: Drop fully-empty rows on normalization** — rows where every cell is
  `skipped`/empty are silently dropped, as if they were never there.

- **B: Warn on mostly-empty rows** — rows with data in some cells but many empty cells
  produce a validation warning suggesting more stringent constraints.

- **D: Strengthen minRows/maxRows validation** — ensure these constraints count only
  substantive (non-empty) rows, and that all required validation paths exist.

## Goals

- Fully-empty table rows are dropped during normalization (parse and patch apply),
  making them invisible to validation, progress, and serialization
- Validation produces a warning when a non-empty row has the majority of its cells
  empty (i.e., strictly more than half of cells are empty in a row that has some data)
- `minRows` and `maxRows` constraints count only substantive rows (rows with at least
  one answered cell)
- `isFieldSubmitted()` in progress computation correctly treats tables with only
  empty rows as not submitted
- All changes are backward compatible — existing forms continue to work; empty rows
  that were previously serialized as `%SKIP%` rows are simply dropped on re-parse
- Representative example forms exercise all validation paths
- Full TDD coverage for all behavior changes

## Non-Goals

- Adding a `placeholderRows` attribute to the spec (deferred; the empty-row dropping
  plus `minRows` covers the common case without new syntax)
- Changing the `placeholder` attribute to work on table fields (placeholder is a UI
  hint for text-entry fields; tables are structurally different)
- Per-row metadata or annotations (e.g., "this row is an example")
- Changes to the table editing UI or patch API
- Changing how `%SKIP%` sentinels work at the cell level

## Background

### Current Behavior

**Empty cell parsing** (`src/engine/table/parseTable.ts:82-87`):
An empty/whitespace cell returns `{ state: 'skipped' }`.

**Row parsing** (`src/engine/table/parseTable.ts:299-314`):
All rows are parsed, including rows where every cell is empty. These produce rows where
every cell has `state: 'skipped'`.

**Table validation** (`src/engine/validate.ts:981-1028`):
- `isEmpty` check (line 986): `!value || rows.length === 0` — counts all rows,
  including all-empty ones.
- `minRows` (line 1003): `rows.length < field.minRows` — counts all rows.
- `maxRows` (line 1013): `rows.length > field.maxRows` — counts all rows.
- Per-row validation (line 1023): validates each row including all-empty ones.

**Progress computation** (`src/engine/summaries.ts:196-199`):
```typescript
case 'table': {
  const v = value as TableValue;
  return (v.rows?.length ?? 0) > 0;
}
```
A table with any rows (including all-empty ones) is considered "submitted."

**Patch application** (`src/engine/apply.ts:635-682`):
- `set_table` (lines 635-650) and `append_table` (lines 653-670) create rows from
  patch data without filtering empties.
- `delete_table` (lines 673-682) correctly handles the last-row case (sets state to
  `unanswered` at line 678).

### The Problem in Practice

Consider a form with `minRows=5`:

```md
| Name | Score | Notes |
|------|-------|-------|
|      |       |       |
|      |       |       |
|      |       |       |
|      |       |       |
|      |       |       |
```

This passes `minRows=5` validation today, but contains zero useful data. An agent that
outputs this has satisfied the letter of the constraint but not the intent.

Similarly, a partially-filled table:

```md
| Name | Score | Notes |
|------|-------|-------|
| Alice | 95   |       |
|       |      |       |
|       |      |       |
```

Has 3 rows by count, but only 1 row with any data. The 2 empty rows inflate the count
and mask the fact that the agent stopped filling after the first row.

## Design

### A: Drop Fully-Empty Rows on Normalization

**Definition:** A "fully-empty row" is one where every cell has `state: 'skipped'`
(or equivalently, every cell value is empty/undefined after parsing).

**Where to drop:**

1. **At parse time** — in `parseMarkdownTable()` (`src/engine/table/parseTable.ts`),
   after parsing all rows, filter out any row where every cell is `skipped`. This
   means the parsed `TableValue` never contains fully-empty rows.

2. **At patch apply time** — in the `set_table` and `append_table` handlers in
   `apply.ts`, filter out fully-empty rows from the resulting row array. This handles
   the case where an agent sends a patch with empty rows.

**Helper function:**

```typescript
/**
 * Check if a table row is fully empty (all cells skipped/empty).
 * Used during normalization to drop rows that carry no data.
 */
export function isRowFullyEmpty(row: TableRowResponse): boolean {
  return Object.values(row).every((cell) =>
    !cell || cell.state === 'skipped' || cell.state === 'aborted'
    || cell.value === undefined || cell.value === null || cell.value === '',
  );
}
```

This checks all cell entries in the row object rather than requiring a `columns`
parameter. This is simpler and sufficient because the row object only contains entries
for known column IDs (set during parsing or patch application).

**Behavioral impact:**
- A template form with header + separator + 3 empty rows parses as a table with 0 rows
- Serialization of that table produces header + separator only (no empty data rows)
- `minRows` checks see the true count of substantive rows
- Progress computation sees the table as empty (not submitted)

### B: Warn on Mostly-Empty Rows

**Definition:** A "mostly-empty row" is one that has at least one answered cell, but
strictly more than half of its cells are empty/skipped.

**Where to warn:** In `validateTableRow()` (`src/engine/validate.ts`), after
validating individual cells, check whether the row is mostly empty. If so, emit a
`warning`-severity issue.

**Warning message:**

```
Row N of "TABLE_LABEL" has most cells empty (M of K filled).
Consider adding column constraints or making columns required.
```

**Severity:** `warning` (not `error`). This is advisory — a form author may
intentionally have sparse rows (e.g., an "optional notes" column). The warning helps
catch cases where an agent is producing low-quality output.

**Threshold:** Strictly more than half of cells are empty in a row that has at least
one filled cell. Formally: `emptyCells > totalCells / 2`. This means an even split
(e.g., 2 of 4 filled) does NOT warn. This avoids warning on fully-empty rows (those
are dropped by normalization) and on rows that are half-filled or more.

### D: Strengthen minRows/maxRows Validation

Since fully-empty rows are dropped during normalization (Part A), the `minRows` and
`maxRows` checks in `validateTableField()` will automatically count only substantive
rows. No additional filtering is needed in the validator itself — the normalization
layer guarantees that `rows.length` reflects substantive rows.

**Changes needed in `validateTableField()`:**
- None for the `minRows`/`maxRows` logic itself (it already uses `rows.length`).
- The `isEmpty` check (`!value || rows.length === 0`) continues to work correctly
  because normalization ensures that a table with only empty rows has `rows: []`.

**Changes needed in `isFieldSubmitted()`** (`src/engine/summaries.ts:196-199`):
- No change needed — after normalization, `rows.length > 0` correctly means the table
  has substantive data.

**Documentation:** The spec and reference docs should clarify that `minRows` and
`maxRows` count only rows with at least one non-empty cell.

## Components

**Files to modify:**

| File | Change |
| --- | --- |
| `src/engine/table/parseTable.ts` | Add `isRowFullyEmpty()` helper; filter empty rows in `parseMarkdownTable()` |
| `src/engine/apply.ts` | Filter empty rows in `set_table` and `append_table` patch handlers |
| `src/engine/validate.ts` | Add mostly-empty row warning in `validateTableRow()` |
| `docs/markform-spec.md` | Clarify empty row dropping, minRows/maxRows semantics |
| `docs/markform-reference.md` | Update table field docs |
| `tests/unit/engine/parseTable.test.ts` | Tests for empty row dropping at parse time |
| `tests/unit/engine/apply.test.ts` | Tests for empty row dropping at patch apply time |
| `tests/unit/engine/validate.test.ts` | Tests for mostly-empty row warnings, minRows with empty rows |
| `tests/unit/engine/summaries.test.ts` | Tests for progress computation with empty rows |

## Implementation Plan

### Phase 1: Documentation Updates

Update the Markform spec and reference docs to define the new behavior before
implementing it. This establishes the contract that code and tests will be written
against.

- [ ] **`docs/markform-spec.md`** — Table Fields section (lines 446-501):
  - After the `minRows`/`maxRows` attribute rows (line 460), add a new paragraph:
    > **Empty row handling:** Fully-empty rows (where every cell is empty or skipped)
    > are silently dropped during normalization. They are never counted toward
    > `minRows`/`maxRows` and do not appear in parsed output. A row with at least one
    > non-empty cell is retained.
  - Update the `minRows` description (line 459) from "Minimum row count" to
    "Minimum number of non-empty rows"
  - Update the `maxRows` description (line 460) from "Maximum row count" to
    "Maximum number of non-empty rows"
  - Add a new "Validation warnings" note after the per-column constraints table
    (after line 489):
    > **Row sparseness warning:** When a non-empty row has the majority of its cells
    > empty (strictly more than half), a validation warning is emitted. This helps
    > catch cases where an agent produced sparse or incomplete data.

- [ ] **`docs/markform-reference.md`** — Table field section (lines 413-456):
  - Same updates as above:
    - Update `minRows` description (line 418) to "Minimum number of non-empty rows"
    - Update `maxRows` description (line 419) to "Maximum number of non-empty rows"
    - Add empty row handling note after the attributes table (after line 419)
    - Add row sparseness warning note after the per-column constraints table
      (after line 446)

### Phase 2: Empty Row Dropping (TDD)

Tests first, then implementation.

**Tests to write:**
- [ ] `parseTable.test.ts`: table with all-empty rows → parsed as 0 rows
- [ ] `parseTable.test.ts`: table with mix of empty and filled rows → only filled rows
  retained
- [ ] `parseTable.test.ts`: table with rows where all cells are `%SKIP%` → dropped
- [ ] `parseTable.test.ts`: table with one cell filled in a row → row retained
- [ ] `apply.test.ts`: `set_table` patch with empty rows → empty rows filtered out
- [ ] `apply.test.ts`: `append_table` patch with empty rows → empty rows filtered out
- [ ] `apply.test.ts`: `set_table` with all-empty rows → table state becomes
  `unanswered`
- [ ] Round-trip: parse form with empty rows → serialize → re-parse → same result
  (no empty rows)

**Implementation — `src/engine/table/parseTable.ts`:**

- [ ] Add exported `isRowFullyEmpty()` helper (after line 137, before
  `parseMarkdownTable`):
  ```typescript
  /**
   * Check if a table row is fully empty (all cells skipped/empty).
   * Used during normalization to drop rows that carry no data.
   */
  export function isRowFullyEmpty(row: TableRowResponse): boolean {
    return Object.values(row).every((cell) =>
      !cell || cell.state === 'skipped' || cell.state === 'aborted'
      || cell.value === undefined || cell.value === null || cell.value === '',
    );
  }
  ```
  Note: This checks all cell entries in the row object rather than requiring a
  `columns` parameter. This is simpler and sufficient because the row object only
  contains entries for known column IDs (set during parsing or patch application).

- [ ] In `parseMarkdownTable()`, **positional path** (lines 298-314): after the
  for-loop builds `rows` (line 312), filter before returning:
  ```typescript
  // Current (line 311-314):
  rows.push(row);
  }
  return { ok: true, value: { kind: 'table', rows } };

  // New:
  rows.push(row);
  }
  const substantiveRows = rows.filter((r) => !isRowFullyEmpty(r));
  return { ok: true, value: { kind: 'table', rows: substantiveRows } };
  ```

- [ ] In `parseMarkdownTable()`, **header-based path** (lines 330-347): same filter
  before returning:
  ```typescript
  // Current (line 344-347):
  rows.push(row);
  }
  return { ok: true, value: { kind: 'table', rows } };

  // New:
  rows.push(row);
  }
  const substantiveRows = rows.filter((r) => !isRowFullyEmpty(r));
  return { ok: true, value: { kind: 'table', rows: substantiveRows } };
  ```

**Implementation — `src/engine/apply.ts`:**

- [ ] Add import of `isRowFullyEmpty` from `./table/parseTable.js` (line 29, after
  existing imports):
  ```typescript
  import { isRowFullyEmpty } from './table/parseTable.js';
  ```

- [ ] In `set_table` handler (lines 635-650): after building `rows` (line 644), filter
  empty rows and handle the all-empty edge case:
  ```typescript
  // Current (lines 644-649):
  return row;
  });
  responses[patch.fieldId] = {
    state: 'answered',
    value: { kind: 'table', rows } as TableValue,
  };

  // New:
  return row;
  });
  const substantiveRows = rows.filter((r) => !isRowFullyEmpty(r));
  responses[patch.fieldId] = {
    state: substantiveRows.length > 0 ? 'answered' : 'unanswered',
    ...(substantiveRows.length > 0 && {
      value: { kind: 'table', rows: substantiveRows } as TableValue,
    }),
  };
  ```
  Note: the `unanswered` edge case mirrors the existing pattern in `delete_table`
  (line 678).

- [ ] In `append_table` handler (lines 653-670): after building combined rows
  (line 667), filter empty rows:
  ```typescript
  // Current (lines 664-669):
  return row;
  });
  responses[patch.fieldId] = {
    state: 'answered',
    value: { kind: 'table', rows: [...currentRows, ...newRows] } as TableValue,
  };

  // New:
  return row;
  });
  const allRows = [...currentRows, ...newRows].filter((r) => !isRowFullyEmpty(r));
  responses[patch.fieldId] = {
    state: allRows.length > 0 ? 'answered' : 'unanswered',
    ...(allRows.length > 0 && {
      value: { kind: 'table', rows: allRows } as TableValue,
    }),
  };
  ```

### Phase 3: Mostly-Empty Row Warnings (TDD)

Tests first, then implementation.

**Tests to write:**
- [ ] `validate.test.ts`: row with 1 of 4 cells filled → warning (3/4 empty > half)
- [ ] `validate.test.ts`: row with 2 of 4 cells filled → no warning (even split, not
  strict majority)
- [ ] `validate.test.ts`: row with 3 of 4 cells filled → no warning
- [ ] `validate.test.ts`: row with all cells filled → no warning
- [ ] `validate.test.ts`: row with 1 of 3 cells filled → warning (2/3 empty > half)
- [ ] `validate.test.ts`: row with 1 of 2 cells filled → no warning (1/2 is not
  strictly more than half)
- [ ] `validate.test.ts`: warning message includes row number and field label
- [ ] `validate.test.ts`: warning severity is `warning`, not `error`

**Implementation — `src/engine/validate.ts`:**

- [ ] In `validateTableRow()` (lines 962-976), after the per-cell validation loop
  (line 973), add the sparseness check:
  ```typescript
  function validateTableRow(
    row: TableRowResponse,
    columns: TableColumn[],
    fieldId: string,
    rowIndex: number,
    fieldLabel: string,  // NEW parameter
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const column of columns) {
      const cell = row[column.id] ?? { state: 'skipped' };
      issues.push(...validateCellValue(cell, column, fieldId, rowIndex));
    }

    // NEW: Check for mostly-empty rows
    const totalCells = columns.length;
    const filledCells = columns.filter((col) => {
      const cell = row[col.id];
      return cell && cell.state === 'answered'
        && cell.value !== undefined && cell.value !== null && cell.value !== '';
    }).length;

    if (filledCells > 0 && filledCells < totalCells && (totalCells - filledCells) > totalCells / 2) {
      issues.push({
        severity: 'warning',
        message: `Row ${rowIndex + 1} of "${fieldLabel}" has most cells empty `
          + `(${filledCells} of ${totalCells} filled). `
          + `Consider adding column constraints or making columns required.`,
        ref: `${fieldId}[${rowIndex}]`,
        source: 'builtin',
      });
    }

    return issues;
  }
  ```

- [ ] Update the call site in `validateTableField()` (line 1024) to pass `field.label`:
  ```typescript
  // Current:
  issues.push(...validateTableRow(rows[i]!, field.columns, field.id, i));
  // New:
  issues.push(...validateTableRow(rows[i]!, field.columns, field.id, i, field.label));
  ```

### Phase 4: Verify Example Forms and Run Full Suite

- [ ] Run full test suite to confirm no regressions
- [ ] Run `markform inspect` on twitter-thread and rejection-test example forms
- [ ] Verify that a form with `minRows=3` and only empty rows fails validation
- [ ] Verify that a form with `minRows=3` and 3 filled rows + 2 empty rows passes
  (empty rows dropped, 3 substantive rows remain)

## Testing Strategy

**Unit tests** (TDD — write tests before implementation):

- **Parse tests** (`tests/unit/engine/parseTable.test.ts`): verify empty row dropping
  at parse time across various combinations (all empty, mixed, single-cell filled,
  `%SKIP%` rows)
- **Apply tests** (`tests/unit/engine/apply.test.ts`): verify empty row filtering on
  `set_table` and `append_table` patches, including the all-empty → `unanswered`
  edge case
- **Validation tests** (`tests/unit/engine/validate.test.ts`): verify mostly-empty row
  warnings with various fill ratios, minRows enforcement with empty rows dropped,
  maxRows with empty rows dropped
- **Progress tests** (`tests/unit/engine/summaries.test.ts`): verify
  `isFieldSubmitted()` returns false for tables with only empty rows after
  normalization (this should already pass once parse-time filtering is implemented,
  since the `TableValue` will have `rows: []`)

**Integration tests:**

- Parse a form with a table containing mixed empty/filled rows → inspect → verify
  row count and warnings
- Apply patches that include empty rows → verify they are dropped
- Serialize → re-parse round trip preserves only substantive rows

**Example form testing:**

- Run `markform inspect` on the twitter-thread form and rejection-test form to verify
  no regressions
- Test with a form that has `minRows=3` and only empty rows → should fail validation

## Rollout Plan

Single PR. All changes are backward compatible:
- Forms with no empty rows: zero behavior change.
- Forms with empty rows: rows are silently dropped. This is a behavioral improvement,
  not a breaking change, since empty rows carried no useful information.
- The `warning` for mostly-empty rows is advisory and does not affect form completion
  status.

## Open Questions

None — all design decisions are resolved in this spec.

## References

**Source code (all paths relative to `packages/markform/`):**

- `src/engine/table/parseTable.ts:82-137` — `parseCellValue()`: empty cells → `{ state: 'skipped' }`
- `src/engine/table/parseTable.ts:266-348` — `parseMarkdownTable()`: two parsing paths (positional line 298, header-based line 330)
- `src/engine/validate.ts:745-957` — `validateCellValue()`: per-cell type+constraint checks
- `src/engine/validate.ts:962-976` — `validateTableRow()`: iterates columns, delegates to `validateCellValue()`
- `src/engine/validate.ts:981-1028` — `validateTableField()`: isEmpty (line 986), minRows (line 1003), maxRows (line 1013), row loop (line 1023)
- `src/engine/apply.ts:635-650` — `set_table` patch handler
- `src/engine/apply.ts:653-670` — `append_table` patch handler
- `src/engine/apply.ts:673-682` — `delete_table` patch handler (reference for `unanswered` pattern)
- `src/engine/summaries.ts:196-199` — `isFieldSubmitted()` table case: `(v.rows?.length ?? 0) > 0`
- `src/engine/coreTypes.ts:324-329` — `TableField` interface (has `columns`, `minRows`, `maxRows`)
- `src/engine/coreTypes.ts:478-491` — `CellResponse`, `TableRowResponse`, `TableValue` types

**Documentation:**

- `docs/markform-spec.md:446-501` — Table Fields section (attributes table lines 454-460, column constraints lines 478-489)
- `docs/markform-reference.md:413-456` — Table field reference (attributes table lines 413-419, constraints lines 439-446)

**Related specs and examples:**

- `docs/project/specs/active/plan-2026-02-14-table-column-constraints.md` — Prior spec for per-column constraints
- `packages/markform/examples/twitter-thread/twitter-thread.form.md`
- `packages/markform/examples/rejection-test/rejection-test.form.md`
