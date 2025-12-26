# Feature Validation: Unified Response Model with Notes

## Purpose

This validation spec documents post-testing validation for the unified response model
refactor, which includes three major changes:

1. **Unified Response Model** (markform-203) — Replace dual-map value model with unified
   `responsesByFieldId`

2. **Skip/Abort Reason in Sentinel** (markform-254) — Embed reasons directly in sentinel
   values `|SKIP| (reason)`

3. **AnswerState/FieldState Refactor** (markform-255) — Cleaner orthogonal types with
   three dimensions

**Feature Plans:**

- `plan-2025-12-25-unified-response-model-with-notes.md`

- `plan-2025-12-26-skip-abort-reason-in-sentinel.md`

- `plan-2025-12-26-answer-state-field-state-refactor.md`

**Implementation Plan:** `impl-2025-12-25-unified-response-model-with-notes.md`

## Stage 4: Validation Stage

## Overview of Changes

This is a major internal refactor of the markform engine:

### 1. Core Type Changes (markform-203, markform-255)

- Added `AnswerState` type: `"unanswered" | "answered" | "skipped" | "aborted"` (renamed
  from `ResponseState`, with `'empty'` → `'unanswered'`)

- Added `FieldResponse` wrapper: `{ state: AnswerState; value?: FieldValue; reason?:
  string }`

- Replaced `valuesByFieldId` + `skipsByFieldId` with unified `responsesByFieldId`

- Added `Note` and `NoteId` types for first-class note support (general-purpose only, no
  `state` attribute)

- Added new patches: `abort_field`, `add_note`, `remove_note`

- Updated `skip_field` to require `role` parameter

### 2. FieldProgress and ProgressCounts Refactor (markform-255)

- **FieldProgress**: Replaced `state: ProgressState` with two orthogonal booleans:
  `valid` and `empty`

- **ProgressCounts**: Three orthogonal dimensions:

  - Dimension 1: AnswerState (`unansweredFields`, `answeredFields`, `skippedFields`,
    `abortedFields`)

  - Dimension 2: Validity (`validFields`, `invalidFields`)

  - Dimension 3: Value presence (`emptyFields`, `filledFields`)

### 3. Parsing Changes (markform-203, markform-254)

- Parse `state` attribute on field tags (`state="skipped"`, `state="aborted"`)

- Parse sentinel values with parenthesized reason: `|SKIP| (reason text)`

- Parse `{% note %}` tags with id, ref, role, and text (no `state` attribute)

- Reject notes with `state` attribute (strict validation)

### 4. Serialization Changes (markform-203, markform-254)

- Serialize `state` attribute on field tags for skipped/aborted fields

- Serialize sentinel with reason: `|SKIP| (reason text)` in value fence

- Serialize notes at end of form sorted by ID

- Structured export format includes `reason` field for JSON/YAML

### 5. Apply Logic Changes (markform-203, markform-254)

- Updated all patch handlers to work with `FieldResponse`

- Implemented `abort_field`, `add_note`, `remove_note` handlers

- Store skip/abort reason in `FieldResponse.reason` (not in notes)

- Removed auto-cleanup of state-linked notes (no longer needed)

### 6. Completion Logic Changes (markform-203)

- Updated `isFormComplete()` to require `abortedFields == 0`

- Updated `computeFormState()` to return ‘invalid’ when aborted fields exist

### 7. Simplifications

- Removed `remove_notes` patch type (simplified to just `remove_note`)

- Removed `state` attribute from `Note` type (notes are general-purpose only)

- Removed `state` parameter from `add_note` patch

## Automated Validation (Testing Performed)

### Unit Testing

All 516+ tests pass.
Key test coverage includes:

**Core Types (29 tests)** - `tests/unit/engine/coreTypes.test.ts`

- Zod schema validation for all new types

- AnswerState, FieldResponse, Note, NoteId schemas

- New patch type schemas (abort_field, add_note, remove_note)

**Parse (46 tests)** - `tests/unit/engine/parse.test.ts`

- Parse `state` attribute on field tags

