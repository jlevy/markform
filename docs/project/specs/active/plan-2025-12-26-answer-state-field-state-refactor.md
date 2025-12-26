# Plan Spec: AnswerState and FieldState Refactor

## Purpose

This plan refactors the field state model in Markform to use cleaner, more orthogonal
types:

1. **`AnswerState`** replaces `ResponseState` — Renamed with `'empty'` → `'unanswered'`

2. **`FieldState`** replaces `ProgressState` — Two orthogonal booleans (`valid`,
   `empty`) instead of a 4-value enum

3. **`ProgressCounts`** updated — Three orthogonal dimensions for summaries

This simplifies the data model by separating concerns:

- **AnswerState**: What action was taken on a field
  (unanswered/answered/skipped/aborted)

- **FieldState**: Computed validation status (valid/invalid × empty/filled)

## Background

**Current Design:**

The current model has two overlapping state types:

```typescript
type ResponseState = 'empty' | 'answered' | 'skipped' | 'aborted';
type ProgressState = 'empty' | 'incomplete' | 'invalid' | 'complete';
```

Problems:

1. **Confusing overlap**: Both have `'empty'` but mean different things

2. **`ProgressCounts` mixes concepts**: `emptyFields` counts `ResponseState.empty`, not
   `ProgressState.empty`

3. **Redundant `valid` boolean**: `FieldProgress.valid` is always equivalent to `state
   !== 'invalid'`

4. **`ProgressState` conflates dimensions**: Mixes answer status, validity, and
   completeness into one enum

**Related Docs:**

- [arch-markform-initial-design.md](../architecture/current/arch-markform-initial-design.md)
  — Section “Layer 2: Form Data Model”

- [plan-2025-12-26-skip-abort-reason-in-sentinel.md](plan-2025-12-26-skip-abort-reason-in-sentinel.md)
  — Adds `reason?: string` to `FieldResponse` (must be preserved)

- [plan-2025-12-25-unified-response-model-with-notes.md](plan-2025-12-25-unified-response-model-with-notes.md)
  — Parent design this refactors

## Summary of Task

### Type Renames

| Before | After | Change |
| --- | --- | --- |
| `ResponseState` | `AnswerState` | Type rename |
| `'empty'` (in ResponseState) | `'unanswered'` | Value rename for clarity |
| `responseState` (property) | `answerState` | Property rename |
| `ResponseStateSchema` | `AnswerStateSchema` | Zod schema rename |

### Type Replacements

| Before | After | Change |
| --- | --- | --- |
| `ProgressState` enum | Two booleans | Remove enum entirely |
| `FieldProgress.state: ProgressState` | `FieldProgress.valid` + `FieldProgress.empty` | Already has `valid`; add `empty` |
| `formState: ProgressState` | `formValid: boolean` + `formComplete: boolean` | Two booleans at form level |

### ProgressCounts Refactor

**Before (confusing mix):**

```typescript
interface ProgressCounts {
  // These count ResponseState
  answeredFields: number;
  skippedFields: number;
  abortedFields: number;
  emptyFields: number;        // ResponseState.empty (confusing name!)

  // These count ProgressState
  completeFields: number;
  incompleteFields: number;
  invalidFields: number;
}
```

**After (three orthogonal dimensions):**

```typescript
interface ProgressCounts {
  totalFields: number;
  requiredFields: number;

  // Dimension 1: AnswerState (mutually exclusive, sum to totalFields)
  unansweredFields: number;   // renamed from emptyFields
  answeredFields: number;
  skippedFields: number;
  abortedFields: number;

  // Dimension 2: Validity (mutually exclusive, sum to totalFields)
  validFields: number;
  invalidFields: number;

  // Dimension 3: Value presence (mutually exclusive, sum to totalFields)
  emptyFields: number;        // now means "no value" unambiguously
  filledFields: number;

  // Derived counts (unchanged)
  emptyRequiredFields: number;
  totalNotes: number;
}
```

**Removed from ProgressCounts:**

- `completeFields` — redundant (derivable from other counts)

- `incompleteFields` — redundant (derivable from other counts)

- `emptyOptionalFields` — rarely useful

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN — This is a
  simplifying refactor.
  `ResponseState` → `AnswerState`, `ProgressState` removed.

- **Library APIs**: DO NOT MAINTAIN — Types exported from `index.ts` will change.
  Pre-1.0 library, breaking changes acceptable.

