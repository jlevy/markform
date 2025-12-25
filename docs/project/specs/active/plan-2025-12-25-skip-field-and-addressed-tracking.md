# Plan Spec: Skip Field Operation and Addressed Field Tracking

## Purpose

This is a technical design doc for adding explicit field acknowledgment semantics to
markform. Currently, a form is marked "complete" when all required fields are filled, but
optional fields may never be addressed by the agent. This feature adds:

1. A `skip_field` patch operation for explicitly acknowledging a field as intentionally
   blank
2. Tracking of "addressed" fields (filled OR skipped) in progress summaries
3. Updated completion semantics where a form is complete when ALL fields are addressed

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

**Gap:** No tracking for "addressed" or "skipped" fields.

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
- Skipping a field marks it as "addressed" even though it has no value
- A skipped field clears any existing value (equivalent to clear + skip)

### 2. Track Addressed Fields in Progress

Add new fields to `FieldProgress`:

```typescript
interface FieldProgress {
  // ... existing fields ...
  addressed: boolean;   // NEW: true if filled OR skipped
  skipped: boolean;     // NEW: true if explicitly skipped via skip_field
  skipReason?: string;  // NEW: reason provided in skip_field patch
}
```

Add new counts to `ProgressCounts`:

```typescript
interface ProgressCounts {
  // ... existing counts ...
  addressedFields: number;  // NEW: fields that have been filled OR skipped
  skippedFields: number;    // NEW: fields explicitly skipped
}
```

### 3. Update Completion Semantics

A form is complete when **all target-role fields are addressed**:

```typescript
// New completion check
const isComplete =
  allTargetRoleFieldsAddressed &&
  noRequiredFieldsEmpty;  // Still can't have empty required fields
```

This means:
- All required fields must have values
- All optional fields must be either filled OR skipped
- The agent cannot simply ignore optional fields

### 4. Update Golden Tests

Verify that session transcripts:
- Record `skip_field` patches correctly
- Track `addressedFields` and `skippedFields` counts
- Verify completion is based on addressed status

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
- New `addressed`/`skipped` fields default to sensible values based on existing data
- A field with a value is considered "addressed" (addressed=true, skipped=false)
- A field without a value is "not addressed" unless skip_field was applied

## Stage 1: Planning Stage

### Current State Analysis

**Existing Components:**

| Component | Location | Change Needed |
| --- | --- | --- |
| `ProgressCounts` | `coreTypes.ts:377-386` | Add `addressedFields`, `skippedFields` |
| `FieldProgress` | `coreTypes.ts:366-374` | Add `addressed`, `skipped`, `skipReason` |
| `Patch` union | `coreTypes.ts:470-477` | Add `SkipFieldPatch` |
| `applyPatches()` | `apply.ts` | Handle `skip_field` operation |
| `computeProgressSummary()` | `summaries.ts` | Compute addressed/skipped counts |
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
- `addressed`, `skipped`, `skipReason` in `FieldProgress`
- `addressedFields`, `skippedFields` in `ProgressCounts`
- Updated completion logic
- Golden test updates
- CLI inspect output showing addressed/skipped status

**Out of Scope (Explicit Non-Goals):**

- UI changes in web serve mode (deferred)
- Agent prompt changes to teach skip behavior (separate feature)
- Automatic skipping based on heuristics
- "Unskip" operation (can just set a value)

### Acceptance Criteria

1. `skip_field` patch applies successfully to optional fields
2. `skip_field` patch is rejected for required fields with clear error
3. `FieldProgress.addressed` is true for fields with values
4. `FieldProgress.addressed` is true for skipped fields
5. `FieldProgress.skipped` is true only for explicitly skipped fields
6. `ProgressCounts.addressedFields` counts filled + skipped fields
7. `ProgressCounts.skippedFields` counts only skipped fields
8. Form is complete when all target-role fields are addressed
9. Golden tests verify addressed/skipped tracking
10. CLI inspect shows skipped fields distinctly

### Testing Plan

#### 1. Unit Tests: Skip Field Patch (`tests/unit/engine/apply.test.ts`)

**Apply skip_field:**
- [ ] Skipping optional string field marks as addressed+skipped
- [ ] Skipping optional number field marks as addressed+skipped
- [ ] Skipping optional string_list field marks as addressed+skipped
- [ ] Skipping optional single_select field marks as addressed+skipped
- [ ] Skipping optional multi_select field marks as addressed+skipped
- [ ] Skipping optional checkboxes field marks as addressed+skipped

**Reject skip on required:**
- [ ] Skipping required string field returns error
- [ ] Skipping required number field returns error
- [ ] Skipping required checkboxes field returns error

**With reason:**
- [ ] Skip reason is stored in FieldProgress
- [ ] Skip reason is preserved after re-inspect
- [ ] Missing reason defaults to undefined

**Clear then skip:**
- [ ] Skipping field with existing value clears and skips
- [ ] Value is null/empty after skip

#### 2. Unit Tests: Progress Computation (`tests/unit/engine/summaries.test.ts`)

**Addressed tracking:**
- [ ] Field with value has addressed=true, skipped=false
- [ ] Skipped field has addressed=true, skipped=true
- [ ] Empty field has addressed=false, skipped=false
- [ ] addressedFields = filledFields + skippedFields

**Counts:**
- [ ] New form has addressedFields=0, skippedFields=0
- [ ] After setting value, addressedFields increments
- [ ] After skip_field, both addressedFields and skippedFields increment
- [ ] Clearing a value decrements addressedFields
- [ ] Setting value on skipped field: addressed=true, skipped=false

