# Plan Spec: Skip/Abort Reason Embedded in Sentinel Value

## Purpose

This plan simplifies the skip/abort reason storage mechanism in Markform.
Instead of using notes with `state` attributes to store skip/abort reasons, reasons are
embedded directly in the sentinel value using parenthesized syntax: `%SKIP% (reason)`.

This is a refinement of the unified response model specified in
`plan-2025-12-25-unified-response-model-with-notes.md`.

## Background

**Current Design (from unified response model plan):**

The current plan has two mechanisms for documenting skip/abort reasons:

1. **Sentinel values with reasons**: `%SKIP% reason text` (no delimiter)

2. **Notes with `state` attribute**: `{% note state="skipped" %}reason{% /note %}`

This creates:

- Redundancy (two places to store skip/abort reasons)

- Complex cleanup logic (remove state-linked notes when re-filling a field)

- Extra `state` attribute on `Note` type

- Extra `state` parameter on `add_note` patch

**Related Docs:**

- [arch-markform-design.md.md](../architecture/current/arch-markform-design.md.md) —
  Section “Field State Attributes” (lines 942-995)

- [plan-2025-12-25-unified-response-model-with-notes.md](plan-2025-12-25-unified-response-model-with-notes.md)
  — Parent plan this refines

## Summary of Task

### Core Simplification

1. **Embed reason in sentinel value** — Use parenthesized format:

   - `%SKIP% (Information not publicly available)`

   - `%ABORT% (Cannot determine from available data)`

2. **Store reason in FieldResponse** — Add `reason?: string` field to `FieldResponse`

3. **Remove `state` from Note type** — Notes become purely general-purpose annotations

4. **Remove `state` from `add_note` patch** — No more linking notes to skip/abort
   actions

5. **Simplify re-fill cleanup** — Just clear the reason; no note removal needed

### Serialization Format

**Markdown (markform format):**

````md
{% string-field id="competitor_analysis" label="Competitor analysis" state="skipped" %}
```value
%SKIP% (Information not publicly available)
````
{% /string-field %}
````

**Without reason:**

```md
{% string-field id="competitor_analysis" label="Competitor analysis" state="skipped" %}
{% /string-field %}
````

**Value export (structured JSON/YAML):**

```json
{
  "company_name": { "state": "skipped", "reason": "Not applicable for this analysis" },
  "revenue_m": { "state": "aborted", "reason": "API unavailable" },
  "ticker": { "state": "answered", "value": "ACME" }
}
```

**Value export (friendly YAML):**

```yaml
company_name: "%SKIP% (Not applicable for this analysis)"
revenue_m: "%ABORT% (API unavailable)"
ticker: ACME
```

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN — This is a
  simplifying refactor within the unified response model.
  `Note.state` is removed.

- **Library APIs**: DO NOT MAINTAIN — `add_note` patch loses `state` parameter.
  The unified response model hasn’t shipped yet, so no external callers to break.

- **Server APIs**: N/A

- **File formats**: SUPPORT BOTH — Forms with `{% note state="skipped" %}` still parse
  correctly (state attribute is simply ignored, note becomes general).
  New forms use sentinel-embedded reasons.

- **Database schemas**: N/A

## Stage 1: Planning Stage

### Current State Analysis

**Architecture doc sections affected:**

| Section | Lines | Change |
| --- | --- | --- |
| Field State Attributes | 942-995 | Update sentinel format to use parentheses |
| Note Serialization Format | 996-1055 | Remove `state` attribute from examples |
| Layer 2: Note interface | ~1309 | Remove `state` field |
| Layer 2: FieldResponse | ~1298 | Add `reason?: string` field |
| Layer 4: add_note patch | ~2563 | Remove `state` parameter |
| skip_field behavior | 2625-2631 | Remove note cleanup logic |
| abort_field behavior | 2654-2662 | Remove note cleanup logic |
| Export formats | 2849-2934 | Add `reason` field to structured export |
| Design Decision 6 | 3923-3943 | Update to reflect simplified model |
| Design Decision 7 | 3947-4000 | Update notes section |

**Code files affected:**