- Parse sentinel values with parenthesized reason: `|SKIP| (reason)`

- Parse `{% note %}` tags (without state attribute)

- Reject notes with `state` attribute

- Validation of invalid state combinations

**Serialize (34 tests)** - `tests/unit/engine/serialize.test.ts`

- Serialize state attributes on field tags

- Serialize sentinel with reason in value fence

- Serialize notes at end of form (no state attribute)

- Round-trip preservation of `|SKIP| (reason)` format

**Apply (28 tests)** - `tests/unit/engine/apply.test.ts`

- `skip_field` patch with role and reason stored in FieldResponse

- `abort_field` patch with reason stored in FieldResponse

- `add_note` patch with validation (no state parameter)

- `remove_note` patch

**Summaries (33 tests)** - `tests/unit/engine/summaries.test.ts`

- Progress computation with three orthogonal dimensions

- FieldProgress with `answerState`, `valid`, `empty`

- ProgressCounts with AnswerState/Validity/ValuePresence dimensions

- Completion logic with aborted fields blocking

- Form state computation

**Validate (41 tests)** - `tests/unit/engine/validate.test.ts`

- State attribute validation rules

- Note ref validation

**Inspect (15 tests)** - `tests/unit/engine/inspect.test.ts`

- Issue generation respects answer state

### Integration and End-to-End Testing

**Golden Tests (3 tests)** - `tests/golden/golden.test.ts`

- Session file round-trip with updated hashes

- Markdown serialization stability with realistic notes

- Skip/abort with reason serialization

**Integration Tests (10 tests)** - `tests/integration/programmaticFill.test.ts`

- Full programmatic fill workflow

- Correct handling of user vs agent fields

**Harness Tests (28 tests)** - `tests/unit/harness/harness.test.ts`

- Step-by-step form filling

- Completion detection

## Manual Testing Needed

### 1. CLI Inspect Command

Verify the inspect command displays answerState and three-dimensional counts:

```bash
markform inspect examples/simple/simple.form.md

# Expected: Should show field progress with answerState (not responseState)
# Expected: Should show ProgressCounts with three dimensions
```

### 2. CLI Dump/Export Commands

Verify export includes reason for skipped/aborted fields:

```bash
# YAML export of form with skipped fields
markform dump examples/simple/simple-skipped-filled.form.md --format yaml

# Expected: Should include reason field for skipped fields
# Expected: Should include notes array (general-purpose, no state)
```

### 3. Skip/Abort with Reason

Parse and serialize a form with skip/abort reasons:

```markdown
{% string-field id="competitor_analysis" label="Competitor analysis" state="skipped" %}
```value
|SKIP| (Information not publicly available)
```
{% /string-field %}
```

1. Verify parsing extracts reason to `FieldResponse.reason`
2. Verify serialization round-trips correctly with parenthesized format
3. Verify completion logic blocks on aborted fields

### 4. Note Validation

Verify notes work correctly:

```markdown
{% note id="n1" ref="form_id" role="agent" %}
General observation about the form.
{% /note %}
```

1. Notes without `state` attribute should parse correctly

2. Notes with `state` attribute should be rejected with clear error

### 5. Web UI (if applicable)

If using `markform serve`, verify:

- Skipped/aborted fields render with appropriate visual indication

- Notes are displayed

- Form completion status reflects new logic

### 6. API Integration

If using the AI SDK integration:

- Verify `createMarkformTools()` generates correct tool definitions

- Verify `abort_field` and note patches work in tool responses

- Verify completion detection in harness

## User Review Checklist

- [ ] Review automated test coverage (516+ tests passing)

- [ ] Test CLI inspect shows `answerState` (not `responseState`)

- [ ] Test CLI dump includes `reason` for skipped/aborted fields

- [ ] Verify architecture docs reflect new types (AnswerState, ProgressCounts)

- [ ] Review plan specs for all three refactors

- [ ] Verify notes with `state` attribute are rejected

- [ ] Verify `|SKIP| (reason)` format parses and serializes correctly