#### 3. Unit Tests: Completion Logic (`tests/unit/engine/inspect.test.ts`)

**Basic completion:**
- [ ] Form with unaddressed optional fields is NOT complete
- [ ] Form with all fields addressed (filled or skipped) IS complete
- [ ] Form with empty required field is NOT complete (even if others addressed)

**Role-filtered completion:**
- [ ] Only target-role fields affect completion
- [ ] Non-target-role fields can be unaddressed

#### 4. Golden Tests (`tests/golden/`)

**New session file: `examples/simple/simple-with-skips.session.yaml`**
- [ ] Session that uses skip_field for optional_number
- [ ] Verifies skip is recorded in transcript
- [ ] Verifies completion with skipped field
- [ ] Verifies addressedFields/skippedFields counts

**Update existing session verification:**
- [ ] Verify addressedFields count in turn.after
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
  submitted: boolean;
  state: ProgressState;
  valid: boolean;
  issueCount: number;
  checkboxProgress?: CheckboxProgressCounts;
  addressed: boolean;     // NEW
  skipped: boolean;       // NEW
  skipReason?: string;    // NEW
}

// Update ProgressCounts
export interface ProgressCounts {
  totalFields: number;
  requiredFields: number;
  submittedFields: number;
  completeFields: number;
  incompleteFields: number;
  invalidFields: number;
  emptyRequiredFields: number;
  emptyOptionalFields: number;
  addressedFields: number;  // NEW
  skippedFields: number;    // NEW
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

**Note:** We need to store skip state. Options:

1. **Add `skipsByFieldId` to ParsedForm** - Cleanest, but requires updating parser
2. **Store in value object** - Add `_skipped` field to FieldValue types
3. **Track in separate state** - Pass skip state alongside form

**Recommendation:** Option 1 - Add `skipsByFieldId: Record<Id, SkipInfo>` to ParsedForm.
This keeps skip state separate from values and is easy to reason about.

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

#### `summaries.ts`: Compute addressed/skipped

```typescript
function computeFieldProgress(
  field: Field,
  value: FieldValue | undefined,
  skipInfo: SkipInfo | undefined,
  issues: InspectIssue[]
): FieldProgress {
  // ... existing logic ...

  const skipped = skipInfo?.skipped ?? false;
  const addressed = submitted || skipped;

  return {
    // ... existing fields ...
    addressed,
    skipped,
    skipReason: skipInfo?.reason,
  };
}

function computeProgressCounts(fields: Record<Id, FieldProgress>): ProgressCounts {
  // ... existing counts ...

  let addressedFields = 0;
  let skippedFields = 0;

  for (const fp of Object.values(fields)) {
    if (fp.addressed) addressedFields++;
    if (fp.skipped) skippedFields++;
  }

  return {
    // ... existing counts ...
    addressedFields,
    skippedFields,
  };
}
```

#### `inspect.ts`: Update completion logic

```typescript
export function inspect(form: ParsedForm, options: InspectOptions = {}): InspectResult {
  // ... existing logic ...

  // New completion check: all target-role fields must be addressed
  const targetRoleFields = getFieldsForRoles(form, options.targetRoles ?? ["*"]);
  const allAddressed = targetRoleFields.every(
    (f) => progressSummary.fields[f.id]?.addressed
  );

  const hasNoRequiredIssues = !filteredIssues.some((i) => i.severity === "required");
  const isComplete = allAddressed && hasNoRequiredIssues;

  return {
    // ... existing fields ...
    isComplete,
  };
}
```

#### `serialize.ts`: No changes needed

Skip state doesn't affect markdown serialization. Skipped fields remain as their
default/empty state in the markdown.

#### `session.ts`: Recognize skip_field patches

Update YAML parsing to handle the new patch type. The Zod schema update should handle
this automatically.

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
    addressedFieldCount: number;  // NEW
    skippedFieldCount: number;    // NEW
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

1. **Skip state storage**: Store in `skipsByFieldId` on ParsedForm, not in values
2. **Skip clears value**: Skipping a field with a value clears it first
3. **Required field restriction**: Cannot skip required fields
4. **Addressed = filled OR skipped**: Simple boolean logic
5. **Completion requires all addressed**: Stricter than current behavior

### Migration Path

**Phase 1: Types and Basic Apply**
- Add types, schemas, and basic apply handling
- Add progress tracking
- Update summaries

**Phase 2: Completion Logic**
- Update inspect to use addressed check
- Add tests for new completion semantics

**Phase 3: Golden Tests and CLI**
- Create new session transcript with skips
- Update CLI inspect output
- Verify end-to-end

## Open Questions

### Resolved

1. **Should skip_field clear existing value?**
   - **Decision:** Yes, skipping clears any existing value

2. **Can you "unskip" a field?**
   - **Decision:** Yes, by setting a value (addressed=true, skipped=false)

3. **Where to store skip state?**
   - **Decision:** New `skipsByFieldId` record on ParsedForm

### Deferred

4. **Should agents be prompted to use skip_field?**
   - Deferred to separate feature for agent prompt enhancement

5. **Should skip_field appear in markdown output?**
   - No, skipped fields remain as empty/default in markdown
   - Skip state is runtime metadata, not persisted to file

6. **Should web UI show skip capability?**
   - Deferred to future UI enhancement

## Revision History

| Date | Author | Changes |
| --- | --- | --- |
| 2025-12-25 | Claude | Initial draft based on review discussion |
