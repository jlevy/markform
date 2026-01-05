# Feature Validation: Array-to-Checkboxes Coercion & Prompt Improvements

## Purpose

This validation spec documents testing performed and remaining manual validation for
the checkbox type coercion feature and prompt improvements.

**Feature Plan:** [plan-2026-01-03-array-to-checkboxes-coercion.md](./plan-2026-01-03-array-to-checkboxes-coercion.md)

**Related Plan:** [plan-2026-01-03-type-coercion-golden-tests.md](./plan-2026-01-03-type-coercion-golden-tests.md)

## Summary of Changes

### 1. Array-to-Checkboxes Coercion
When LLMs mistakenly send checkbox patches as arrays (like `multi_select`), the engine now
automatically coerces them to the correct object format:

- `["opt1", "opt2"]` → `{ "opt1": "done", "opt2": "done" }` (simple/multi mode)
- `["opt1", "opt2"]` → `{ "opt1": "yes", "opt2": "yes" }` (explicit mode)

This reduces wasted turns (~4-8K tokens per form) when LLMs pattern-match from multi_select.

### 2. Enhanced Prompt Instructions
- Table-based format examples for all 10 field types in system prompt
- Critical warning section contrasting checkboxes vs multi_select
- WRONG vs RIGHT examples for checkbox format
- Mode-specific checkbox state examples (simple, multi, explicit)
- **Fix:** Multi mode now lists all 5 states: `done`, `todo`, `incomplete`, `active`, `na`
  (was incorrectly showing only 3: `done`, `todo`, `na`)
- **Fix:** Explicit mode guidance clarifies agents should use `abort_field` if answer is unknown
  (instead of exposing `unfilled` state which is an initial state, not a valid answer)

### 3. Improved Inline Field Hints
- Inline examples now use actual option IDs from the field definition
- Checkbox mode is shown in issue formatting
- Mode-appropriate states used in examples (yes/no for explicit, done/todo for simple)

## Automated Validation (Testing Performed)

### Unit Testing

All tests pass (1431 total):

**`valueCoercion.test.ts`** - Array coercion tests:
- ✅ Coerces array of valid option IDs to checkboxes object
- ✅ Coerces array with 'yes' state in explicit mode
- ✅ Rejects array with invalid option IDs
- ✅ Rejects array with non-string items
- ✅ Coerces empty array to empty object without warning

**`apply.test.ts`** - Patch application tests:
- ✅ Coerces array of option IDs to checkboxes object with warning
- ✅ Rejects array with invalid option IDs
- ✅ Warning has correct `coercion: 'array_to_checkboxes'` type
- ✅ Coerced values appear in `appliedPatches`

**Type checks:**
- ✅ `PatchCoercionType` includes `'array_to_checkboxes'`
- ✅ `PatchCoercionTypeSchema` Zod schema validates new type

### Integration and End-to-End Testing

**Golden Session Tests:**
- ✅ `simple.session.yaml` - Updated with new prompt format
- ✅ `simple-with-skips.session.yaml` - Updated with new prompt format
- ✅ `rejection-test.session.yaml` - Updated with new prompt format
- ✅ All golden test idempotency checks pass
- ✅ All mutation sensitivity tests pass

**Validation Test Coverage:**
- ✅ `validation.test.ts` - Detects system prompt changes
- ✅ `validation.test.ts` - Detects tool schema $ref changes (fixed quote style mismatch)
- ✅ Session regeneration is stable (double regeneration produces identical output)

### Build & Lint

- ✅ `pnpm typecheck` - No type errors
- ✅ `pnpm lint` - No lint errors
- ✅ Pre-commit hooks pass (format, typecheck, lint)
- ✅ Pre-push hooks pass (full test suite)

## Manual Testing Needed

### 1. Review Prompt Changes

**Files to review:**
- `packages/markform/src/harness/prompts.ts` - View the new `DEFAULT_SYSTEM_PROMPT`
  with table-based examples and critical warning section

**What to verify:**
- The table format is clear and readable
- The checkboxes vs multi_select warning is prominent
- The WRONG/RIGHT examples are helpful

### 2. Review Inline Field Hints (Optional)

**How to test:**
```bash
# Create a test form with checkboxes in different modes
# Run the CLI and observe the issue formatting
pnpm markform fill examples/simple/simple.form.md --verbose
```

**What to verify:**
- Checkbox field issues show the Mode (simple/multi/explicit)
- The `Set:` hint uses actual option IDs from the field
- Mode-appropriate states are shown (done/todo or yes/no)

### 3. Verify Array Coercion Works (Optional)

If you want to manually verify the array-to-checkboxes coercion:

```typescript
// In a test script or REPL:
import { parseForm, applyPatches } from 'markform';

const form = parseForm(`
---
markform:
  spec: "MF/0.1"
---
{% form id="test" title="Test" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="simple" %}
- [ ] Task A {% #a %}
- [ ] Task B {% #b %}
{% /field %}
{% /form %}
`);

// Send array format (the "wrong" way)
const result = applyPatches(form, [
  { op: 'set_checkboxes', fieldId: 'tasks', value: ['a', 'b'] }
]);

console.log(result.applyStatus); // 'applied'
console.log(result.appliedPatches[0]); // { ..., value: { a: 'done', b: 'done' } }
console.log(result.warnings[0]?.coercion); // 'array_to_checkboxes'
```

**What to verify:**
- Array input is accepted (not rejected)
- Value is coerced to object with correct states
- Warning is generated with correct coercion type

## Open Questions

None - implementation follows established patterns from existing coercion framework.

## User Feedback

*(To be filled in after user review)*
