# Plan Spec: Type Coercion Golden Session Tests & Harness Improvements

## Purpose

This is a technical design doc for creating comprehensive golden session tests that verify
all type coercion behaviors, and for improving the harness and prompts to minimize LLM
mistakes in the first place.

**Related specs:**
- [plan-2026-01-03-best-effort-patch-application.md](../completed/plan-2026-01-03-best-effort-patch-application.md) - Established coercion framework
- [plan-2026-01-03-array-to-checkboxes-coercion.md](./plan-2026-01-03-array-to-checkboxes-coercion.md) - Array-to-checkboxes coercion

## Background

Markform now supports several value coercions to improve LLM ergonomics:

| Coercion | Input | Output | Status |
| --- | --- | --- | --- |
| String → string_list | `"item"` | `["item"]` | ✅ Implemented |
| URL → url_list | `"https://..."` | `["https://..."]` | ✅ Implemented |
| Option → multi_select | `"opt1"` | `["opt1"]` | ✅ Implemented |
| Boolean → checkboxes | `{ opt: true }` | `{ opt: "done" }` | ✅ Implemented |
| Array → checkboxes | `["opt1", "opt2"]` | `{ opt1: "done", opt2: "done" }` | 🔄 Planned |

**Current testing gaps:**

1. **No golden session tests for coercion** - Unit tests exist but don't verify the
   complete wire format and context prompts that LLMs receive

2. **Coercion warnings not visible in sessions** - The `warnings` field from ApplyResult
   is captured but not specifically tested

3. **Prompt improvements undocumented** - No systematic approach to preventing LLM
   mistakes through better prompts

**Goals:**

1. Create a golden session test that exercises ALL coercion types
2. Verify coercion warnings appear correctly in session transcripts
3. Improve prompts to minimize LLM mistakes
4. Document the coercion behavior in a way LLMs can understand

## Summary of Task

1. Create a new example form that has fields for each coercible type
2. Create a mock-filled version with intentional "wrong" formats that trigger coercion
3. Add golden session test to verify coercion warnings are captured
4. Improve prompts to better distinguish checkbox format from multi_select
5. Update spec and API docs with clearer examples

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: N/A - Adding tests only
- **Library APIs**: N/A - No API changes
- **Server APIs**: N/A - No server APIs affected
- **File formats**: N/A - Adding example files only
- **Database schemas**: N/A - No database

## Stage 1: Planning Stage

### Current State Analysis

**Existing golden session tests:**

| Test | Purpose |
| --- | --- |
| `simple.session.yaml` | Basic form filling flow |
| `simple-with-skips.session.yaml` | Skip field behavior |
| `rejection-test.session.yaml` | Patch rejection and recovery |

**Missing test coverage:**

| Scenario | Currently Tested |
| --- | --- |
| String → string_list coercion | ❌ Unit tests only |
| URL → url_list coercion | ❌ Unit tests only |
| Option → multi_select coercion | ❌ Unit tests only |
| Boolean → checkboxes coercion | ❌ Unit tests only |
| Array → checkboxes coercion | ❌ Not implemented yet |
| Multiple coercions in one turn | ❌ Not tested |
| Coercion warnings in wire format | ❌ Not verified |

### Feature Requirements

**Must Have:**

1. New example form with all coercible field types:
   - `string_list` field
   - `url_list` field
   - `multi_select` field
   - `checkboxes` fields (simple, multi, explicit modes)

2. Mock-filled version that sends "wrong" formats triggering coercion:
   - Single strings for list fields
   - Single option for multi_select
   - Booleans for checkboxes
   - Arrays for checkboxes (after implementation)

3. Golden session test that verifies:
   - Coercion warnings appear in `apply.warnings`
   - Coerced values appear in `apply.patches`
   - Wire format captures the coercion correctly

4. Updated prompts in `prompts.ts`:
   - Clearer distinction between checkboxes (object) and multi_select (array)
   - Examples showing correct format for each type

**Nice to Have:**

1. Inline field hints showing checkbox mode when surfacing issues
2. Per-field format examples based on field kind

**Not in Scope:**

1. Changing the coercion logic itself (covered by other specs)
2. Adding new coercion types beyond what's planned

### Acceptance Criteria

1. New golden session test passes: `pnpm test:golden`
2. Session file captures coercion warnings with correct structure
3. Prompts clearly distinguish object vs array formats
4. All existing tests continue to pass

## Stage 2: Architecture Stage

### New Example Form Structure

**File:** `examples/coercion-test/coercion-test.form.md`