| File | Changes |
| --- | --- |
| `coreTypes.ts` | Add `reason` to `FieldResponse`; remove `state` from `Note`; update `AddNotePatch` |
| `parse.ts` | Parse sentinel with parenthesized reason; ignore `state` on notes |
| `serialize.ts` | Emit ` |
| `apply.ts` | Store reason in `FieldResponse.reason`; simplify re-fill cleanup |
| `dumpValues.ts` | Include `reason` in structured export |

### Feature Scope

**In Scope:**

- Sentinel format change: `%SKIP% reason` → `%SKIP% (reason)`

- Add `reason?: string` to `FieldResponse`

- Remove `state?: 'skipped' | 'aborted'` from `Note` interface

- Remove `state` parameter from `add_note` patch

- Update `skip_field` and `abort_field` to store reason in `FieldResponse.reason`

- Simplify re-fill cleanup (just clear reason, no note removal)

- Update structured export to include `reason` field

- Update architecture doc with all changes

**Out of Scope (Explicit Non-Goals):**

- General notes functionality (unchanged)

- `add_note` and `remove_note` patches (still exist, just simpler)

- Role-filtered completion (unchanged)

- Any changes to how response states work

### Acceptance Criteria

**Sentinel parsing:**

1. `%SKIP% (reason text)` parses to `{ state: 'skipped' }` with `reason: 'reason text'`

2. `%ABORT% (reason text)` parses to `{ state: 'aborted' }` with `reason: 'reason text'`

3. `%SKIP%` without parentheses parses to `{ state: 'skipped' }` with no reason

4. `%ABORT%` without parentheses parses to `{ state: 'aborted' }` with no reason

5. Parentheses with empty content `%SKIP% ()` treats as no reason

6. Nested parentheses in reason `%SKIP% (reason (with parens) inside)` handled correctly

**Serialization:**

7. Skipped field with reason serializes as `%SKIP% (reason)`

8. Skipped field without reason serializes with just `state="skipped"` attribute (no
   fence)

9. Aborted field with reason serializes as `%ABORT% (reason)`

10. Round-trip: parse → serialize → parse preserves reason exactly

**Structured export:**

11. Export includes `reason` field: `{ "state": "skipped", "reason": "..." }`

12. Export without reason omits `reason` field: `{ "state": "skipped" }`

13. Import parses `reason` field correctly

**Friendly export:**

14. Friendly format uses `"%SKIP% (reason)"` string

15. Friendly format parses back correctly

**Patch operations:**

16. `skip_field` with `reason` stores it in `FieldResponse.reason`

17. `abort_field` with `reason` stores it in `FieldResponse.reason`

18. `skip_field` without `reason` leaves `FieldResponse.reason` undefined

**Re-fill cleanup:**

19. Setting value on skipped field clears the reason (no note removal needed)

20. Setting value on aborted field clears the reason

**Notes simplified:**

21. Notes no longer have `state` attribute

22. `add_note` patch no longer accepts `state` parameter

23. Legacy forms with `{% note state="skipped" %}` parse (state ignored, becomes general
    note)

## Stage 2: Architecture Stage

### Type Changes

**FieldResponse (update):**

```typescript
interface FieldResponse {
  state: ResponseState;
  value?: FieldValue;    // present only when state === 'answered'
  reason?: string;       // present only when state === 'skipped' or 'aborted'
}
```

**Note (simplify):**

```typescript
interface Note {
  id: NoteId;
  ref: Id;
  role: string;
  // REMOVED: state?: 'skipped' | 'aborted';
  text: string;
}
```

**AddNotePatch (simplify):**

```typescript
interface AddNotePatch {
  op: 'add_note';
  ref: Id;
  role: string;
  text: string;
  // REMOVED: state?: 'skipped' | 'aborted';
}
```

**SkipFieldPatch and AbortFieldPatch (unchanged):**

```typescript
interface SkipFieldPatch {
  op: 'skip_field';
  fieldId: Id;
  role: string;
  reason?: string;  // stored in FieldResponse.reason, not as a note
}

interface AbortFieldPatch {
  op: 'abort_field';
  fieldId: Id;
  role: string;
  reason?: string;  // stored in FieldResponse.reason, not as a note
}
```

### Parsing Logic Changes

```typescript
const SENTINEL_SKIP = '%SKIP%';
const SENTINEL_ABORT = '%ABORT%';

// Regex to match sentinel with optional parenthesized reason
// Matches: %SKIP% or %SKIP% (reason text)
const SENTINEL_PATTERN = /^\|(SKIP|ABORT)\|(?:\s*\((.+)\))?$/s;

function parseSentinel(content: string): { sentinel: 'skip' | 'abort'; reason?: string } | null {
  const trimmed = content.trim();
  const match = trimmed.match(SENTINEL_PATTERN);
  if (!match) return null;

  const sentinel = match[1].toLowerCase() as 'skip' | 'abort';
  const reason = match[2]?.trim();

  return { sentinel, reason: reason || undefined };
}