- **Server APIs**: N/A

- **File formats**: PARTIAL — The markdown format itself doesn’t change (field
  `state="skipped"` attribute unchanged).
  Only internal type names change.

- **Database schemas**: N/A

## Stage 1: Planning Stage

### Current State Analysis

**Files requiring changes:**

| File | Type Changes | Property Changes | Notes |
| --- | --- | --- | --- |
| `coreTypes.ts` | ResponseState→AnswerState, remove ProgressState | responseState→answerState, remove state, add empty | Core types + Zod schemas |
| `summaries.ts` | ProgressState refs | responseState→answerState, state→valid+empty | computeFieldProgress, computeFormState |
| `apply.ts` | ResponseState refs | responseState→answerState | Patch application |
| `inspect.ts` (engine) | formState type | formState→formValid+formComplete | Inspect result construction |
| `inspect.ts` (CLI) | formatState function | Display logic | CLI display |
| `validate.ts` (CLI) | formatState function | Display logic | CLI display |
| `apply.ts` (CLI) | formatState function | Display logic | CLI display |
| `index.ts` | Export changes | — | Re-export updated types |

**Test files requiring changes:**

| File | Changes |
| --- | --- |
| `coreTypes.test.ts` | Update ResponseStateSchema → AnswerStateSchema tests |

**Documentation requiring changes:**

| File | Sections |
| --- | --- |
| `arch-markform-initial-design.md` | Layer 2 types, ProgressState definitions, terminology |

### Detailed Change Count

Based on grep analysis:

| Pattern | Occurrences | Files |
| --- | --- | --- |
| `ResponseState` (type) | 52 | 6 source files + 1 test |
| `responseState` (property) | ~30 | 7 files |
| `ProgressState` (type) | 56 | 6 source files + 1 test |
| `state: ProgressState` | ~15 | 3 files |
| `formState` (property) | ~20 | 5 files |
| `emptyFields` (count) | ~10 | 2 files |

### Feature Scope

**In Scope:**

1. Rename `ResponseState` → `AnswerState` with `'empty'` → `'unanswered'`

2. Rename `responseState` → `answerState` everywhere

3. Remove `ProgressState` type entirely

4. Update `FieldProgress`:

   - Remove `state: ProgressState`

   - Keep `valid: boolean` (already exists)

   - Add `empty: boolean`

5. Update `ProgressCounts`:

   - Rename `emptyFields` → `unansweredFields` (AnswerState dimension)

   - Add `validFields` (Validity dimension)

   - Add new `emptyFields` + `filledFields` (Value dimension)

   - Remove `completeFields`, `incompleteFields`, `emptyOptionalFields`

6. Update `InspectResult` and `ApplyResult`:

   - Replace `formState: ProgressState` with `formValid: boolean` + `formComplete:
     boolean`

7. Update Zod schemas for all changed types

8. Update CLI display functions

9. Update architecture documentation

**Out of Scope:**

- Markdown file format changes (no changes needed)

- Note system changes (unchanged)

- Patch types (unchanged, still use `skip_field`, `abort_field`)

- Field kinds or option types

### Acceptance Criteria

**Type renames:**

1. `AnswerState` type exported with values `'unanswered' | 'answered' | 'skipped' |
   'aborted'`

2. `AnswerStateSchema` Zod schema validates correctly

3. All `responseState` properties renamed to `answerState`

4. No references to `ResponseState` remain in codebase

**ProgressState removal:**

5. No references to `ProgressState` remain in codebase

6. `FieldProgress` has `valid: boolean` and `empty: boolean`, no `state` property

7. `InspectResult` has `formValid: boolean` and `formComplete: boolean`

8. `ApplyResult` has `formValid: boolean` and `formComplete: boolean`

**ProgressCounts refactor:**

9. `ProgressCounts.unansweredFields` counts fields with `answerState === 'unanswered'`

10. `ProgressCounts.emptyFields` counts fields with no value (different from unanswered)

11. `ProgressCounts.validFields` + `invalidFields` sum to `totalFields`

12. `ProgressCounts.emptyFields` + `filledFields` sum to `totalFields`

**Computation correctness:**

13. `formComplete` = all required fields answered + no aborted fields + no invalid
    fields

14. `formValid` = no invalid fields (all validation passes)