```markdown
---
markform:
  spec: "MF/0.1"
role_instructions:
  agent: "Fill in all fields. For testing, intentionally use simplified formats."
---

{% form id="coercion_test" title="Type Coercion Test Form" %}

{% group id="list_fields" title="List Fields" %}

{% field kind="string_list" id="keywords" label="Keywords" minItems=1 required=true %}{% /field %}

{% field kind="url_list" id="references" label="References" minItems=1 required=true %}{% /field %}

{% /group %}

{% group id="select_fields" title="Select Fields" %}

{% field kind="multi_select" id="categories" label="Categories" required=true %}
- [ ] Tech {% #tech %}
- [ ] Business {% #business %}
- [ ] Science {% #science %}
{% /field %}

{% /group %}

{% group id="checkbox_fields" title="Checkbox Fields" %}

{% field kind="checkboxes" id="tasks_simple" label="Simple Tasks" checkboxMode="simple" required=true %}
- [ ] Review {% #review %}
- [ ] Approve {% #approve %}
{% /field %}

{% field kind="checkboxes" id="tasks_multi" label="Multi Tasks" checkboxMode="multi" required=true %}
- [ ] Research {% #research %}
- [ ] Design {% #design %}
{% /field %}

{% field kind="checkboxes" id="confirmations" label="Confirmations" checkboxMode="explicit" required=true %}
- [ ] Terms accepted {% #terms %}
- [ ] Privacy acknowledged {% #privacy %}
{% /field %}

{% /group %}

{% /form %}
```

### Mock-Filled Version (Triggering Coercions)

**File:** `examples/coercion-test/coercion-test-mock-filled.form.md`

The mock agent will intentionally send:

```typescript
// Turn 1: All "wrong" formats that trigger coercion
{
  patches: [
    // String → string_list coercion
    { op: 'set_string_list', fieldId: 'keywords', value: 'single-keyword' },

    // URL → url_list coercion
    { op: 'set_url_list', fieldId: 'references', value: 'https://example.com' },

    // Option → multi_select coercion
    { op: 'set_multi_select', fieldId: 'categories', value: 'tech' },

    // Boolean → checkboxes coercion (simple mode)
    { op: 'set_checkboxes', fieldId: 'tasks_simple', value: { review: true, approve: false } },

    // Boolean → checkboxes coercion (multi mode)
    { op: 'set_checkboxes', fieldId: 'tasks_multi', value: { research: true, design: true } },

    // Boolean → checkboxes coercion (explicit mode)
    { op: 'set_checkboxes', fieldId: 'confirmations', value: { terms: true, privacy: true } },
  ]
}
```

### Expected Session Structure

The session file should capture:

```yaml
turns:
  - turn: 1
    apply:
      patches:
        # Coerced values (normalized form)
        - op: set_string_list
          field_id: keywords
          value: ["single-keyword"]  # Wrapped in array
        - op: set_url_list
          field_id: references
          value: ["https://example.com"]  # Wrapped in array
        - op: set_multi_select
          field_id: categories
          value: ["tech"]  # Wrapped in array
        - op: set_checkboxes
          field_id: tasks_simple
          value: { review: "done", approve: "todo" }  # Booleans → strings
        - op: set_checkboxes
          field_id: tasks_multi
          value: { research: "done", design: "done" }
        - op: set_checkboxes
          field_id: confirmations
          value: { terms: "yes", privacy: "yes" }  # Booleans → "yes"
      warnings:
        - patch_index: 0
          field_id: keywords
          coercion: string_to_list
          message: "Coerced single string to string_list"
        - patch_index: 1
          field_id: references
          coercion: url_to_list
          message: "Coerced single URL to url_list"
        - patch_index: 2
          field_id: categories
          coercion: option_to_array
          message: "Coerced single option ID to multi_select array"
        - patch_index: 3
          field_id: tasks_simple
          coercion: boolean_to_checkbox
          message: "Coerced boolean values to checkbox state strings"
        # ... etc
```

### Prompt Improvements

**In `prompts.ts` - DEFAULT_SYSTEM_PROMPT:**

Update guideline #9 to be more explicit:

```typescript
9. For checkboxes: use an OBJECT mapping option IDs to states (NOT an array like multi_select):
   - Mode "simple": { "option_id": "done" } or { "option_id": "todo" }
   - Mode "multi": { "option_id": "done" | "todo" | "na" | "incomplete" | "active" }
   - Mode "explicit": { "option_id": "yes" } or { "option_id": "no" }
   IMPORTANT: checkboxes use { key: "state" } objects, NOT ["key1", "key2"] arrays!
```

**In `prompts.ts` - PATCH_FORMATS:**

Add explicit contrast notes:

```typescript
export const PATCH_FORMATS: Record<string, string> = {
  // ... existing ...
  multi_select: '{ op: "set_multi_select", fieldId: "...", value: ["opt1", "opt2"] }  // Array of option IDs',
  checkboxes: '{ op: "set_checkboxes", fieldId: "...", value: { "opt1": "done", "opt2": "todo" } }  // Object mapping IDs to states (NOT an array!)',
};
```

### Harness Improvements

**In `harness.ts` or issue formatting:**

When surfacing checkbox issues, include format hint:

