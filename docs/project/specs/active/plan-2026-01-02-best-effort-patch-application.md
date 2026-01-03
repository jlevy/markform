# Plan Spec: Best-Effort Patch Application with Value Coercion

## Purpose

This is a technical design doc for changing Markform's patch application semantics from
"all-or-nothing" (transaction semantics) to "best-effort" (apply valid patches, reject
invalid ones) with automatic value coercion for common LLM mistakes. This improves
LLM form-filling efficiency by preserving valid work and gracefully handling type
mismatches.

## Background

Markform is designed for LLM-driven form filling. Currently, patch application uses
transaction semantics: if any patch fails structural validation, the entire batch is
rejected and no patches are applied.

**Current behavior** (from [apply.ts:518](../../packages/markform/src/engine/apply.ts#L518)):

```typescript
// Validate all patches first (transaction semantics)
const errors = validatePatches(form, normalizedPatches);
if (errors.length > 0) {
  return { applyStatus: 'rejected', ... };  // ALL rejected
}
```

**The problem:** LLMs make mistakes. If an agent sends 15 patches and 2 have errors:

- **Current:** All 15 rejected, agent must retry all 15, potentially making new mistakes
- **Proposed:** 13 applied, 2 rejected with clear errors, agent fixes just those 2

Additionally, LLMs often send structurally incorrect but semantically clear values:

```typescript
// LLM sends:
{ op: 'set_string_list', fieldId: 'kpis', value: 'Revenue growth' }

// Should be:
{ op: 'set_string_list', fieldId: 'kpis', value: ['Revenue growth'] }
```

**Why this matters:**

- Transaction semantics wastes tokens, time, and creates Sisyphean retry loops
- Database transactions protect invariants across *related* writes, but form fields are
  mostly independent ("company name" doesn't depend on "revenue")
- Partial form state is normal during filling—it's just "incomplete," not "inconsistent"
- Coerced values are visible to the agent on the next turn, enabling self-correction

## Summary of Task

Change `applyPatches()` to:

1. Validate each patch independently
2. Attempt automatic coercion for common type mismatches
3. Apply all valid patches (including coerced ones)
4. Return detailed feedback: applied, warnings (coerced), and rejected patches
5. Return a new `applyStatus: 'partial'` when some succeed and some fail

The spec should **recommend** best-effort behavior and value coercion but leave
implementation details to implementations. The Markform TypeScript implementation will
default to best-effort with coercion.

## Recommended Value Coercions

The following coercions are **recommended** for LLM-friendly implementations. These are
safe structural transformations that preserve intent while fixing common mistakes.

| Input Type | Target Field Kind | Coercion | Example |
|------------|-------------------|----------|---------|
| Single string | `string_list` | Wrap in array | `'x'` → `['x']` |
| Single URL string | `url_list` | Wrap in array | `'https://...'` → `['https://...']` |
| Single option ID | `multi_select` | Wrap in array | `'opt1'` → `['opt1']` |
| Boolean | `checkboxes` | Convert to state string | `true` → `'done'` or `'yes'` (based on mode) |

**Coercions NOT recommended** (too magical or lossy):

| Coercion | Why Not |
|----------|---------|
| Split string on comma/delimiter | Ambiguous, may corrupt data with commas |
| Array to single value | Information loss |
| String to number | May fail silently on invalid strings |
| Number to string | Loses type safety |

**Convergence principle:** Even if coercion produces a partial result (e.g., `['a']`
when the agent intended `['a', 'b', 'c']`), the agent sees the actual form state on
the next turn and can correct it. This is strictly better than rejection.

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: KEEP DEPRECATED - The `ApplyResult`
  type adds a new `'partial'` status and `warnings` array; existing code checking for
  `'applied'` or `'rejected'` will still work correctly. New fields are additive.

- **Library APIs**: KEEP DEPRECATED - `applyPatches()` signature unchanged. New return
  values are additive. Existing integrations checking `applyStatus === 'applied'` continue
  to work (they just won't see partial successes as success).

- **Server APIs**: N/A - No server APIs affected.

- **File formats**: N/A - Patch format unchanged. Serialized forms unchanged.

- **Database schemas**: N/A - No database.

## Stage 1: Planning Stage

### Current State Analysis

**Files that need changes:**

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/markform/src/engine/coreTypes.ts` | Type update | Add `'partial'` to `ApplyStatus`, add `appliedPatches` and `warnings` to `ApplyResult` |
| `packages/markform/src/engine/apply.ts` | Core logic | Implement best-effort validation, coercion, and application |
| `packages/markform/src/harness/harness.ts` | Integration | Handle partial results, update messaging |
| `packages/markform/src/integrations/vercelAiSdkTools.ts` | Integration | Update description, handle partial status and warnings |
| `docs/markform-spec.md` | Spec update | Change to recommend best-effort and coercion |
| `docs/markform-apis.md` | Doc update | Document new behavior, coercion table, and new fields |
| `packages/markform/tests/unit/engine/apply.test.ts` | Tests | Update existing, add partial and coercion tests |

**Existing coercion precedent** in [apply.ts:91](../../packages/markform/src/engine/apply.ts#L91):

```typescript
function normalizePatch(form: ParsedForm, patch: Patch): Patch {
  // Already coerces boolean → checkbox string
}
```

This pattern will be extended for the new coercions.

### Feature Requirements

**Must Have:**

1. Valid patches applied even when some patches are invalid
2. Clear `applyStatus` distinction: `'applied'` (all), `'partial'` (some), `'rejected'` (none)
3. `appliedPatches` array showing which patches succeeded
4. `rejectedPatches` array with detailed error messages (already exists)
5. `warnings` array for patches that were coerced
6. Automatic coercion: single value → singleton array for list/multi-select fields
7. Spec updated to recommend best-effort and coercion
8. Developer docs updated with coercion table

**Nice to Have:**

1. Optional `strict: true` mode for all-or-nothing behavior (can be added later if needed)

**Not in Scope:**

1. Strict mode implementation (defer until there's demand)
2. Semantic dependency checking between patches (fields are independent)
3. Aggressive coercions (string splitting, type conversions)

### Acceptance Criteria

1. `applyPatches([valid1, invalid1, valid2])` applies valid1 and valid2, rejects invalid1
2. `applyPatches([{op: 'set_string_list', value: 'x'}])` coerces to `['x']` with warning
3. `applyStatus` is `'partial'` when some succeed and some fail
4. `applyStatus` is `'applied'` when all succeed (including coerced)
5. `applyStatus` is `'rejected'` when all fail
6. `appliedPatches` contains the normalized/coerced patches that were applied
7. `warnings` contains details for each coerced patch
8. `rejectedPatches` contains detailed errors for failed patches
9. Form state reflects only the applied patches
10. Spec recommends best-effort and coercion as implementation guidance
11. All existing tests pass or are updated to reflect new behavior

## Stage 2: Architecture Stage

### Type Changes

**In `coreTypes.ts`:**

```typescript
// Current
type ApplyStatus = 'applied' | 'rejected';

// Proposed
type ApplyStatus = 'applied' | 'partial' | 'rejected';

// NEW: Warning for coerced patches
interface PatchWarning {
  patchIndex: number;
  fieldId: string;
  message: string;
  coercion: 'string_to_list' | 'url_to_list' | 'option_to_array' | 'boolean_to_checkbox';
}

// Proposed ApplyResult (additive changes)
interface ApplyResult {
  applyStatus: ApplyStatus;
  structureSummary: StructureSummary;
  progressSummary: ProgressSummary;
  issues: InspectIssue[];
  isComplete: boolean;
  formState: FormState;
  rejectedPatches: PatchRejection[];
  appliedPatches: Patch[];      // NEW: patches that were successfully applied
  warnings: PatchWarning[];     // NEW: patches that were coerced
}
```

### Logic Changes

**In `apply.ts` - extend `normalizePatch()`:**

```typescript
interface NormalizationResult {
  patch: Patch;
  warning?: PatchWarning;
}

function normalizePatch(form: ParsedForm, patch: Patch, index: number): NormalizationResult {
  const field = findField(form, patch.fieldId);
  if (!field) return { patch };  // Let validation handle missing field

  // Existing: boolean → checkbox string coercion
  if (patch.op === 'set_checkboxes' && field.kind === 'checkboxes') {
    // ... existing logic ...
  }

  // NEW: single string → string_list coercion
  if (patch.op === 'set_string_list' && field.kind === 'string_list') {
    if (typeof patch.value === 'string') {
      return {
        patch: { ...patch, value: [patch.value] },
        warning: {
          patchIndex: index,
          fieldId: field.id,
          message: `Coerced single string to string_list`,
          coercion: 'string_to_list',
        },
      };
    }
  }

  // NEW: single URL → url_list coercion
  if (patch.op === 'set_url_list' && field.kind === 'url_list') {
    if (typeof patch.value === 'string') {
      return {
        patch: { ...patch, value: [patch.value] },
        warning: {
          patchIndex: index,
          fieldId: field.id,
          message: `Coerced single URL to url_list`,
          coercion: 'url_to_list',
        },
      };
    }
  }

  // NEW: single option → multi_select coercion
  if (patch.op === 'set_multi_select' && field.kind === 'multi_select') {
    if (typeof patch.value === 'string') {
      return {
        patch: { ...patch, value: [patch.value] },
        warning: {
          patchIndex: index,
          fieldId: field.id,
          message: `Coerced single option ID to multi_select array`,
          coercion: 'option_to_array',
        },
      };
    }
  }

  return { patch };
}
```

**In `apply.ts` - `applyPatches()`:**

```typescript
export function applyPatches(form: ParsedForm, patches: Patch[]): ApplyResult {
  // Normalize patches, collecting warnings
  const normalized: NormalizationResult[] = patches.map((p, i) => normalizePatch(form, p, i));
  const warnings: PatchWarning[] = normalized.filter(r => r.warning).map(r => r.warning!);
  const normalizedPatches = normalized.map(r => r.patch);

  // Validate each patch independently
  const validPatches: Patch[] = [];
  const errors: PatchError[] = [];

  for (let i = 0; i < normalizedPatches.length; i++) {
    const error = validatePatch(form, normalizedPatches[i], i);
    if (error) {
      errors.push(error);
    } else {
      validPatches.push(normalizedPatches[i]);
    }
  }

  // If all failed, return rejected (no changes)
  if (validPatches.length === 0 && errors.length > 0) {
    return {
      applyStatus: 'rejected',
      // ... summaries from current state
      appliedPatches: [],
      rejectedPatches: errors,
      warnings: [],  // No warnings if nothing applied
    };
  }

  // Apply valid patches
  const newResponses = { ...form.responsesByFieldId };
  const newNotes = [...form.notes];
  form.notes = newNotes;

  for (const patch of validPatches) {
    applyPatch(form, newResponses, patch);
  }

  form.responsesByFieldId = newResponses;

  // Compute status
  const applyStatus = errors.length > 0 ? 'partial' : 'applied';

  return {
    applyStatus,
    // ... summaries from new state
    appliedPatches: validPatches,
    rejectedPatches: errors,
    warnings,  // Include coercion warnings
  };
}
```

### Integration Updates

**In `harness.ts`:**

```typescript
const patchesActuallyApplied = applyResult.appliedPatches.length;
// Log warnings for debugging
if (applyResult.warnings.length > 0) {
  // Could log or include in step result
}
```

**In `vercelAiSdkTools.ts`:**

Update tool description:

```typescript
'Apply patches to update form field values. Valid patches are applied even if some fail. ' +
'Single values are automatically coerced to arrays for list fields. ' +
'Returns applied patches, warnings for coerced values, and rejected patches separately.'
```

Update result messaging:

```typescript
const warningNote = result.warnings.length > 0
  ? ` (${result.warnings.length} coerced)`
  : '';

const message =
  result.applyStatus === 'applied'
    ? `Applied ${patches.length} patch(es)${warningNote}. ${
        result.isComplete ? 'Form is now complete!' : `${remaining} required issue(s) remaining.`
      }`
    : result.applyStatus === 'partial'
    ? `Applied ${result.appliedPatches.length}/${patches.length} patches${warningNote}. ` +
      `${result.rejectedPatches.length} rejected.`
    : `All patches rejected. Check field IDs and value types.`;
```

### Spec Updates

**In `markform-spec.md` around line 2703-2709:**

Replace the current transaction semantics section with:

```markdown
**Structural validation failure handling:**

Implementations SHOULD use best-effort semantics:

- *recommended:* Valid patches are applied; invalid patches are rejected individually
- *recommended:* `applyStatus` indicates outcome: `"applied"` (all succeeded),
  `"partial"` (some succeeded), or `"rejected"` (all failed)
- *required:* Response includes clear error details for each rejected patch

Implementations MAY offer a strict mode with transaction semantics (all-or-nothing),
but best-effort SHOULD be the default for LLM-driven form filling.

**Recommended value coercions:**

To improve LLM ergonomics, implementations SHOULD automatically coerce common type
mismatches. These coercions preserve intent while fixing structural errors:

| Input Type | Target Field Kind | Coercion |
|------------|-------------------|----------|
| Single string | `string_list` | Wrap in array |
| Single URL string | `url_list` | Wrap in array |
| Single option ID | `multi_select` | Wrap in array |
| Boolean | `checkboxes` | Convert to state string (`true` → `"done"`/`"yes"`) |

Coerced patches SHOULD be applied with a warning, not rejected. The coerced value
is visible to the agent on the next turn, enabling self-correction if the intent
was different.

Implementations SHOULD NOT perform aggressive coercions such as:

- Splitting strings on delimiters (ambiguous)
- Converting arrays to single values (information loss)
- Type conversions between string/number (may fail silently)
```

### Doc Updates

**In `markform-apis.md`:**

Add documentation for:

1. `appliedPatches` field in `ApplyResult`
2. `warnings` field with `PatchWarning` structure
3. The three status values and when each occurs
4. Coercion table with examples

## Stage 3: Refine Architecture

### Reusable Components Found

- `validatePatch()` function already validates individual patches - reuse directly
- `normalizePatch()` already handles boolean coercion - extend for new coercions
- `PatchError` / `PatchRejection` types already exist with good error details
- `applyPatch()` already applies individual patches - call for valid ones

### Minimal New Code

The change is minimal:

1. Extend `normalizePatch()` with 3 new coercion cases
2. Change validation from fail-fast to collect-all
3. Add `warnings` array to result

No new utilities or patterns required.

### Performance Considerations

- Validation cost: Same (still validate all patches)
- Application cost: Same or less (only apply valid ones)
- Memory: Slightly more (store valid/invalid/warning separation)

No performance concerns.

## Stage 4: Implementation Tasks

### Phase 1: Core Type Changes

- [ ] Update `ApplyStatus` type in `coreTypes.ts` to add `'partial'`
- [ ] Add `PatchWarning` interface to `coreTypes.ts`
- [ ] Add `appliedPatches: Patch[]` to `ApplyResult` interface
- [ ] Add `warnings: PatchWarning[]` to `ApplyResult` interface

### Phase 2: Coercion Logic

- [ ] Refactor `normalizePatch()` to return `NormalizationResult` with optional warning
- [ ] Add string → string_list coercion
- [ ] Add URL string → url_list coercion
- [ ] Add option ID → multi_select array coercion
- [ ] Update boolean → checkbox coercion to use new warning structure

### Phase 3: Best-Effort Apply Logic

- [ ] Refactor `applyPatches()` to:
  - [ ] Collect warnings from normalization
  - [ ] Validate patches individually, collecting valid/invalid
  - [ ] Apply only valid patches
  - [ ] Return appropriate status based on results
  - [ ] Include `appliedPatches` and `warnings` in result

### Phase 4: Integration Updates

- [ ] Update `harness.ts` to use `appliedPatches.length`
- [ ] Update `vercelAiSdkTools.ts` description
- [ ] Update `vercelAiSdkTools.ts` result messaging to include warnings

### Phase 5: Tests

- [ ] Update existing "transaction semantics" test to verify new partial behavior
- [ ] Add test: all patches valid → `applyStatus: 'applied'`
- [ ] Add test: all patches invalid → `applyStatus: 'rejected'`
- [ ] Add test: mixed valid/invalid → `applyStatus: 'partial'`, correct `appliedPatches`
- [ ] Add test: single string → string_list coercion with warning
- [ ] Add test: single URL → url_list coercion with warning
- [ ] Add test: single option → multi_select coercion with warning
- [ ] Add test: verify form state only reflects applied patches
- [ ] Add test: coerced values are in `appliedPatches` (not original)

### Phase 6: Documentation

- [ ] Update `markform-spec.md` with best-effort recommendation
- [ ] Update `markform-spec.md` with coercion table
- [ ] Update `markform-apis.md` to document new fields and coercion behavior
- [ ] Update tool description in `vercelAiSdkTools.ts` (done in Phase 4)

### Phase 7: Validation

- [ ] Run full test suite: `pnpm test`
- [ ] Run typecheck: `pnpm typecheck`
- [ ] Run lint: `pnpm lint`
- [ ] Manual test with CLI: `pnpm markform fill` with mixed/coercible patches

## Open Questions

None - design is straightforward.