15. Field `empty` = no value present (regardless of answer state)

16. Field `valid` = no validation issues for this field

**CLI display:**

17. `markform inspect` displays updated field states correctly

18. `markform validate` displays form status correctly

19. `markform apply` displays result correctly

## Stage 2: Architecture Stage

### New Type Definitions

**AnswerState (replaces ResponseState):**

```typescript
/**
 * Answer state for a field.
 * What action was taken: no answer yet, answered, skipped, or aborted.
 */
export type AnswerState = "unanswered" | "answered" | "skipped" | "aborted";

export const AnswerStateSchema = z.enum(["unanswered", "answered", "skipped", "aborted"]);
```

**FieldResponse (updated):**

```typescript
/**
 * Field response: combines answer state with optional value.
 */
export interface FieldResponse {
  state: AnswerState;          // renamed from ResponseState
  value?: FieldValue;          // present only when state === 'answered'
  reason?: string;             // present when state === 'skipped' or 'aborted'
}

export const FieldResponseSchema = z.object({
  state: AnswerStateSchema,
  value: FieldValueSchema.optional(),
  reason: z.string().optional(),
});
```

**FieldProgress (updated):**

```typescript
/**
 * Field progress tracking.
 * Combines static schema info with computed validation state.
 */
export interface FieldProgress {
  kind: FieldKind;
  required: boolean;
  answerState: AnswerState;    // renamed from responseState
  hasNotes: boolean;
  noteCount: number;
  valid: boolean;              // kept: no validation issues
  empty: boolean;              // NEW: no value present
  issueCount: number;
  checkboxProgress?: CheckboxProgressCounts;
}

export const FieldProgressSchema = z.object({
  kind: FieldKindSchema,
  required: z.boolean(),
  answerState: AnswerStateSchema,
  hasNotes: z.boolean(),
  noteCount: z.number().int().nonnegative(),
  valid: z.boolean(),
  empty: z.boolean(),
  issueCount: z.number().int().nonnegative(),
  checkboxProgress: CheckboxProgressCountsSchema.optional(),
});
```

**ProgressCounts (refactored):**

```typescript
/**
 * Progress counts rollup.
 * Three orthogonal dimensions: answer state, validity, value presence.
 */
export interface ProgressCounts {
  totalFields: number;
  requiredFields: number;

  // Dimension 1: AnswerState (mutually exclusive, sum to totalFields)
  unansweredFields: number;
  answeredFields: number;
  skippedFields: number;
  abortedFields: number;

  // Dimension 2: Validity (mutually exclusive, sum to totalFields)
  validFields: number;
  invalidFields: number;

  // Dimension 3: Value presence (mutually exclusive, sum to totalFields)
  emptyFields: number;
  filledFields: number;

  // Derived counts
  emptyRequiredFields: number;
  totalNotes: number;
}

export const ProgressCountsSchema = z.object({
  totalFields: z.number().int().nonnegative(),
  requiredFields: z.number().int().nonnegative(),
  // AnswerState dimension
  unansweredFields: z.number().int().nonnegative(),
  answeredFields: z.number().int().nonnegative(),
  skippedFields: z.number().int().nonnegative(),
  abortedFields: z.number().int().nonnegative(),
  // Validity dimension
  validFields: z.number().int().nonnegative(),
  invalidFields: z.number().int().nonnegative(),
  // Value dimension
  emptyFields: z.number().int().nonnegative(),
  filledFields: z.number().int().nonnegative(),
  // Derived
  emptyRequiredFields: z.number().int().nonnegative(),
  totalNotes: z.number().int().nonnegative(),
});
```

**InspectResult / ApplyResult (updated):**

```typescript
export interface InspectResult {
  structureSummary: StructureSummary;
  progressSummary: ProgressSummary;
  issues: InspectIssue[];
  isComplete: boolean;
  formValid: boolean;          // NEW: replaces formState
  formComplete: boolean;       // NEW: replaces formState
}

export interface ApplyResult {
  applyStatus: "applied" | "rejected";
  structureSummary: StructureSummary;
  progressSummary: ProgressSummary;
  issues: InspectIssue[];
  isComplete: boolean;
  formValid: boolean;          // NEW: replaces formState
  formComplete: boolean;       // NEW: replaces formState
}
```

### Computation Logic Changes

**computeFieldProgress (summaries.ts):**