function parseFieldTag(node: Tag, ...): FieldResponse {
  // ... existing logic ...

  // For text syntax fields, check for sentinel values
  if (fieldSyntax === 'text') {
    const valueFenceContent = extractValueFence(node)?.trim() ?? '';

    const sentinelResult = parseSentinel(valueFenceContent);
    if (sentinelResult) {
      const state = sentinelResult.sentinel === 'skip' ? 'skipped' : 'aborted';

      // Validate against state attr if present
      if (stateAttr && stateAttr !== state) {
        throw new ValidationError(`Conflicting state="${stateAttr}" with |${sentinelResult.sentinel.toUpperCase()}| sentinel`);
      }

      // Validate skip on required field
      if (state === 'skipped' && fieldRequired) {
        throw new ValidationError(`Cannot skip required field`);
      }

      return { state, reason: sentinelResult.reason };
    }

    // ... rest of existing logic ...
  }
}
```

### Serialization Logic Changes

```typescript
function serializeFieldTag(field: Field, response: FieldResponse | undefined): string {
  // ... existing logic ...

  // Skipped or aborted: emit state attribute
  if (response.state === 'skipped' || response.state === 'aborted') {
    attrs.state = response.state;

    // If reason present, emit sentinel with reason in value fence
    if (response.reason) {
      const sentinel = response.state === 'skipped' ? SENTINEL_SKIP : SENTINEL_ABORT;
      const valueFence = `\`\`\`value\n${sentinel} (${response.reason})\n\`\`\``;
      return `{% ${tagName} ${formatAttrs(attrs)} %}\n${valueFence}\n{% /${tagName} %}`;
    }

    // No reason: just state attribute, no value fence
    return serializeEmptyField(field, attrs);
  }

  // ... rest of existing logic ...
}

// Structured export
function serializeResponseForExport(response: FieldResponse | undefined): unknown {
  if (!response || response.state === 'empty') {
    return { state: 'empty' };
  }
  if (response.state === 'skipped') {
    return response.reason
      ? { state: 'skipped', reason: response.reason }
      : { state: 'skipped' };
  }
  if (response.state === 'aborted') {
    return response.reason
      ? { state: 'aborted', reason: response.reason }
      : { state: 'aborted' };
  }
  return {
    state: 'answered',
    value: serializeValueContent(response.value!),
  };
}

// Friendly export
function serializeResponseFriendly(response: FieldResponse | undefined): unknown {
  if (!response || response.state === 'empty') {
    return null;
  }
  if (response.state === 'skipped') {
    return response.reason ? `%SKIP% (${response.reason})` : '%SKIP%';
  }
  if (response.state === 'aborted') {
    return response.reason ? `%ABORT% (${response.reason})` : '%ABORT%';
  }
  return serializeValueContent(response.value!);
}
```

### Apply Logic Changes

```typescript
function applySkipField(form: ParsedForm, patch: SkipFieldPatch): ApplyResult {
  const field = findFieldById(form, patch.fieldId);
  if (!field) {
    return errorResult(`Field not found: ${patch.fieldId}`);
  }

  if (field.required) {
    return errorResult(`Cannot skip required field: ${field.label}`);
  }

  // Set response state to skipped with optional reason
  // NO NOTE CREATED - reason is in the FieldResponse
  form.responsesByFieldId[patch.fieldId] = {
    state: 'skipped',
    reason: patch.reason,  // stored directly, not as a note
  };

  return successResult(form);
}

function applyAbortField(form: ParsedForm, patch: AbortFieldPatch): ApplyResult {
  const field = findFieldById(form, patch.fieldId);
  if (!field) {
    return errorResult(`Field not found: ${patch.fieldId}`);
  }

  // Set response state to aborted with optional reason
  // NO NOTE CREATED - reason is in the FieldResponse
  form.responsesByFieldId[patch.fieldId] = {
    state: 'aborted',
    reason: patch.reason,  // stored directly, not as a note
  };

  return successResult(form);
}

