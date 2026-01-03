# Plan Spec: Array-to-Checkboxes Coercion for LLM Tolerance

## Purpose

This is a technical design doc for adding automatic coercion of array inputs to checkbox
object format. This extends the value coercion framework established in
[plan-2026-01-03-best-effort-patch-application.md](../completed/plan-2026-01-03-best-effort-patch-application.md)
to address a specific, high-frequency LLM mistake pattern.

## Background

Markform already supports several value coercions to improve LLM ergonomics:

| Input Type | Target Field Kind | Coercion |
| --- | --- | --- |
| Single string | `string_list` | Wrap in array |
| Single URL string | `url_list` | Wrap in array |
| Single option ID | `multi_select` | Wrap in array |
| Boolean | `checkboxes` | Convert to state string |

**The gap:** LLMs consistently send checkbox patches as arrays instead of objects:

```typescript
// LLM sends (wrong):
{ op: 'set_checkboxes', fieldId: 'revenue_sources', value: ['product_sales', 'services'] }

// Expected:
{ op: 'set_checkboxes', fieldId: 'revenue_sources', value: { product_sales: 'done', services: 'done' } }
```

**Why this happens:** Pattern confusion between `multi_select` (array) and `checkboxes`
(object). LLMs pattern-match from `multi_select` syntax and apply it to checkboxes.

**Observed behavior:**
- Turn 1: LLM sends array format → rejected
- Turn 2: LLM self-corrects after error message → succeeds

**Cost:** ~4-8K tokens wasted per form interaction.

## Summary of Task

Add array-to-checkboxes coercion in two locations:
1. `valueCoercion.ts` - for programmatic `fillForm()` with `InputContext`
2. `apply.ts` - for direct patch application

The coercion converts `["opt1", "opt2"]` to `{"opt1": "done", "opt2": "done"}` (or
`"yes"` for explicit mode), with appropriate warnings.

**Files to modify:**

| File | Change Type | Description |
| --- | --- | --- |
| `packages/markform/src/engine/valueCoercion.ts` | Core logic | Add array handling in `coerceToCheckboxes()` |
| `packages/markform/src/engine/apply.ts` | Core logic | Add array coercion in `normalizePatch()` |
| `packages/markform/src/engine/coreTypes.ts` | Type update | Add `'array_to_checkboxes'` to `PatchCoercionType` |
| `packages/markform/src/harness/prompts.ts` | Documentation | Add clarifying note distinguishing checkboxes from multi_select |
| `docs/markform-spec.md` | Spec update | Add array-to-checkboxes to coercion table |
| `docs/markform-apis.md` | Doc update | Document new coercion behavior |
| `packages/markform/tests/unit/valueCoercion.test.ts` | Tests | Add array coercion tests |
| `packages/markform/tests/unit/engine/apply.test.ts` | Tests | Update rejection test to coercion test |

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: KEEP DEPRECATED - Adding a new
  coercion type enum value is additive. Existing code continues to work.

- **Library APIs**: KEEP DEPRECATED - No signature changes. Behavior change is strictly
  more permissive (accepts inputs that were previously rejected).

- **Server APIs**: N/A - No server APIs affected.

- **File formats**: N/A - Patch format unchanged. This is input coercion only.

- **Database schemas**: N/A - No database.

## Stage 1: Planning Stage

### Current State Analysis

**Existing coercion in `valueCoercion.ts:290-361`:**

```typescript
function coerceToCheckboxes(field: Field, rawValue: RawFieldValue): CoercionResult {
  // Currently rejects arrays:
  if (!isPlainObject(rawValue)) {
    return {
      ok: false,
      error: `checkboxes field '${field.id}' requires a Record<string, CheckboxValue>, got ${typeof rawValue}`,
    };
  }
  // ... rest handles objects and booleans
}
```

**Existing coercion in `apply.ts:172-211`:**

```typescript
function normalizePatch(form: ParsedForm, patch: Patch, index: number): NormalizationResult {
  // Already coerces boolean → checkbox string
  // Need to add array → object coercion BEFORE the boolean check
}
```

**Existing test in `apply.test.ts:1513-1519`:**

```typescript
it('rejects array instead of object', () => {
  const patch = { op: 'set_checkboxes', fieldId: 'checks', values: ['done'] } as any;
  const result = applyPatches(form, [patch]);
  expect(result.applyStatus).toBe('rejected');
});
```

This test will change from rejection to coercion with warning.

### Feature Requirements

**Must Have:**

1. Array of option IDs coerced to object with mode-appropriate default state
2. Coercion applies in both `valueCoercion.ts` and `apply.ts`
3. Warning generated for coerced patches (visible in `ApplyResult.warnings`)
4. Invalid option IDs in array still produce errors (not silent drops)
5. Empty array `[]` coerces to empty object `{}`
6. Spec and API docs updated with new coercion