```typescript
function computeFieldProgress(
  field: Field,
  response: FieldResponse,
  notes: Note[],
  issues: InspectIssue[]
): FieldProgress {
  const fieldIssues = issues.filter((i) => i.ref === field.id);
  const issueCount = fieldIssues.length;
  const valid = issueCount === 0;

  // Compute empty: no value present
  const empty = !isFieldSubmitted(field, response.value);

  const fieldNotes = notes.filter((n) => n.ref === field.id);

  return {
    kind: field.kind,
    required: field.required,
    answerState: response.state,   // renamed
    hasNotes: fieldNotes.length > 0,
    noteCount: fieldNotes.length,
    valid,
    empty,                          // NEW
    issueCount,
    checkboxProgress: field.kind === "checkboxes"
      ? computeCheckboxProgress(field, response.value as CheckboxesValue | undefined)
      : undefined,
  };
}
```

**computeProgressCounts (summaries.ts):**

```typescript
function computeProgressCounts(
  fields: Record<Id, FieldProgress>,
  schema: FormSchema,
  notes: Note[]
): ProgressCounts {
  const counts: ProgressCounts = {
    totalFields: 0,
    requiredFields: 0,
    // AnswerState dimension
    unansweredFields: 0,
    answeredFields: 0,
    skippedFields: 0,
    abortedFields: 0,
    // Validity dimension
    validFields: 0,
    invalidFields: 0,
    // Value dimension
    emptyFields: 0,
    filledFields: 0,
    // Derived
    emptyRequiredFields: 0,
    totalNotes: notes.length,
  };

  for (const fieldId of Object.keys(fields)) {
    const progress = fields[fieldId];
    counts.totalFields++;

    if (progress.required) counts.requiredFields++;

    // AnswerState dimension
    switch (progress.answerState) {
      case "unanswered": counts.unansweredFields++; break;
      case "answered": counts.answeredFields++; break;
      case "skipped": counts.skippedFields++; break;
      case "aborted": counts.abortedFields++; break;
    }

    // Validity dimension
    if (progress.valid) {
      counts.validFields++;
    } else {
      counts.invalidFields++;
    }

    // Value dimension
    if (progress.empty) {
      counts.emptyFields++;
      if (progress.required) counts.emptyRequiredFields++;
    } else {
      counts.filledFields++;
    }
  }

  return counts;
}
```

**computeFormStatus (new function in summaries.ts):**

```typescript
/**
 * Compute form-level validity and completion status.
 */
export function computeFormStatus(counts: ProgressCounts): {
  formValid: boolean;
  formComplete: boolean;
} {
  // Form is valid if no fields have validation issues
  const formValid = counts.invalidFields === 0;

  // Form is complete if:
  // 1. No aborted fields (aborted blocks completion)
  // 2. No unanswered required fields
  // 3. No invalid fields
  const formComplete =
    counts.abortedFields === 0 &&
    counts.emptyRequiredFields === 0 &&
    counts.invalidFields === 0;

  return { formValid, formComplete };
}
```

### CLI Display Changes

**Format functions (inspect.ts, validate.ts, apply.ts):**

```typescript
// Remove formatState for ProgressState
// Update to show formValid/formComplete

function formatFormStatus(
  formValid: boolean,
  formComplete: boolean,
  useColors: boolean
): string {
  if (formComplete) {
    return useColors ? pc.green("✓ complete") : "complete";
  }
  if (!formValid) {
    return useColors ? pc.red("✗ invalid") : "invalid";
  }
  return useColors ? pc.yellow("○ incomplete") : "incomplete";
}

function formatFieldState(
  answerState: AnswerState,
  valid: boolean,
  empty: boolean,
  useColors: boolean
): string {
  // Display logic based on answer state + validity
  if (answerState === "skipped") {
    return useColors ? pc.dim("⊘ skipped") : "skipped";
  }
  if (answerState === "aborted") {
    return useColors ? pc.red("⊗ aborted") : "aborted";
  }
  if (!valid) {
    return useColors ? pc.red("✗ invalid") : "invalid";
  }
  if (empty) {
    return useColors ? pc.dim("◌ empty") : "empty";
  }
  return useColors ? pc.green("✓ filled") : "filled";
}
```

## Stage 3: Refine Architecture

### Simplifications Achieved

