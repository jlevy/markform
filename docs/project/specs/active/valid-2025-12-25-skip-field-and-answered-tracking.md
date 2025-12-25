# Feature Validation: Skip Field Operation and Answered/Skipped Tracking

## Purpose

This validation spec documents automated and manual validation performed for the skip_field
feature implementation. The feature adds explicit field acknowledgment semantics to markform.

**Feature Plan:** [plan-2025-12-25-skip-field-and-answered-tracking.md](plan-2025-12-25-skip-field-and-answered-tracking.md)

**Additional Change:** This PR also replaces `node:crypto` with `js-sha256` for portability
(enables usage in non-Node environments).

## Stage 4: Validation Stage

## Automated Validation (Testing Performed)

### Unit Testing

#### 1. Skip Field Patch Application (`tests/unit/engine/apply.test.ts`)

**skip_field patch handling:**

- ✅ Applies `skip_field` to optional field - sets skipped=true, clears value
- ✅ Rejects `skip_field` on required field - returns error
- ✅ Stores skip reason in field progress
- ✅ Skipping field with existing value clears the value
- ✅ Setting value on skipped field clears skip state

#### 2. Progress Computation (`tests/unit/engine/summaries.test.ts`)

**State tracking:**

- ✅ Field with value: submitted=true, skipped=false
- ✅ Skipped field: submitted=false, skipped=true
- ✅ Empty field (not yet answered or skipped): submitted=false, skipped=false

**Counts:**

- ✅ `answeredFields` counts fields with values
- ✅ `skippedFields` counts explicitly skipped fields
- ✅ Clearing a value decrements answeredFields
- ✅ Setting value on skipped field: answeredFields++, skippedFields--

**Completion logic:**

- ✅ Form with optional fields not answered or skipped is NOT complete
- ✅ Form with all fields answered IS complete
- ✅ Form with mix of answered + skipped (totaling all fields) IS complete
- ✅ Form with empty required field is NOT complete (even if optional fields skipped)

#### 3. Parse Validation (`tests/unit/engine/parse.test.ts`)

**Checkbox mode/required constraints:**

- ✅ Rejects `checkboxMode="explicit"` with `required=false`
- ✅ Accepts `checkboxMode="explicit"` without required attribute (defaults to true)
- ✅ Accepts `checkboxMode="explicit"` with `required=true` (redundant but valid)
- ✅ `checkboxMode="multi"` defaults to optional
- ✅ `checkboxMode="simple"` defaults to optional

#### 4. Console Interactive Mode (`tests/unit/cli/interactivePrompts.test.ts`)

**skip_field UI support:**

- ✅ Shows skip option for optional string field
- ✅ Shows skip option for optional number field
- ✅ Shows skip option for optional string_list field
- ✅ Shows skip option for optional single_select field
- ✅ Shows skip option for optional multi_select field
- ✅ Shows skip option for optional checkboxes field
- ✅ Returns `skip_field` patch when skip option selected
- ✅ Does NOT show skip option for required fields

#### 5. Web Serve Mode (`tests/unit/web/serve-render.test.ts`)

**skip_field UI support:**

- ✅ Renders skip button for optional string field
- ✅ Renders skip button for optional number field
- ✅ Does NOT render skip button for required fields
- ✅ Shows skipped indicator for previously skipped fields
- ✅ Disables input for skipped fields

### Integration and End-to-End Testing

#### Golden Tests (`tests/golden/`)

**Session: `simple-with-skips.session.yaml`**

- ✅ Session uses `skip_field` patches for optional fields
- ✅ Tracks `answered_field_count` and `skipped_field_count` in turn.after
- ✅ Verifies completion with answered + skipped == total
- ✅ Session passes all verification checks

**Session runner updates:**

- ✅ Runner tracks and verifies `answeredFieldCount`
- ✅ Runner tracks and verifies `skippedFieldCount`