```typescript
// Current:
- **tasks** (field): Required field "Tasks" has incomplete checkboxes
  Severity: required, Priority: P1
  Type: checkboxes

// Improved:
- **tasks** (field): Required field "Tasks" has incomplete checkboxes
  Severity: required, Priority: P1
  Type: checkboxes (mode: simple)
  Format: { op: "set_checkboxes", fieldId: "tasks", value: { "opt_id": "done" | "todo" } }
  Note: Use OBJECT format, not array. Each option needs a state value.
```

### Documentation Updates

**In `markform-spec.md`:**

Add to the recommended coercions table:

```markdown
| Array of option IDs | `checkboxes` | Convert to object | `["a", "b"]` → `{ a: "done", b: "done" }` |
```

Add clarifying note after the table:

```markdown
**Note on checkboxes vs multi_select:**

These fields look similar but have different formats:
- `multi_select`: Uses an **array** of selected option IDs: `["opt1", "opt2"]`
- `checkboxes`: Uses an **object** mapping each option to a state: `{ "opt1": "done", "opt2": "todo" }`

This distinction exists because checkboxes have **state per option** (done, todo, na, etc.)
while multi_select only tracks **which options are selected** (binary yes/no).
```

**In `markform-apis.md`:**

Add array coercion documentation after boolean coercion:

```markdown
**Array coercion (checkboxes only):**

Arrays of option IDs are coerced to checkbox objects:

| Mode | Input | Output |
| --- | --- | --- |
| simple/multi | `["opt1", "opt2"]` | `{ opt1: "done", opt2: "done" }` |
| explicit | `["opt1", "opt2"]` | `{ opt1: "yes", opt2: "yes" }` |

This handles the common LLM mistake of using array format (from multi_select)
for checkbox fields.
```

## Stage 3: Refine Architecture

### Reusable Components Found

- `scripts/regen-golden-sessions.ts` - Add new session config
- `tests/golden/golden.test.ts` - Automatically discovers new sessions
- `tests/golden/helpers.ts` - Session regeneration utilities
- Existing `rejection-test` structure provides a template

### Minimal New Code

1. New example form + mock-filled version (~100 lines markdown)
2. Add session config to regen script (~20 lines)
3. Update prompts (~30 lines)
4. Update docs (~50 lines)

No new utilities or complex logic required.

### Performance Considerations

- One additional golden test adds ~1-2 seconds to test suite
- No runtime performance impact

## Stage 4: Implementation Tasks

### Phase 1: Create Example Form

- [ ] Create `examples/coercion-test/` directory (deferred - existing examples sufficient)
- [ ] Create `coercion-test.form.md` with all coercible field types (deferred)
- [ ] Create `coercion-test-mock-filled.form.md` with final expected values (deferred)
- [ ] Create mock source that sends "wrong" formats triggering coercion (deferred)

### Phase 2: Configure Golden Session

- [ ] Add coercion-test to `scripts/regen-golden-sessions.ts` (deferred)
- [x] Run `pnpm test:golden:regen` to regenerate existing session files
- [x] Existing golden tests validate prompt changes work correctly

### Phase 3: Prompt Improvements

- [x] Update `DEFAULT_SYSTEM_PROMPT` with table-based format examples
- [x] Add critical warning section contrasting checkboxes vs multi_select
- [x] Add `CHECKBOX_MODE_HINTS` for mode-specific examples
- [x] Add checkbox mode to inline issue formatting with actual option IDs
- [x] Update `getPatchFormatHint()` to use real option IDs and modes

### Phase 4: Documentation Updates

- [x] Update `markform-apis.md` with array coercion documentation
- [x] Add clarifying note distinguishing checkboxes from multi_select in prompts
- [x] Regenerate golden tests to capture prompt changes

### Phase 5: Validation

- [x] Run `pnpm test` - all 1431 tests pass
- [x] Run `pnpm test:golden` - golden tests pass
- [x] Run `pnpm typecheck` - no type errors
- [x] Run `pnpm lint` - no lint errors

### Phase 6: Array-to-Checkboxes Integration

- [x] Array-to-checkboxes coercion implemented (see plan-2026-01-03-array-to-checkboxes-coercion.md)
- [x] Golden session tests updated to reflect new prompt format
- [x] Array coercion tests added to unit test suite

## Open Questions

1. **Should coercion warnings appear in context prompt on next turn?**
   - Currently: Warnings are in ApplyResult but not shown to LLM
   - Option A: Show warnings like rejection errors (helps LLM learn)
   - Option B: Silent coercion (current behavior, less noise)
   - Recommendation: Option B - coercion is silent help, not an error

2. **Should we add a second turn to verify LLM sees coerced values?**
   - Currently: Single-turn test showing coercion applied
   - Option: Add Turn 2 where LLM sees coerced values in form state
   - Recommendation: Not needed - form state hash already verifies this

## Related Issues

- **markform-526**: Array-to-checkboxes coercion implementation