// SIMPLIFIED: No note cleanup needed
function applySetValue(form: ParsedForm, patch: SetValuePatch): ApplyResult {
  // Just set the new response - reason is automatically cleared
  // NO NEED to find and remove state-linked notes
  form.responsesByFieldId[patch.fieldId] = {
    state: 'answered',
    value: patch.value,
    // reason is implicitly undefined
  };

  return successResult(form);
}
```

### Note Serialization (simplified)

```typescript
// Notes no longer have state attribute
function serializeNotes(notes: Note[]): string {
  const sorted = sortNotesByIdForExport(notes);

  return sorted.map(note => {
    // REMOVED: stateAttr
    return `{% note id="${note.id}" ref="${note.ref}" role="${note.role}" %}\n${note.text}\n{% /note %}`;
  }).join('\n\n');
}
```

## Stage 3: Refine Architecture

### Simplifications Achieved

| Before | After |
| --- | --- |
| Two places for skip/abort reason (sentinel + note) | One place (sentinel only) |
| Note has `state` field | Note is purely general-purpose |
| `add_note` has `state` parameter | `add_note` is simpler |
| Re-fill cleanup removes state-linked notes | Re-fill just clears reason |
| Complex note filtering on re-fill | None needed |

### Code Savings

- Remove `state` field from `Note` interface

- Remove `state` parameter from `AddNotePatch`

- Remove note filtering logic in `applySetValue`

- Remove conditional note creation in `applySkipField` and `applyAbortField`

- Simpler serialization (no state attr on notes)

### Design Decisions

1. **Parenthesized reason format** — `%SKIP% (reason)` uses parentheses to clearly
   delimit the reason text.
   This:

   - Makes parsing unambiguous

   - Visually distinguishes the reason as metadata

   - Handles edge cases (empty reason, nested parens)

2. **Reason in FieldResponse, not Note** — The skip/abort reason is stored directly in
   `FieldResponse.reason` rather than as a separate note.
   This:

   - Keeps the reason co-located with the field state

   - Eliminates the need to correlate notes with fields

   - Simplifies re-fill cleanup

3. **Notes are purely general-purpose** — After this change, notes are only for general
   observations that aren’t tied to skip/abort actions.
   This makes the notes system cleaner and more predictable.

4. **Backward compatibility for legacy notes** — Forms with `{% note state="skipped" %}`
   still parse; the `state` attribute is ignored and the note becomes a general note.
   This is acceptable because:

   - The unified response model hasn’t shipped yet

   - Existing forms don’t use this feature

### Testing Strategy

**Unit tests for sentinel parsing:**

- `%SKIP%` → skipped, no reason

- `%SKIP% (simple reason)` → skipped, reason: “simple reason”

- `%ABORT% (reason with (nested) parens)` → aborted, reason: “reason with (nested)
  parens”

- `%SKIP% ()` → skipped, no reason (empty parens treated as no reason)

- `%SKIP% (multiline\nreason)` → skipped, reason preserved with newlines

**Round-trip tests:**

- Parse → serialize → parse preserves reason exactly

- Forms with/without reasons serialize correctly

- Structured export includes reason field when present

**Patch tests:**

- `skip_field` with reason stores in `FieldResponse.reason`

- `skip_field` without reason leaves reason undefined

- Setting value on skipped field clears reason

- No notes created by skip/abort patches (verify notes array unchanged)

## Architecture Documentation Changes

### Updates Required

1. **Field State Attributes section (lines 942-995):**

   - Update sentinel format from `%SKIP% reason` to `%SKIP% (reason)`

   - Update examples

2. **Note Serialization Format section (lines 996-1055):**

   - Remove `state` attribute from all note examples

   - Remove explanation of state linking

   - Simplify to show notes as general-purpose only

3. **Layer 2: Note interface (~line 1309):**

   - Remove `state?: 'skipped' | 'aborted'` field

4. **Layer 2: FieldResponse (~line 1298):**

   - Add `reason?: string` field with documentation

5. **Layer 4: add_note patch (~line 2563):**

   - Remove `state` parameter from type definition

   - Update semantics description

6. **skip_field/abort_field behavior (~lines 2625-2662):**

   - Remove note creation when reason provided

   - Remove note cleanup logic when setting value

   - Update to say reason is stored in FieldResponse

7. **Export formats section (~lines 2849-2934):**

   - Add `reason` field to structured format examples

   - Update friendly format to show `%SKIP% (reason)`

8. **Design Decision 6 (~lines 3923-3943):**

   - Update to reflect simplified model

9. **Design Decision 7 (~lines 3947-4000):**

   - Clarify notes are purely general-purpose

   - Remove state-linking discussion

## Open Questions

### Resolved

1. **Should empty parentheses `%SKIP% ()` be treated as no reason?**

   - **Decision:** Yes, treat as equivalent to `%SKIP%` with no reason

2. **How to handle nested parentheses in reason?**

   - **Decision:** Use greedy matching - everything after `%SKIP% (` up to the final `)`
     is the reason

3. **Should the `state` attribute on legacy notes cause an error?**

   - **Decision:** No, just ignore it for backward compatibility

### Deferred

None - this is a straightforward simplification.

## Revision History

| Date | Author | Changes |
| --- | --- | --- |
| 2025-12-26 | Claude | Initial draft based on architecture review discussion |
