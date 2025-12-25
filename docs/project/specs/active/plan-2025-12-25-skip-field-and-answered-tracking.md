# Plan Spec: Skip Field Operation and Answered/Skipped Tracking

## Purpose

This is a technical design doc for adding explicit field acknowledgment semantics to
markform. Currently, a form is marked "complete" when all required fields are filled, but
optional fields may never be considered by the agent. This feature adds:

1. A `skip_field` patch operation for explicitly acknowledging a field as intentionally
   blank
2. Tracking of "answered" (has value) and "skipped" (explicitly skipped) fields
3. Updated completion semantics: form is complete when `answered + skipped == totalFields`

## Background

**Current Behavior:**

Markform determines form completion based on validation issues:

```typescript
// inspect.ts:90
const isComplete = !filteredIssues.some((i) => i.severity === "required");
```

This means:
- Required fields with no value → severity `"required"` → blocks completion
- Optional fields with no value → severity `"recommended"` → does NOT block completion

**Problem:** When an agent fills a form, the loop may exit as soon as all required fields
are filled. Optional fields may never be considered. There's no way to distinguish:

1. Agent consciously decided to leave field blank
2. Agent never looked at the field (loop exited early)
3. Agent couldn't find information for the field

**Current Progress Counts** (`ProgressCounts` in `coreTypes.ts:377-386`):

```typescript
interface ProgressCounts {
  totalFields: number;
  requiredFields: number;
  submittedFields: number;      // Has a value
  completeFields: number;       // Submitted and valid
  incompleteFields: number;     // Submitted but incomplete (e.g., checkbox partially done)
  invalidFields: number;        // Has validation errors
  emptyRequiredFields: number;  // Required but no value
  emptyOptionalFields: number;  // Optional and no value
}
```

**Gap:** No tracking for "skipped" fields. No completion check that all fields are
accounted for.

**Related Docs:**

- [arch-markform-initial-design.md](../architecture/current/arch-markform-initial-design.md)
- [plan-2025-12-24-programmatic-fill-api.md](plan-2025-12-24-programmatic-fill-api.md)

## Summary of Task

### 1. Add `skip_field` Patch Operation

New patch type that marks a field as explicitly skipped:

```typescript
interface SkipFieldPatch {
  op: "skip_field";
  fieldId: Id;
  reason?: string;  // Optional: "Not applicable", "No information available", etc.
}
```

**Constraints:**
- Can only skip **optional** fields (required fields cannot be skipped)
- Skipping a field clears any existing value
- A skipped field counts toward completion but has no value

### 2. Track Answered and Skipped Fields

**Terminology:**
- **answered** = field has a value (any value, including partial)
- **skipped** = field was explicitly skipped via `skip_field` patch
- **complete** = all fields are either answered or skipped (`answered + skipped == total`)

Add new fields to `FieldProgress`:

```typescript
interface FieldProgress {
  // ... existing fields ...
  skipped: boolean;     // NEW: true if explicitly skipped via skip_field
  skipReason?: string;  // NEW: reason provided in skip_field patch
}
```

Note: "answered" is equivalent to existing `submitted` field.

Add new counts to `ProgressCounts`:

```typescript
interface ProgressCounts {
  // ... existing counts ...
  answeredFields: number;  // NEW: fields with values (same as submittedFields, for clarity)
  skippedFields: number;   // NEW: fields explicitly skipped
}
```

### 3. Update Completion Semantics

A form is complete when **all target-role fields are either answered or skipped**:

```typescript
// New completion check
const answeredCount = progressSummary.counts.answeredFields;
const skippedCount = progressSummary.counts.skippedFields;
const totalTargetFields = targetRoleFields.length;

const allFieldsAccountedFor = (answeredCount + skippedCount) === totalTargetFields;
const noRequiredFieldsEmpty = progressSummary.counts.emptyRequiredFields === 0;

const isComplete = allFieldsAccountedFor && noRequiredFieldsEmpty;
```