### Manual Testing Needed

The following items require manual verification by the user:

#### 1. Console Interactive Mode (CLI `fill --interactive`)

Run the following command and verify UI behavior:

```bash
pnpm markform fill packages/markform/examples/simple/simple.form.md --interactive
```

**Verify:**

- [ ] Optional fields (score, notes, optional_number, related_url) show "Skip this field" option
- [ ] Required fields (name, email, age, website, etc.) do NOT show skip option
- [ ] Selecting "Skip" for an optional field advances to next field
- [ ] Review at end shows "⊘ Skipped" indicator for skipped fields
- [ ] Form completes successfully when all fields are answered or skipped

#### 2. Web Serve Mode (CLI `serve`)

Run the following command and test in browser:

```bash
pnpm markform serve packages/markform/examples/simple/simple.form.md
```

Open http://localhost:3000 in browser.

**A. Skip Button Rendering:**

- [ ] Optional fields (score, notes, optional_number, related_url) have a "Skip" button
- [ ] Required fields (name, email, age, website, etc.) do NOT have skip button
- [ ] Skip button is styled appropriately (gray/muted color)

**B. Skip Button Functionality:**

- [ ] Clicking "Skip" on an optional field:
  - [ ] Button text changes to "Unskip"
  - [ ] Input field becomes disabled/grayed out
  - [ ] "Skipped" indicator appears
- [ ] Clicking "Unskip" reverses the skip state:
  - [ ] Button text returns to "Skip"
  - [ ] Input field becomes enabled again
  - [ ] "Skipped" indicator disappears

**C. Form Submission with Skips:**

- [ ] Fill required fields (name, email, age, website, tags, priority, categories, checkboxes)
- [ ] Skip some optional fields (e.g., score, notes)
- [ ] Fill other optional fields (e.g., references)
- [ ] Click "Save and Continue"
- [ ] Verify form saves correctly with mix of filled and skipped fields
- [ ] Reload page and verify skipped state persists

**D. Skip and Value Interaction:**

- [ ] Skip an optional field, then type a value - skip state should clear
- [ ] Previously skipped field should become editable when submitting with value

#### 3. CLI Inspect Output

Run inspect on a filled form with skipped fields:

```bash
# First, fill the form using mock with skips
pnpm markform fill packages/markform/examples/simple/simple.form.md --agent=mock \
  --mock-source packages/markform/examples/simple/simple-skipped-filled.form.md \
  --output /tmp/test-skipped.form.md

# Then inspect the filled form
pnpm markform inspect /tmp/test-skipped.form.md
```

**Verify:**

- [ ] Inspect output shows `answeredFields` count
- [ ] Inspect output shows `skippedFields` count
- [ ] `isComplete` is true when answered + skipped equals total fields

#### 4. CLI Fill Output (Non-Interactive Mock Mode)

Run fill with mock agent and verify transcript output:

```bash
pnpm markform fill packages/markform/examples/simple/simple.form.md --agent=mock \
  --mock-source packages/markform/examples/simple/simple-skipped-filled.form.md \
  --verbose
```

**Verify:**

- [ ] Console output shows `skip_field` patches being applied
- [ ] Summary shows correct answered/skipped counts
- [ ] Session transcript records skip operations

#### 5. Portability (node:crypto removal)

The `js-sha256` library replaces `node:crypto` for SHA256 hashing. This change enables
markform to work in environments without Node.js built-in modules (e.g., edge runtimes).

**Verify golden tests pass:**

```bash
pnpm test -- --testPathPattern=golden
```

- [ ] Golden tests pass (SHA256 hashes match expected values)
- [ ] No `node:crypto` imports remain in harness or runner code

## Revision History

| Date | Author | Changes |
| --- | --- | --- |
| 2025-12-25 | Claude | Initial validation spec |
| 2025-12-25 | Claude | Expanded manual web serve testing (skip button functionality, form submission) |