**Default state by mode:**

| Checkbox Mode | Array Element Default State |
| --- | --- |
| `simple` | `'done'` (checked) |
| `multi` | `'done'` (completed) |
| `explicit` | `'yes'` (confirmed) |

**Rationale:** When an LLM sends `["opt1", "opt2"]`, it means "these should be checked/
done/yes". The array format implies positive selection.

**Nice to Have:**

1. Enhanced prompt documentation to prevent the mistake in the first place

**Not in Scope:**

1. Mixed array/object input (e.g., `["opt1", { opt2: "todo" }]`)
2. Coercing to non-default states (e.g., `["opt1:todo"]` syntax)

### Acceptance Criteria

1. `{ value: ["opt1", "opt2"] }` coerces to `{ value: { opt1: "done", opt2: "done" } }`
   for simple/multi mode

2. `{ value: ["opt1", "opt2"] }` coerces to `{ value: { opt1: "yes", opt2: "yes" } }`
   for explicit mode

3. Coercion produces a warning with `coercion: 'array_to_checkboxes'`

4. Invalid option IDs in array produce errors (same as current object behavior)

5. Empty array coerces to empty object with no warning

6. All existing tests pass (some updated to expect coercion instead of rejection)

7. Spec documents the new coercion in the recommended coercions table

8. API docs document the behavior with examples

## Stage 2: Architecture Stage

### Type Changes

**In `coreTypes.ts`:**

```typescript
// Current
type PatchCoercionType = 'string_to_list' | 'url_to_list' | 'option_to_array' | 'boolean_to_checkbox';

// Proposed
type PatchCoercionType = 'string_to_list' | 'url_to_list' | 'option_to_array' | 'boolean_to_checkbox' | 'array_to_checkboxes';
```

### Logic Changes

**In `valueCoercion.ts` - extend `coerceToCheckboxes()`:**

```typescript
function coerceToCheckboxes(field: Field, rawValue: RawFieldValue): CoercionResult {
  if (field.kind !== 'checkboxes') {
    return { ok: false, error: `Field '${field.id}' is not a checkboxes field` };
  }

  if (rawValue === null) {
    return { ok: true, patch: { op: 'set_checkboxes', fieldId: field.id, value: {} } };
  }

  // NEW: Coerce array to object with default state
  if (Array.isArray(rawValue)) {
    const validOptions = new Set(field.options.map((o) => o.id));
    const defaultState = field.checkboxMode === 'explicit' ? 'yes' : 'done';
    const values: Record<OptionId, CheckboxValue> = {};

    for (const item of rawValue) {
      if (typeof item !== 'string') {
        return {
          ok: false,
          error: `Array items for checkboxes field '${field.id}' must be strings (option IDs), got ${typeof item}`,
        };
      }
      if (!validOptions.has(item)) {
        return {
          ok: false,
          error: `Invalid option '${item}' for checkboxes field '${field.id}'. Valid options: ${Array.from(validOptions).join(', ')}`,
        };
      }
      values[item] = defaultState;
    }

    const patch: Patch = { op: 'set_checkboxes', fieldId: field.id, value: values };

    // Empty array: no warning needed
    if (rawValue.length === 0) {
      return { ok: true, patch };
    }

    return {
      ok: true,
      patch,
      warning: `Coerced array to checkboxes object with '${defaultState}' state for field '${field.id}'`,
    };
  }

  // Existing object handling...
  if (!isPlainObject(rawValue)) {
    return {
      ok: false,
      error: `checkboxes field '${field.id}' requires a Record<string, CheckboxValue> or array of option IDs, got ${typeof rawValue}`,
    };
  }

  // ... rest unchanged
}
```

**In `apply.ts` - extend `normalizePatch()`:**

```typescript
function normalizePatch(form: ParsedForm, patch: Patch, index: number): NormalizationResult {
  // ... existing code ...

  // NEW: Coerce array → checkboxes object (before boolean check)
  if (patch.op === 'set_checkboxes' && field.kind === 'checkboxes') {
    if (Array.isArray(patch.value)) {
      const defaultState = field.checkboxMode === 'explicit' ? 'yes' : 'done';
      const values: Record<string, CheckboxValue> = {};

      for (const item of patch.value) {
        if (typeof item === 'string') {
          values[item] = defaultState;
        }
        // Invalid items will be caught by validation
      }

      // Empty array: no warning
      if (patch.value.length === 0) {
        return { patch: { ...patch, value: values } as SetCheckboxesPatch };
      }

      return {
        patch: { ...patch, value: values } as SetCheckboxesPatch,
        warning: createWarning(
          index,
          field.id,
          'array_to_checkboxes',
          `Coerced array to checkboxes object with '${defaultState}' state`,
        ),
      };
    }

    // Existing boolean coercion...
  }

  // ... rest unchanged
}
```

