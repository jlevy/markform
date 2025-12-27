# Feature Validation: Programmatic Fill API

## Purpose

This is a validation spec for the Programmatic Fill API feature, documenting automated
testing that has been completed and manual validation steps for the user to confirm
implementation.

**Feature Plan:**
[plan-2025-12-24-programmatic-fill-api.md](plan-2025-12-24-programmatic-fill-api.md)

## Stage 4: Validation Stage

## Automated Validation (Testing Performed)

All automated tests pass (382 tests total).
The programmatic fill API implementation includes comprehensive unit and integration
tests covering all major functionality.

### Unit Testing

#### Value Coercion Layer (`tests/unit/values.test.ts`) - 43 tests

**`findFieldById()` tests:**

- [x] Returns field when found via idIndex

- [x] Returns undefined for non-existent field ID

- [x] Returns undefined for group ID (not a field)

- [x] Works with fields in different groups

**`coerceToFieldPatch()` tests per field kind:**

| Field Kind | Test Cases Covered |
| --- | --- |
| `string` | accepts string, coerces number→string with warning, coerces boolean→string with warning, rejects array, rejects object, accepts null |
| `number` | accepts number, coerces numeric string→number with warning, rejects non-numeric string, rejects array, accepts null |
| `string_list` | accepts string[], coerces single string→[string] with warning, rejects non-array non-string, accepts null |
| `single_select` | accepts valid option ID, rejects invalid option ID, accepts null, rejects non-string value |
| `multi_select` | accepts string[], coerces string→[string] with warning, rejects invalid option IDs, accepts null |
| `checkboxes (multi)` | accepts valid values, rejects invalid option ID, rejects invalid value for mode, rejects wrong structure |
| `checkboxes (simple)` | accepts simple mode values, rejects multi mode values |
| `checkboxes (explicit)` | accepts explicit mode values, rejects done/todo values |

**`coerceInputContext()` tests:**

- [x] Returns patches for valid input context

- [x] Collects warnings from multiple coercions

- [x] Collects errors for missing fields

- [x] Collects errors for incompatible types

- [x] Skips null values

- [x] Handles empty input context

#### Programmatic Fill API (`tests/unit/harness/programmaticFill.test.ts`) - 19 tests

**Basic functionality (with MockAgent):**

- [x] Fills form with minimal options `{ form, model }`

- [x] Returns `status.ok: true` when form completes

- [x] Returns correct values map keyed by field ID

- [x] Returns serialized markdown

- [x] Returns turns count

**Input context:**

- [x] Pre-fills fields from inputContext before agent runs

- [x] Fails fast with `status.ok: false, reason: 'error'` on invalid field ID

- [x] Fails fast on incompatible type

- [x] Includes `inputContextWarnings` for coerced values

**Progress callback:**

- [x] `onTurnComplete` called after each turn

- [x] `TurnProgress` contains correct values

- [x] Callback errors don’t abort fill

**Cancellation:**

- [x] `signal.abort()` returns partial result with `reason: cancelled`

- [x] Partial values and markdown are returned on cancellation

**Max turns:**

- [x] Returns `status.ok: false, reason: max_turns` when limit reached

- [x] `remainingIssues` populated when not complete

**Error scenarios:**

- [x] Form parse error returns appropriate error

- [x] Model resolution error returns appropriate error

**Fill modes:**

- [x] `fillMode: continue` skips already-filled fields

### Integration and End-to-End Testing

#### Integration Tests (`tests/integration/programmaticFill.test.ts`) - 10 tests

**End-to-end with MockAgent:**

- [x] Complete fill of `simple.form.md` using mock values with inputContext

- [x] Partial fill with agent role only fills agent fields

- [x] Round-trip: result can be re-parsed

- [x] Complete fill of `political-research.form.md` with inputContext for user field

- [x] Handles complex form structure (string_list fields)

**Error scenarios:**

- [x] Form parse error returns appropriate error

- [x] Model resolution error returns appropriate error

- [x] Invalid inputContext field returns error

**Progress tracking:**

- [x] `onTurnComplete` receives accurate progress info

- [x] Zero turns when form is already complete via inputContext

## Manual Validation Needed

The following manual validation steps should be performed by the user to confirm the
feature works correctly in real-world scenarios.

### 1. Verify Package Exports

Confirm the new API is correctly exported from the package:

```typescript
// Verify these imports work from the package
import {
  fillForm,
  type FillOptions,
  type FillResult,
  type FillStatus,
  type TurnProgress,
  type InputContext,
  type RawFieldValue,
  findFieldById,
  coerceToFieldPatch,
  coerceInputContext,
} from 'markform';
```

### 2. Test with Real LLM Model

Run a simple programmatic fill with an actual LLM to verify the integration works
end-to-end:

```typescript
import { fillForm } from 'markform';

const result = await fillForm({
  form: `---
markform:
  spec: MF/0.1
  roles:
    - user
    - agent
---

{% form id="test" title="Test" %}
{% field-group id="main" title="Main" %}
{% string-field id="name" label="Name" role="user" required=true %}{% /string-field %}
{% string-field id="greeting" label="Greeting" role="agent" required=true %}
Generate a greeting for the user.
{% /string-field %}
{% /field-group %}
{% /form %}
`,
  model: 'anthropic/claude-sonnet-4-20250514',  // or your preferred model
  inputContext: { name: 'Alice' },
});

console.log('Status:', result.status);
console.log('Values:', result.values);
console.log('Turns:', result.turns);
```

Expected behavior:

- The form should complete with `status.ok: true`

- The `name` field should contain “Alice” (from inputContext)

- The `greeting` field should contain an AI-generated greeting

- Turn count should be > 0

### 3. Verify CLI Still Works

The CLI should still work with the LiveAgent enhancement (`systemPromptAddition`):

```bash
# Interactive fill should still work
pnpm markform fill examples/simple/simple.form.md

# Verify the --system-prompt flag appends to the prompt (not overrides)
pnpm markform fill examples/simple/simple.form.md \
  --system-prompt "Please be very concise in your responses."
```

### 4. Verify Progress Callback in Real Scenario

Test that progress callbacks work correctly with a real model:

```typescript
const result = await fillForm({
  form: formMarkdown,
  model: 'anthropic/claude-sonnet-4-20250514',
  inputContext: { name: 'Test' },
  onTurnComplete: (progress) => {
    console.log(`Turn ${progress.turnNumber}:`);
    console.log(`  Issues shown: ${progress.issuesShown}`);
    console.log(`  Patches applied: ${progress.patchesApplied}`);
    console.log(`  Required remaining: ${progress.requiredIssuesRemaining}`);
    console.log(`  Complete: ${progress.isComplete}`);
  },
});
```

### 5. Verify Cancellation Works

Test that AbortSignal cancellation works correctly:

```typescript
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

const result = await fillForm({
  form: complexFormMarkdown,
  model: 'anthropic/claude-sonnet-4-20250514',
  signal: controller.signal,
});

// If cancelled, status should indicate cancellation
if (!result.status.ok) {
  console.log('Cancelled:', result.status.reason === 'cancelled');
  console.log('Partial values:', result.values);
}
```

## User Feedback

> (To be filled in after user review)
> 
> - Feedback from user review:
>
> - Issues found:
>
> - Additional revisions needed:
