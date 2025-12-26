# Feature Validation: Unified Response Model with Notes

## Purpose

This validation spec documents post-testing validation for the unified response model
refactor, which replaces `valuesByFieldId` + `skipsByFieldId` with a unified
`responsesByFieldId` model and adds notes as first-class concepts.

**Feature Plan:** plan-2025-12-25-unified-response-model-with-notes.md

**Implementation Plan:** impl-2025-12-25-unified-response-model-with-notes.md

## Stage 4: Validation Stage

## Overview of Changes

This is a major internal refactor of the markform engine:

1. **Core Type Changes**
   - Added `ResponseState` type: `"empty" | "answered" | "skipped" | "aborted"`
   - Added `FieldResponse` wrapper: `{ state: ResponseState; value?: FieldValue }`
   - Replaced `valuesByFieldId` + `skipsByFieldId` with unified `responsesByFieldId`
   - Added `Note` and `NoteId` types for first-class note support
   - Added new patches: `abort_field`, `add_note`, `remove_note`
   - Updated `skip_field` to require `role` parameter

2. **Parsing Changes**
   - Parse `state` attribute on field tags (`state="skipped"`, `state="aborted"`)
   - Parse sentinel values (`|SKIP|`, `|ABORT|`) in text value fences
   - Parse `{% note %}` tags with id, ref, role, optional state, and text

3. **Serialization Changes**
   - Serialize `state` attribute on field tags for skipped/aborted fields
   - Serialize notes at end of form sorted by ID
   - Structured export format for JSON/YAML

4. **Apply Logic Changes**
   - Updated all patch handlers to work with `FieldResponse`
   - Implemented `abort_field`, `add_note`, `remove_note` handlers
   - Auto-cleanup of state-linked notes when setting values

5. **Completion Logic Changes**
   - Updated `isFormComplete()` to require `abortedFields == 0`
   - Updated `computeFormState()` to return 'invalid' when aborted fields exist

6. **Simplification**
   - Removed `remove_notes` patch type (simplified to just `remove_note`)

## Automated Validation (Testing Performed)

### Unit Testing

All 518 tests pass. Key test coverage includes:

**Core Types (29 tests)** - `tests/unit/engine/coreTypes.test.ts`
- Zod schema validation for all new types
- ResponseState, FieldResponse, Note, NoteId schemas
- New patch type schemas (abort_field, add_note, remove_note)

**Parse (47 tests)** - `tests/unit/engine/parse.test.ts`
- Parse `state` attribute on field tags
- Parse sentinel values in text value fences
- Parse `{% note %}` tags
- Validation of invalid state combinations

**Serialize (34 tests)** - `tests/unit/engine/serialize.test.ts`
- Serialize state attributes on field tags
- Serialize notes at end of form
- Round-trip preservation

**Apply (29 tests)** - `tests/unit/engine/apply.test.ts`
- `skip_field` patch with role
- `abort_field` patch with optional reason
- `add_note` patch with validation
- `remove_note` patch
- Auto-cleanup of state-linked notes

**Summaries (33 tests)** - `tests/unit/engine/summaries.test.ts`
- Progress computation with responsesByFieldId
- Completion logic with aborted fields blocking
- Form state computation

**Validate (41 tests)** - `tests/unit/engine/validate.test.ts`
- State attribute validation rules
- Note ref validation

**Inspect (15 tests)** - `tests/unit/engine/inspect.test.ts`
- Issue generation respects response state

### Integration and End-to-End Testing

**Golden Tests (3 tests)** - `tests/golden/golden.test.ts`
- Session file round-trip with updated hashes
- Markdown serialization stability

**Integration Tests (10 tests)** - `tests/integration/programmaticFill.test.ts`
- Full programmatic fill workflow
- Correct handling of user vs agent fields

**Harness Tests (28 tests)** - `tests/unit/harness/harness.test.ts`
- Step-by-step form filling
- Completion detection

## Manual Testing Needed

### 1. CLI Inspect Command

Verify the inspect command displays notes and response states correctly:

```bash
# Create a test form with notes
markform inspect examples/simple/simple.md

# Expected: Should show field progress with responseState
```

### 2. CLI Dump/Export Commands

Verify export includes notes:

```bash
# JSON export
markform dump examples/simple/simple.md --format json

# YAML export
markform dump examples/simple/simple.md --format yaml

# Expected: Both should include notes array if present
```

### 3. Form with Skip/Abort States

Create a test form with skipped/aborted fields and verify:

```markdown
{% string-field id="name" label="Name" state="skipped" %}
{% /string-field %}

{% note id="n1" ref="name" role="agent" state="skipped" %}
User declined to provide name.
{% /note %}
```

1. Verify parsing works correctly
2. Verify serialization round-trips correctly
3. Verify completion logic blocks on aborted fields

### 4. Web UI (if applicable)

If using `markform serve`, verify:
- Skipped/aborted fields render with appropriate visual indication
- Notes are displayed
- Form completion status reflects new logic

### 5. API Integration

If using the AI SDK integration:
- Verify `createMarkformTools()` generates correct tool definitions
- Verify `abort_field` and note patches work in tool responses
- Verify completion detection in harness

## User Review Checklist

- [ ] Review automated test coverage (518 tests passing)
- [ ] Test CLI inspect with a form containing notes
- [ ] Test CLI dump/export with notes
- [ ] Verify architecture docs reflect new types
- [ ] Review plan and impl specs for completeness