### Prompt Updates

**In `prompts.ts` - enhance PATCH_FORMATS:**

```typescript
export const PATCH_FORMATS: Record<string, string> = {
  // ... existing ...
  checkboxes: '{ op: "set_checkboxes", fieldId: "...", value: { "opt1": "done", "opt2": "todo" } }',
  // Consider adding a note in the prompt generation
};
```

**In `prompts.ts` - update DEFAULT_SYSTEM_PROMPT or add inline hints:**

Consider adding to the instructions:
```
9. For checkboxes: use an object mapping each option to its state (NOT an array like multi_select)
   - Mode "simple": { "option_id": "done" } or { "option_id": "todo" }
   - Mode "multi": { "option_id": "done" | "todo" | "na" }
   - Mode "explicit": { "option_id": "yes" | "no" }
```

### Spec Updates

**In `markform-spec.md` - add to coercion table:**

After the existing coercion table (around line ~2700), add:

```markdown
| Array of option IDs | `checkboxes` | Convert to object with default state | `["a", "b"]` → `{ a: "done", b: "done" }` |
```

And update the "Coercions NOT recommended" section to clarify:

```markdown
| Array to checkboxes | ✅ Recommended | Preserves intent (array = selected/done) |
```

### API Doc Updates

**In `markform-apis.md` - extend coercion documentation:**

After the existing boolean coercion documentation (around line 155):

```markdown
**Array coercion:** Arrays of option IDs are coerced to checkbox objects:

- **simple/multi modes**: `["opt1", "opt2"]` → `{ opt1: "done", opt2: "done" }`
- **explicit mode**: `["opt1", "opt2"]` → `{ opt1: "yes", opt2: "yes" }`

This handles common LLM mistakes where the array format from `multi_select` is
incorrectly applied to `checkboxes` fields.
```

## Stage 3: Refine Architecture

### Reusable Components Found

- `coerceToCheckboxes()` already validates option IDs - reuse that logic
- `normalizePatch()` pattern for creating warnings - follow existing pattern
- `createWarning()` helper in apply.ts - use directly
- Existing tests provide templates for new coercion tests

### Minimal New Code

The change is minimal:
1. Add ~25 lines to `coerceToCheckboxes()` for array handling
2. Add ~20 lines to `normalizePatch()` for array coercion
3. Add 1 enum value to `PatchCoercionType`
4. Update 2 doc files with new table row

### Performance Considerations

- Array check is O(1) - fast path for common case (already object)
- Option validation is same cost whether from array or object
- No performance concerns

## Stage 4: Implementation Tasks

### Phase 1: Type Changes

- [ ] Add `'array_to_checkboxes'` to `PatchCoercionType` in `coreTypes.ts`

### Phase 2: Core Coercion Logic

- [ ] Add array handling in `coerceToCheckboxes()` in `valueCoercion.ts`
  - [ ] Check for array input before object check
  - [ ] Validate all items are strings
  - [ ] Validate all items are valid option IDs
  - [ ] Build object with mode-appropriate default state
  - [ ] Return warning for non-empty arrays
- [ ] Add array coercion in `normalizePatch()` in `apply.ts`
  - [ ] Add before existing boolean coercion
  - [ ] Use `createWarning()` helper
  - [ ] Handle empty array without warning

### Phase 3: Prompt Improvements

- [ ] Update `DEFAULT_SYSTEM_PROMPT` in `prompts.ts` to clarify checkboxes format
- [ ] Consider adding inline format hints when surfacing checkbox issues

### Phase 4: Tests

- [ ] Update `apply.test.ts:1513-1519` "rejects array instead of object" to expect coercion
- [ ] Add test: array coercion produces warning with correct type
- [ ] Add test: empty array coerces to empty object without warning
- [ ] Add test: array with invalid option ID still produces error
- [ ] Add test: array with non-string items produces error
- [ ] Add test: explicit mode uses 'yes' as default state
- [ ] Add test in `valueCoercion.test.ts` for array input coercion
- [ ] Add test: verify coerced values appear in `appliedPatches`

### Phase 5: Documentation

- [ ] Update `docs/markform-spec.md`:
  - [ ] Add row to recommended coercions table
  - [ ] Update "not recommended" section if needed
- [ ] Update `docs/markform-apis.md`:
  - [ ] Add array coercion section after boolean coercion
  - [ ] Include examples for each checkbox mode

### Phase 6: Validation

- [ ] Run full test suite: `pnpm test`
- [ ] Run typecheck: `pnpm typecheck`
- [ ] Run lint: `pnpm lint`
- [ ] Run build: `pnpm build`
- [ ] Manual test: Create form with checkboxes, send array patch via CLI

## Open Questions

None - design follows established patterns from existing coercion framework.

## Related Issues

- **markform-526**: Tracks implementation of this feature