This means:
- All required fields must have values (can't skip required)
- All optional fields must be either answered OR skipped
- The agent cannot simply ignore optional fields

### 4. Update Golden Tests

Verify that session transcripts:
- Record `skip_field` patches correctly
- Track `answeredFields` and `skippedFields` counts
- Verify completion is based on answered + skipped == total

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: KEEP DEPRECATED - new fields added to
  `ProgressCounts` and `FieldProgress` with defaults for existing code

- **Library APIs**: KEEP DEPRECATED - `skip_field` is additive; existing patches work

- **Server APIs**: N/A

- **File formats**: SUPPORT BOTH - old form.md files work; new `skip_field` patches are
  optional. Old session.yaml files remain valid.

- **Database schemas**: N/A

**Migration Notes:**

- Existing forms without skip_field patches will work unchanged
- `answeredFields` mirrors `submittedFields` for clarity
- A field with a value is answered (skipped=false)
- A field without a value has neither answered nor skipped status until skip_field is applied

## Stage 1: Planning Stage

### Current State Analysis

**Existing Components:**

| Component | Location | Change Needed |
| --- | --- | --- |
| `ProgressCounts` | `coreTypes.ts:377-386` | Add `answeredFields`, `skippedFields` |
| `FieldProgress` | `coreTypes.ts:366-374` | Add `skipped`, `skipReason` |
| `Patch` union | `coreTypes.ts:470-477` | Add `SkipFieldPatch` |
| `applyPatches()` | `apply.ts` | Handle `skip_field` operation |
| `computeProgressSummary()` | `summaries.ts` | Compute answered/skipped counts |
| `inspect()` | `inspect.ts` | Update isComplete logic |
| Session YAML parser | `session.ts` | Recognize `skip_field` patches |
| Golden test runner | `runner.ts` | Verify new counts |

**Current Patch Types:**

```typescript
type Patch =
  | SetStringPatch
  | SetNumberPatch
  | SetStringListPatch
  | SetCheckboxesPatch
  | SetSingleSelectPatch
  | SetMultiSelectPatch
  | ClearFieldPatch;
```

### Feature Scope

**In Scope:**

- `SkipFieldPatch` type and Zod schema
- `skip_field` handling in `applyPatches()`
- `skipped`, `skipReason` in `FieldProgress`
- `answeredFields`, `skippedFields` in `ProgressCounts`
- Updated completion logic: `answered + skipped == total`
- Golden test updates
- CLI inspect output showing skipped status

**Out of Scope (Explicit Non-Goals):**

- UI changes in web serve mode (deferred)
- Agent prompt changes to teach skip behavior (separate feature)
- Automatic skipping based on heuristics
- "Unskip" operation (can just set a value)

### Acceptance Criteria

1. `skip_field` patch applies successfully to optional fields
2. `skip_field` patch is rejected for required fields with clear error
3. `FieldProgress.skipped` is true only for explicitly skipped fields
4. `ProgressCounts.answeredFields` counts fields with values
5. `ProgressCounts.skippedFields` counts explicitly skipped fields
6. Form is complete when `answered + skipped == totalFields` (for target roles)
7. Form is NOT complete if required fields are empty (even if others skipped)
8. Golden tests verify answered/skipped tracking
9. CLI inspect shows skipped fields distinctly

### Testing Plan

#### 1. Unit Tests: Skip Field Patch (`tests/unit/engine/apply.test.ts`)

**Apply skip_field:**
- [ ] Skipping optional string field sets skipped=true
- [ ] Skipping optional number field sets skipped=true
- [ ] Skipping optional string_list field sets skipped=true
- [ ] Skipping optional single_select field sets skipped=true
- [ ] Skipping optional multi_select field sets skipped=true
- [ ] Skipping optional checkboxes field sets skipped=true

**Reject skip on required:**
- [ ] Skipping required string field returns error
- [ ] Skipping required number field returns error
- [ ] Skipping required checkboxes field returns error

**With reason:**
- [ ] Skip reason is stored in FieldProgress
- [ ] Skip reason is preserved after re-inspect
- [ ] Missing reason defaults to undefined

**Clear then skip:**
- [ ] Skipping field with existing value clears value and sets skipped=true
- [ ] Value is null/empty after skip

**Setting value clears skip:**
- [ ] Setting value on skipped field: skipped becomes false

#### 2. Unit Tests: Progress Computation (`tests/unit/engine/summaries.test.ts`)

**State tracking:**
- [ ] Field with value: submitted=true, skipped=false
- [ ] Skipped field: submitted=false, skipped=true
- [ ] Empty field (not yet answered or skipped): submitted=false, skipped=false

**Counts:**
- [ ] New form has answeredFields=0, skippedFields=0
- [ ] After setting value, answeredFields increments
- [ ] After skip_field, skippedFields increments (not answeredFields)
- [ ] Clearing a value decrements answeredFields
- [ ] Setting value on skipped field: answeredFields++, skippedFields--

#### 3. Unit Tests: Completion Logic (`tests/unit/engine/inspect.test.ts`)

**Basic completion:**
- [ ] Form with optional fields not answered or skipped is NOT complete
- [ ] Form with all fields answered IS complete
- [ ] Form with mix of answered + skipped (totaling all fields) IS complete
- [ ] Form with empty required field is NOT complete (even if optional fields skipped)

**Role-filtered completion:**
- [ ] Only target-role fields count toward completion check
- [ ] Non-target-role fields don't need to be answered or skipped

#### 4. Golden Tests (`tests/golden/`)

**New session file: `examples/simple/simple-with-skips.session.yaml`**
- [ ] Session that uses skip_field for optional_number
- [ ] Verifies skip is recorded in transcript
- [ ] Verifies completion with answered + skipped == total
- [ ] Verifies answeredFields/skippedFields counts

**Update existing session verification:**
- [ ] Verify answeredFields count in turn.after
- [ ] Add skippedFields to turn.after schema

#### 5. Integration Tests

- [ ] CLI inspect shows skipped status for fields
- [ ] MockAgent can generate skip_field patches
- [ ] LiveAgent system prompt describes skip capability (future)

## Stage 2: Architecture Stage

### Type Changes

#### `coreTypes.ts` Additions

```typescript
// New patch type
export interface SkipFieldPatch {
  op: "skip_field";
  fieldId: Id;
  reason?: string;
}

// Update Patch union
export type Patch =
  | SetStringPatch
  | SetNumberPatch
  | SetStringListPatch
  | SetCheckboxesPatch
  | SetSingleSelectPatch
  | SetMultiSelectPatch
  | ClearFieldPatch
  | SkipFieldPatch;  // NEW

// Update FieldProgress
export interface FieldProgress {
  kind: FieldKind;
  required: boolean;
  submitted: boolean;       // Has a value (same as "answered")
  state: ProgressState;
  valid: boolean;
  issueCount: number;
  checkboxProgress?: CheckboxProgressCounts;
  skipped: boolean;         // NEW: explicitly skipped
  skipReason?: string;      // NEW: reason for skip
}

// Update ProgressCounts
export interface ProgressCounts {
  totalFields: number;
  requiredFields: number;
  submittedFields: number;      // Existing: has value
  completeFields: number;
  incompleteFields: number;
  invalidFields: number;
  emptyRequiredFields: number;
  emptyOptionalFields: number;
  answeredFields: number;       // NEW: same as submittedFields (clearer name)
  skippedFields: number;        // NEW: explicitly skipped
}
```

#### Zod Schema Updates

```typescript
export const SkipFieldPatchSchema = z.object({
  op: z.literal("skip_field"),
  fieldId: IdSchema,
  reason: z.string().optional(),
});

export const PatchSchema = z.discriminatedUnion("op", [
  // ... existing patches ...
  SkipFieldPatchSchema,  // NEW
]);
```

### Module Changes

#### `apply.ts`: Handle skip_field

```typescript
function applySkipField(
  form: ParsedForm,
  patch: SkipFieldPatch
): ApplyResult {
  const field = findFieldById(form, patch.fieldId);
  if (!field) {
    return errorResult(`Field not found: ${patch.fieldId}`);
  }

  if (field.required) {
    return errorResult(`Cannot skip required field: ${field.label}`);
  }

  // Clear any existing value
  delete form.valuesByFieldId[patch.fieldId];

  // Track skip in metadata (new: form.skipsByFieldId)
  form.skipsByFieldId ??= {};
  form.skipsByFieldId[patch.fieldId] = {
    skipped: true,
    reason: patch.reason,
  };

  return successResult(form);
}
```

**Skip state storage:** Add `skipsByFieldId: Record<Id, SkipInfo>` to ParsedForm.

```typescript
interface SkipInfo {
  skipped: boolean;
  reason?: string;
}

interface ParsedForm {
  // ... existing fields ...
  skipsByFieldId: Record<Id, SkipInfo>;  // NEW
}
```

**Setting a value clears skip state:**

```typescript
// In applySetString, applySetNumber, etc.
function applySetString(form: ParsedForm, patch: SetStringPatch): ApplyResult {
  // ... existing logic ...

  // Clear skip state if setting a value
  if (form.skipsByFieldId?.[patch.fieldId]) {
    delete form.skipsByFieldId[patch.fieldId];
  }

  return successResult(form);
}
```

#### `summaries.ts`: Compute answered/skipped

```typescript
function computeFieldProgress(
  field: Field,
  value: FieldValue | undefined,
  skipInfo: SkipInfo | undefined,
  issues: InspectIssue[]
): FieldProgress {
  // ... existing logic ...

  const skipped = skipInfo?.skipped ?? false;

  return {
    // ... existing fields ...
    skipped,
    skipReason: skipInfo?.reason,
  };
}

function computeProgressCounts(fields: Record<Id, FieldProgress>): ProgressCounts {
  // ... existing counts ...

  let answeredFields = 0;  // Same as submittedFields
  let skippedFields = 0;

  for (const fp of Object.values(fields)) {
    if (fp.submitted) answeredFields++;
    if (fp.skipped) skippedFields++;
  }

  return {
    // ... existing counts ...
    answeredFields,
    skippedFields,
  };
}
```

#### `inspect.ts`: Update completion logic

```typescript
export function inspect(form: ParsedForm, options: InspectOptions = {}): InspectResult {
  // ... existing logic ...

  // New completion check: answered + skipped == total (for target roles)
  const targetRoleFields = getFieldsForRoles(form, options.targetRoles ?? ["*"]);
  const targetFieldIds = new Set(targetRoleFields.map(f => f.id));

  let targetAnswered = 0;
  let targetSkipped = 0;

  for (const [fieldId, fp] of Object.entries(progressSummary.fields)) {
    if (targetFieldIds.has(fieldId)) {
      if (fp.submitted) targetAnswered++;
      if (fp.skipped) targetSkipped++;
    }
  }

  const allFieldsAccountedFor = (targetAnswered + targetSkipped) === targetRoleFields.length;
  const hasNoRequiredIssues = !filteredIssues.some((i) => i.severity === "required");

  const isComplete = allFieldsAccountedFor && hasNoRequiredIssues;

  return {
    // ... existing fields ...
    isComplete,
  };
}
```

#### `serialize.ts`: No changes needed

Skip state doesn't affect markdown serialization. Skipped fields remain as their
default/empty state in the markdown.

### Session Transcript Changes

Update `SessionTurn.after` to include new counts:

```typescript
interface SessionTurn {
  turn: number;
  inspect: { issues: InspectIssue[] };
  apply: { patches: Patch[] };
  after: {
    requiredIssueCount: number;
    markdownSha256: string;
    answeredFieldCount: number;  // NEW
    skippedFieldCount: number;   // NEW
  };
}
```

Golden tests should verify these counts match expected values.

## Stage 3: Refine Architecture

### Reusable Components

| Component | File | Reuse Strategy |
| --- | --- | --- |
| `findFieldById()` | `valueCoercion.ts` | Use for field lookup in apply |
| `applyPatches()` | `apply.ts` | Extend with skip_field case |
| `PatchSchema` | `coreTypes.ts` | Extend discriminated union |

### Key Design Decisions

1. **answered and skipped are mutually exclusive**: A field with a value is answered; a
   field that was explicitly skipped is skipped; otherwise neither
2. **Skip state storage**: Store in `skipsByFieldId` on ParsedForm, not in values
3. **Skip clears value**: Skipping a field with a value clears it first
4. **Setting value clears skip**: If you set a value on a skipped field, it becomes answered
5. **Required field restriction**: Cannot skip required fields
6. **Completion = answered + skipped == total**: All fields must be accounted for

### Migration Path

**Phase 1: Types and Basic Apply**
- Add types, schemas, and basic apply handling
- Add skip state storage to ParsedForm
- Handle skip_field in applyPatches

**Phase 2: Progress Tracking**
- Add skipped to FieldProgress
- Add answeredFields, skippedFields to ProgressCounts
- Update summaries computation

**Phase 3: Completion Logic**
- Update inspect to check answered + skipped == total
- Add tests for new completion semantics

**Phase 4: Golden Tests and CLI**
- Create new session transcript with skips
- Update CLI inspect output
- Verify end-to-end

**Phase 5: Architecture Documentation**
- Update architecture doc with all changes below

## Architecture Documentation Changes

The following changes need to be made to
`docs/project/architecture/current/arch-markform-initial-design.md`:

### 1. Patch Schema (line ~1764)

Add `skip_field` to the Patch union type:

```ts
type Patch =
  | { op: 'set_string'; fieldId: Id; value: string | null }
  | { op: 'set_number'; fieldId: Id; value: number | null }
  | { op: 'set_string_list'; fieldId: Id; items: string[] }
  | { op: 'set_checkboxes'; fieldId: Id; values: Record<OptionId, CheckboxValue> }
  | { op: 'set_single_select'; fieldId: Id; selected: OptionId | null }
  | { op: 'set_multi_select'; fieldId: Id; selected: OptionId[] }
  | { op: 'clear_field'; fieldId: Id }
  | { op: 'skip_field'; fieldId: Id; reason?: string };  // NEW
```

### 2. Patch Semantics (line ~1789)

Add documentation for `skip_field`:

```
- `skip_field`: Explicitly skip an optional field without providing a value:
  - Can only be applied to optional fields (required fields reject with error)
  - Clears any existing value
  - Marks field as "skipped" in progress tracking
  - Counts toward form completion (answered + skipped == total)
  - Setting a value after skipping clears the skip state
```

### 3. FieldProgress Interface (line ~1026)

Add `skipped` and `skipReason` fields:

```ts
interface FieldProgress {
  kind: FieldKind;
  required: boolean;
  submitted: boolean;          // true if field has a value ("answered")
  state: ProgressState;
  valid: boolean;
  issueCount: number;
  checkboxProgress?: CheckboxProgressCounts;
  skipped: boolean;            // NEW: true if explicitly skipped via skip_field
  skipReason?: string;         // NEW: reason provided in skip_field patch
}
```

### 4. ProgressCounts Interface (line ~1069)

Add `answeredFields` and `skippedFields`:

```ts
interface ProgressCounts {
  totalFields: number;
  requiredFields: number;
  submittedFields: number;       // fields with values
  completeFields: number;
  incompleteFields: number;
  invalidFields: number;
  emptyRequiredFields: number;
  emptyOptionalFields: number;
  answeredFields: number;        // NEW: same as submittedFields (clearer terminology)
  skippedFields: number;         // NEW: fields explicitly skipped
}
```

### 5. ParsedForm Type

Add `skipsByFieldId` to track skip state:

```ts
interface ParsedForm {
  // ... existing fields ...
  skipsByFieldId: Record<Id, SkipInfo>;  // NEW
}

interface SkipInfo {
  skipped: boolean;
  reason?: string;
}
```

### 6. isComplete Definition (lines ~1721, ~1730)

Update the `isComplete` definition from:

> `isComplete: boolean; // true when no issues with severity: 'required'`

To:

> `isComplete: boolean; // true when (answered + skipped == total target-role fields) AND no issues with severity: 'required'`

Add explanation:

```
Form completion now requires two conditions:
1. All target-role fields are either answered (have a value) or skipped
2. No issues with severity 'required' (i.e., required fields must have values)

This ensures agents actively respond to every field, even if just to skip it.
```

### 7. Zod Schemas Section (line ~1208)

Add `SkipFieldPatchSchema`:

```ts
const SkipFieldPatchSchema = z.object({
  op: z.literal('skip_field'),
  fieldId: IdSchema,
  reason: z.string().optional(),
});
```

Update `PatchSchema` to include `SkipFieldPatchSchema` in the discriminated union.

### 8. Design Decisions Section (line ~2809)

Add new design decision:

```
XX. **Skip field semantics** — The `skip_field` patch allows explicitly skipping optional
    fields. Skip state is stored in `skipsByFieldId` on ParsedForm, separate from values.
    Form completion requires `answered + skipped == totalFields` (for target roles),
    ensuring agents actively respond to every field. Required fields cannot be skipped.
```

## Open Questions

### Resolved

1. **Should skip_field clear existing value?**
   - **Decision:** Yes, skipping clears any existing value

2. **Can you "unskip" a field?**
   - **Decision:** Yes, by setting a value (skipped becomes false)

3. **Where to store skip state?**
   - **Decision:** New `skipsByFieldId` record on ParsedForm

4. **Terminology for "has value"?**
   - **Decision:** Use "answered" (clearer than "submitted" or "addressed")

### Deferred

5. **Should agents be prompted to use skip_field?**
   - Deferred to separate feature for agent prompt enhancement

6. **Should skip_field appear in markdown output?**
   - No, skipped fields remain as empty/default in markdown
   - Skip state is runtime metadata, not persisted to file

7. **Should web UI show skip capability?**
   - Deferred to future UI enhancement

## Revision History

| Date | Author | Changes |
| --- | --- | --- |
| 2025-12-25 | Claude | Initial draft based on review discussion |
| 2025-12-25 | Claude | Clarified terminology: answered (has value), skipped (explicitly skipped) |
| 2025-12-25 | Claude | Completion = answered + skipped == totalFields |
| 2025-12-25 | Claude | Added Architecture Documentation Changes section |