| Before | After | Benefit |
| --- | --- | --- |
| `ResponseState` with `'empty'` | `AnswerState` with `'unanswered'` | No confusion with value emptiness |
| `ProgressState` 4-value enum | `valid` + `empty` booleans | Orthogonal, no conflation |
| `formState: ProgressState` | `formValid` + `formComplete` | Clear semantics |
| Mixed counts in `ProgressCounts` | Three orthogonal dimensions | Easy to understand and verify |
| `FieldProgress.state` + `valid` | Just `valid` + `empty` | No redundancy |

### Code Impact Summary

**Types removed:**

- `ProgressState` type

- `ProgressStateSchema` Zod schema

- `computeFieldState()` function (no longer needed)

- `computeFormState()` function (replaced with `computeFormStatus()`)

**Types renamed:**

- `ResponseState` → `AnswerState`

- `ResponseStateSchema` → `AnswerStateSchema`

- `responseState` → `answerState` (property)

- `emptyFields` → `unansweredFields` (in ProgressCounts, for answer dimension)

**Types added:**

- `ProgressCounts.validFields`

- `ProgressCounts.emptyFields` (new meaning: value dimension)

- `ProgressCounts.filledFields`

- `FieldProgress.empty`

- `InspectResult.formValid`

- `InspectResult.formComplete`

- `ApplyResult.formValid`

- `ApplyResult.formComplete`

**Types removed from ProgressCounts:**

- `completeFields` (derivable)

- `incompleteFields` (derivable)

- `emptyOptionalFields` (rarely used)

### Testing Strategy

**Unit tests to update:**

1. `coreTypes.test.ts` — Update schema validation tests

**Unit tests to add:**

1. `AnswerStateSchema` validates all four values

2. `ProgressCounts` three dimensions sum correctly

3. `computeFormStatus` returns correct values for edge cases

4. Field `empty` computed correctly for all field kinds

**Integration tests:**

1. `markform inspect` shows correct status for various form states

2. Round-trip: parse → modify → serialize → parse preserves state

### Migration Notes

Since this is a pre-1.0 library with no external callers yet, no migration path is
needed. All changes are internal refactoring.

If any specs depend on the old type names, they should be updated to use the new names.

## Architecture Documentation Changes

### Updates Required

1. **Terminology section (~lines 248-286):**

   - Add `AnswerState` definition

   - Add `FieldState` concept (valid + empty booleans)

   - Remove `ResponseState` from terminology

   - Update `ProgressState` entry or remove

2. **Layer 2: Form Data Model (~lines 1269-1508):**

   - Rename all `ResponseState` → `AnswerState`

   - Rename `'empty'` → `'unanswered'` in AnswerState values

   - Update `FieldResponse` interface

   - Update `FieldProgress` interface (remove `state`, add `empty`)

   - Update `ProgressCounts` with three dimensions

   - Remove `ProgressState` type entirely

3. **Layer 2: Zod schemas (~lines 1800-1900):**

   - Rename `ResponseStateSchema` → `AnswerStateSchema`

   - Remove `ProgressStateSchema`

   - Update `FieldProgressSchema`

   - Update `ProgressCountsSchema`

4. **ProgressState Definitions section (~lines 1634-1780):**

   - Replace with “Field State Computation” section

   - Document `valid` and `empty` boolean computation

   - Document `formValid` and `formComplete` computation

5. **InspectResult/ApplyResult (~lines 2476-2530):**

   - Update to show `formValid` and `formComplete` instead of `formState`

## Open Questions

### Resolved

1. **Should we keep `formState` as a convenience enum?**

   - **Decision:** No. Use `formValid` + `formComplete` booleans for consistency with
     field-level design. Consumers can derive a display string if needed.

2. **What replaces `completeFields` and `incompleteFields` counts?**

   - **Decision:** Remove them.
     They’re derivable:

     - `completeFields` ≈ `filledFields` where `valid && !aborted`

     - `incompleteFields` = fields that are `answered` but not `valid`

     - If needed, add back later with clearer names

3. **Should `emptyOptionalFields` be kept?**

   - **Decision:** Remove.
     Rarely used. Can be computed as `emptyFields - emptyRequiredFields` if needed.

### Deferred

None — this is a straightforward type refactor.

## Revision History

| Date | Author | Changes |
| --- | --- | --- |
| 2025-12-26 | Claude | Initial draft based on architecture review discussion |
