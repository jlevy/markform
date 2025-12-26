# Implementation Spec: Unified Response Model with Notes

## Purpose

This implementation spec covers the refactoring of markform’s form value model to
cleanly support skipped fields, aborted fields, and agent notes as first-class concepts.

**Key Design Principle:** Response state (`empty`/`answered`/`skipped`/`aborted`) is
orthogonal to field type.
`FieldValue.kind` remains strictly for field types — no sentinel kinds are added.

**Feature Plan:** plan-2025-12-25-unified-response-model-with-notes.md

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN — this is a breaking
  refactor of the value model.
  `valuesByFieldId` and `skipsByFieldId` are replaced by unified `responsesByFieldId`.

- **Library APIs**: DO NOT MAINTAIN — `skip_field` patch now requires `role` and sets
  response state, not metadata.
  New patches added.

- **File formats**: SUPPORT BOTH — Old forms without state attributes/notes work
  unchanged. New forms with `state` attribute and `{% note %}` tags parse correctly.

## Stage 3: Implementation Stage

### Implementation Phases

The implementation is broken into 8 phases:

- **Phase 1:** Core Type Changes (7 beads)

- **Phase 2:** Parsing (5 beads)

- **Phase 3:** Serialization (5 beads)

- **Phase 4:** Apply Logic (6 beads)

- **Phase 5:** Progress & Completion (5 beads)

- **Phase 6:** Testing (9 beads)

- **Phase 7:** CLI Updates (2 beads)

- **Phase 8:** Architecture Documentation (10 beads)

* * *

## Phase 1: Core Type Changes

### Summary

Add new types for response state, field response wrapper, notes, and error taxonomy.
Update existing types to use the new model.

### Beads

| Bead ID | Description |
| --- | --- |
| markform-204 | Add `ResponseState` type and `FieldResponse` interface |
| markform-205 | Add `Note`, `NoteId` types |
| markform-206 | Update `ParsedForm` — replace `valuesByFieldId` + `skipsByFieldId` with `responsesByFieldId`, add `notes` |
| markform-207 | Update `Patch` union — add `abort_field`, `add_note`, `remove_note`, `remove_notes`; update `skip_field` with `role` |
| markform-208 | Update `FieldProgress` — replace `submitted`/`skipped` with `responseState`, add `hasNotes`, `noteCount` |
| markform-209 | Update `ProgressCounts` — add `abortedFields`, `emptyFields`, `totalNotes`; remove `submittedFields` |
| markform-210 | Add `ParseError` and `ValidationError` types with error taxonomy |

### Files to Touch

- `packages/markform/src/engine/coreTypes.ts` (types and Zod schemas)

### Type Definitions

#### markform-204: ResponseState and FieldResponse

```typescript
/**
 * Response state for a field.
 * Orthogonal to field type — any field can be in any response state.
 */
type ResponseState = 'empty' | 'answered' | 'skipped' | 'aborted';

/**
 * Field response: combines response state with optional value.
 * Used in responsesByFieldId for all fields.
 */
interface FieldResponse {
  state: ResponseState;
  value?: FieldValue;  // present only when state === 'answered'
}
```

**Design rationale:** Keeping `kind` strictly for field types ensures:

- Switch statements on `value.kind` handle all field types without sentinel branches

- Exhaustiveness checks in TypeScript work correctly

- Field-type logic is cleanly separated from response-state logic

#### markform-205: Note and NoteId

```typescript
/** Unique note ID (implementation uses n1, n2, n3...) */
type NoteId = string;

/** Note attached to a field, group, or form */
interface Note {
  id: NoteId;                           // unique note ID
  ref: Id;                              // target ID (field, group, or form)
  role: string;                         // who created (agent, user, ...)
  state?: 'skipped' | 'aborted';        // optional: links note to action
  text: string;                         // markdown content
}
```

#### markform-206: Updated ParsedForm

```typescript
interface ParsedForm {
  schema: FormSchema;
  responsesByFieldId: Record<Id, FieldResponse>;  // replaces valuesByFieldId + skipsByFieldId
  notes: Note[];                                   // NEW: agent notes
  docs: DocumentationBlock[];
  orderIndex: Id[];
  idIndex: Map<Id, IdIndexEntry>;
}
```

**Remove:** `SkipInfo` type and `skipsByFieldId` property.

#### markform-207: Updated Patch Union

```typescript
type Patch =
  | SetStringPatch
  | SetNumberPatch
  | SetStringListPatch
  | SetCheckboxesPatch
  | SetSingleSelectPatch
  | SetMultiSelectPatch
  | SetUrlPatch
  | SetUrlListPatch
  | ClearFieldPatch
  | SkipFieldPatch     // updated: now requires role
  | AbortFieldPatch    // NEW
  | AddNotePatch       // NEW
  | RemoveNotePatch    // NEW
  | RemoveNotesPatch;  // NEW

interface SkipFieldPatch {
  op: 'skip_field';
  fieldId: Id;
  role: string;        // NEW: required
  reason?: string;
}

interface AbortFieldPatch {
  op: 'abort_field';
  fieldId: Id;
  role: string;
  reason?: string;
}

interface AddNotePatch {
  op: 'add_note';
  ref: Id;
  role: string;
  text: string;
  state?: 'skipped' | 'aborted';
}

interface RemoveNotePatch {
  op: 'remove_note';
  noteId: NoteId;
}

interface RemoveNotesPatch {
  op: 'remove_notes';
  ref: Id;
  role: string;
}
```

#### markform-208: Updated FieldProgress

```typescript
interface FieldProgress {
  kind: FieldKind;
  required: boolean;
  responseState: ResponseState;  // replaces submitted + skipped booleans
  hasNotes: boolean;             // NEW
  noteCount: number;             // NEW
  state: ProgressState;
  valid: boolean;
  issueCount: number;
  checkboxProgress?: CheckboxProgressCounts;
}
```

**Remove:** `submitted: boolean` and `skipped: boolean` properties.

#### markform-209: Updated ProgressCounts

```typescript
interface ProgressCounts {
  totalFields: number;
  requiredFields: number;

  // Response state counts (mutually exclusive, sum to totalFields)
  answeredFields: number;
  skippedFields: number;
  abortedFields: number;   // NEW
  emptyFields: number;     // NEW

  totalNotes: number;      // NEW

  // Validation counts (unchanged)
  completeFields: number;
  incompleteFields: number;
  invalidFields: number;
  emptyRequiredFields: number;
  emptyOptionalFields: number;
}
```

**Invariant:** `answeredFields + skippedFields + abortedFields + emptyFields ==
totalFields`

**Remove:** `submittedFields` property (use `answeredFields` instead).

#### markform-210: Error Types

```typescript
/** Location information for error reporting */
interface ErrorLocation {
  line?: number;
  column?: number;
  fieldId?: Id;
  noteId?: NoteId;
}

/** Markdown/Markdoc syntax error */
interface ParseError {
  type: 'parse';
  message: string;
  location?: ErrorLocation;
}

/** Markform model consistency error */
interface ValidationError {
  type: 'validation';
  message: string;
  location?: ErrorLocation;
}

type MarkformError = ParseError | ValidationError;
```

### Automated Testing Strategy

- Type compilation tests (TypeScript will catch type mismatches)

- Zod schema tests for new types

- Update existing tests that use old types to use new types

* * *

## Phase 2: Parsing

### Summary

Parse the `state` attribute on field tags, sentinel values in text value fences, and `{%
note %}` tags. Add validation for state vs filled consistency.

### Beads

| Bead ID | Description |
| --- | --- |
| markform-212 | Parse `state` attribute on field tags (skipped/aborted/empty/answered) |
| markform-213 | Parse sentinel values (`\|SKIP\|`, `\|ABORT\|`) in text value fences |
| markform-214 | Parse `{% note %}` tags with `id`, `ref`, `role`, optional `state` |
| markform-215 | Validate state vs filled consistency; note ref validation |
| markform-250 | Validate `state="skipped"` on required field → error; `state` on field-group → error |

### Files to Touch

- `packages/markform/src/engine/parse.ts`

- `packages/markform/src/engine/markdocConfig.ts` (add note tag definition)

### Implementation Details

#### markform-212: Parse state attribute

```typescript
function parseFieldTag(
  node: Tag,
  fieldKind: FieldKind,
  fieldRequired: boolean
): FieldResponse {
  const stateAttr = node.attributes.state as ResponseState | undefined;
  const isFilled = hasFieldContent(node, fieldKind);

  // ... validation and parsing logic
}
```

**State inference rules:**

- Unfilled field with no `state` attr → `'empty'`

- Filled field with no `state` attr → `'answered'`

- `state="skipped"` on unfilled optional field → `'skipped'`

- `state="aborted"` on unfilled field → `'aborted'`

#### markform-213: Parse sentinels in value fence

```typescript
const SENTINEL_SKIP = '|SKIP|';
const SENTINEL_ABORT = '|ABORT|';

// Only for text syntax fields (string, number, string_list, url, url_list)
if (fieldSyntax === 'text') {
  const valueFenceContent = extractValueFence(node)?.trim() ?? '';

  if (valueFenceContent === SENTINEL_SKIP) {
    return { state: 'skipped' };
  }
  if (valueFenceContent === SENTINEL_ABORT) {
    return { state: 'aborted' };
  }
}
```

**Field syntax categories:** | FieldKind | FieldSyntax | Sentinels allowed |
|-----------|-------------|-------------------| | string, number, string_list, url,
url_list | text | Yes (in value fence) | | single_select, multi_select, checkboxes |
checkboxes | No (use state attr) |

#### markform-214: Parse note tags

```typescript
function parseNoteTag(node: Tag, idIndex: Map<Id, IdIndexEntry>): Note {
  const id = node.attributes.id as NoteId;
  const ref = node.attributes.ref as string;
  const role = node.attributes.role as string;
  const state = node.attributes.state as 'skipped' | 'aborted' | undefined;
  const text = extractContent(node);

  // Validation...
  return { id, ref, role, state, text };
}
```

#### markform-215 & markform-250: Validation rules

| Scenario | Error Type | Message |
| --- | --- | --- |
| `state="skipped"` on filled field | Validation | "state='skipped' not allowed on filled field" |
| `state="aborted"` on filled field | Validation | "state='aborted' not allowed on filled field" |
| `state="skipped"` on required field | Validation | "Cannot skip required field" |
| `state` attribute on field-group | Validation | "state attribute not allowed on field-groups" |
| Sentinel with conflicting state attr | Validation | "conflicting state='X' with \|Y\| sentinel" |
| Note with invalid ref | Validation | "Note references unknown ID: X" |
| Note missing id/ref/role | Validation | "Note missing required X attribute" |

### Automated Testing Strategy

Unit tests in `tests/unit/engine/parse.test.ts`:

- Parse `state="skipped"` on unfilled string field

- Parse `state="aborted"` on unfilled number field

- Parse `state="skipped"` on unfilled checkboxes

- Parse `|SKIP|` in string field value fence

- Parse `|ABORT|` in url field value fence

- Validation error: `state="skipped"` on filled field

- Validation error: `state="skipped"` on required field

- Validation error: `state` on field-group

- Parse note with all attributes

- Parse note with optional state

- Validation error: note with invalid ref

* * *

## Phase 3: Serialization

### Summary

Serialize the `state` attribute on field tags, notes at end of form, and structured
export format for JSON/YAML.

### Beads

| Bead ID | Description |
| --- | --- |
| markform-216 | Serialize `state` attribute on field tags for skipped/aborted responses |
| markform-217 | Serialize notes at end of form, sorted numerically by ID |
| markform-218 | Value export: structured format by default (`{ state, value? }`) |
| markform-219 | Include notes in YAML/JSON export output |
| markform-251 | Friendly YAML export with sentinel strings (optional `--friendly` flag) |

### Files to Touch

- `packages/markform/src/engine/serialize.ts`

- `packages/markform/src/engine/export.ts` (or equivalent)

### Implementation Details

#### markform-216: Serialize state attribute

```typescript
function serializeFieldTag(field: Field, response: FieldResponse | undefined): string {
  const attrs = buildBaseFieldAttrs(field);

  // No response or empty = no value fence, no state attr
  if (!response || response.state === 'empty') {
    return serializeEmptyField(field, attrs);
  }

  // Skipped or aborted: emit state attribute, no value
  if (response.state === 'skipped' || response.state === 'aborted') {
    attrs.state = response.state;
    return serializeEmptyField(field, attrs);
  }

  // Answered: emit value (no state attribute, defaults to 'answered')
  return serializeFilledField(field, attrs, response.value!);
}
```

**Serialization mapping:** | Internal FieldResponse | → markform format |
|------------------------|-------------------| | `undefined` or `{ state: 'empty' }` |
no value fence, no state attr | | `{ state: 'skipped' }` | `state="skipped"`, no value
fence | | `{ state: 'aborted' }` | `state="aborted"`, no value fence | | `{ state:
'answered', value }` | value fence with content |

#### markform-217: Serialize notes

```typescript
function serializeNotes(notes: Note[]): string {
  // Sort numerically by ID suffix (n1, n2, n10 not n1, n10, n2)
  const sorted = [...notes].sort((a, b) => {
    const aNum = parseInt(a.id.replace(/^n/, ''), 10) || 0;
    const bNum = parseInt(b.id.replace(/^n/, ''), 10) || 0;
    return aNum - bNum;
  });

  return sorted.map(note => {
    const stateAttr = note.state ? ` state="${note.state}"` : '';
    return `{% note id="${note.id}" ref="${note.ref}" role="${note.role}"${stateAttr} %}\n${note.text}\n{% /note %}`;
  }).join('\n\n');
}
```

**Placement:** Notes appear at end of form, before `{% /form %}`.

#### markform-218: Structured export format

```typescript
// Default for JSON and YAML export
function serializeResponseForExport(response: FieldResponse | undefined): unknown {
  if (!response || response.state === 'empty') {
    return { state: 'empty' };
  }
  if (response.state === 'skipped') {
    return { state: 'skipped' };
  }
  if (response.state === 'aborted') {
    return { state: 'aborted' };
  }
  return {
    state: 'answered',
    value: serializeValueContent(response.value!),
  };
}
```

#### markform-251: Friendly export format

```typescript
// Optional --friendly flag for human-readable YAML
function serializeResponseFriendly(response: FieldResponse | undefined): unknown {
  if (!response || response.state === 'empty') return null;
  if (response.state === 'skipped') return '|SKIP|';
  if (response.state === 'aborted') return '|ABORT|';
  return serializeValueContent(response.value!);
}
```

### Automated Testing Strategy

Unit tests in `tests/unit/engine/serialize.test.ts`:

- Serialize `{ state: 'skipped' }` as `state="skipped"` on field tag

- Serialize `{ state: 'aborted' }` as `state="aborted"` on field tag

- Serialize notes at end of form in sorted order

- Round-trip: parse → serialize → parse produces identical result

- JSON export structured format

- YAML export structured format

- Friendly YAML export with sentinels

* * *

## Phase 4: Apply Logic

### Summary

Implement patch handlers for `skip_field`, `abort_field`, `add_note`, `remove_note`,
`remove_notes`. Add auto-cleanup of state-linked notes when setting values.

### Beads

| Bead ID | Description |
| --- | --- |
| markform-220 | Update `skip_field` — set response to `{ state: 'skipped' }`; reject on required fields |
| markform-221 | Implement `abort_field` patch — set response to `{ state: 'aborted' }`; optional note |
| markform-222 | Implement `add_note` patch — validate ref, generate ID, add to notes array |
| markform-223 | Implement `remove_note` and `remove_notes` handlers |
| markform-224 | Auto-cleanup: when setting value on skipped/aborted field, remove state-linked notes |
| markform-252 | Note ID generation — sequential n1, n2, n3 |

### Files to Touch

- `packages/markform/src/engine/apply.ts`

### Implementation Details

#### markform-252: Note ID generation

```typescript
function generateNoteId(form: ParsedForm): NoteId {
  const existingIds = form.notes.map(n => {
    const match = n.id.match(/^n(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  });
  const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
  return `n${maxId + 1}`;
}
```

#### markform-220: skip_field handler

```typescript
function applySkipField(form: ParsedForm, patch: SkipFieldPatch): ApplyResult {
  const field = findFieldById(form, patch.fieldId);
  if (!field) {
    return errorResult(`Field not found: ${patch.fieldId}`);
  }

  if (field.required) {
    return errorResult(`Cannot skip required field: ${field.label}`);
  }

  form.responsesByFieldId[patch.fieldId] = { state: 'skipped' };

  let noteId: NoteId | undefined;
  if (patch.reason) {
    noteId = generateNoteId(form);
    form.notes.push({
      id: noteId,
      ref: patch.fieldId,
      role: patch.role,
      state: 'skipped',
      text: patch.reason,
    });
  }

  return successResult(form, { noteId });
}
```

#### markform-221: abort_field handler

```typescript
function applyAbortField(form: ParsedForm, patch: AbortFieldPatch): ApplyResult {
  const field = findFieldById(form, patch.fieldId);
  if (!field) {
    return errorResult(`Field not found: ${patch.fieldId}`);
  }

  // Abort works on any field (required or optional)
  form.responsesByFieldId[patch.fieldId] = { state: 'aborted' };

  let noteId: NoteId | undefined;
  if (patch.reason) {
    noteId = generateNoteId(form);
    form.notes.push({
      id: noteId,
      ref: patch.fieldId,
      role: patch.role,
      state: 'aborted',
      text: patch.reason,
    });
  }

  return successResult(form, { noteId });
}
```

#### markform-224: Auto-cleanup on value set

```typescript
function applySetValue(form: ParsedForm, patch: SetValuePatch): ApplyResult {
  const existingResponse = form.responsesByFieldId[patch.fieldId];

  // If replacing skipped or aborted, remove state-linked notes
  if (existingResponse?.state === 'skipped' || existingResponse?.state === 'aborted') {
    const stateToRemove = existingResponse.state;
    form.notes = form.notes.filter(
      n => !(n.ref === patch.fieldId && n.state === stateToRemove)
    );
  }

  form.responsesByFieldId[patch.fieldId] = {
    state: 'answered',
    value: patch.value,
  };

  return successResult(form);
}
```

### Automated Testing Strategy

Unit tests in `tests/unit/engine/apply.test.ts`:

- `skip_field` on optional field sets `{ state: 'skipped' }`

- `skip_field` on required field returns error

- `skip_field` with reason adds note

- `abort_field` on any field sets `{ state: 'aborted' }`

- `abort_field` with reason adds note

- `add_note` with valid ref adds note and returns noteId

- `add_note` with invalid ref returns error

- `remove_note` removes specific note

- `remove_notes(ref, role)` removes matching notes

- Setting value on skipped field removes state-linked notes

- Setting value on skipped field preserves general notes

* * *

## Phase 5: Progress & Completion

### Summary

Update progress computation to use the new response model.
Update completion formula to block on aborted fields.

### Beads

| Bead ID | Description |
| --- | --- |
| markform-225 | Implement `getResponseState(response)` helper |
| markform-226 | Update `computeProgressSummary()` — take `responsesByFieldId`, compute counts from state |
| markform-227 | Update `isFormComplete()` — require `abortedFields == 0` |
| markform-228 | Update `computeFormState()` — return `'invalid'` when `abortedFields > 0` |
| markform-229 | Update `inspect.ts` — role-filtered completion, new counts |

### Files to Touch

- `packages/markform/src/engine/summaries.ts`

- `packages/markform/src/engine/inspect.ts`

### Implementation Details

#### markform-225: getResponseState helper

```typescript
function getResponseState(response: FieldResponse | undefined): ResponseState {
  if (!response) return 'empty';
  return response.state;
}
```

#### markform-226: Updated computeProgressSummary

```typescript
export function computeProgressSummary(
  schema: FormSchema,
  responses: Record<Id, FieldResponse>,
  issues: InspectIssue[],
  notes: Note[] = []
): ProgressSummary {
  // Compute counts from response.state
  let answeredFields = 0;
  let skippedFields = 0;
  let abortedFields = 0;
  let emptyFields = 0;

  for (const field of getAllFields(schema)) {
    const response = responses[field.id];
    const state = getResponseState(response);

    switch (state) {
      case 'answered': answeredFields++; break;
      case 'skipped': skippedFields++; break;
      case 'aborted': abortedFields++; break;
      case 'empty': emptyFields++; break;
    }
  }

  // ... rest of computation
}
```

#### markform-227: Updated isFormComplete

```typescript
export function isFormComplete(progress: ProgressSummary): boolean {
  const { counts } = progress;

  // Aborted fields block completion
  if (counts.abortedFields > 0) {
    return false;
  }

  // All fields must be either answered or skipped
  const allAccountedFor =
    (counts.answeredFields + counts.skippedFields) === counts.totalFields;

  // No required validation issues
  return allAccountedFor && counts.invalidFields === 0;
}
```

#### markform-228: Updated computeFormState

```typescript
export function computeFormState(progress: ProgressSummary): ProgressState {
  const { counts } = progress;

  // Aborted fields = invalid state
  if (counts.abortedFields > 0) {
    return 'invalid';
  }

  if (counts.invalidFields > 0) {
    return 'invalid';
  }

  const allAccountedFor =
    (counts.answeredFields + counts.skippedFields) === counts.totalFields;

  if (!allAccountedFor || counts.emptyRequiredFields > 0) {
    return 'incomplete';
  }

  return 'complete';
}
```

### Automated Testing Strategy

Unit tests in `tests/unit/engine/summaries.test.ts`:

- `getResponseState(undefined)` returns `'empty'`

- `getResponseState({ state: 'skipped' })` returns `'skipped'`

- Progress counts computed correctly from response states

- `isFormComplete` returns false when `abortedFields > 0`

- `computeFormState` returns `'invalid'` when `abortedFields > 0`

* * *

## Phase 6: Testing

### Summary

Comprehensive unit tests and golden tests for all new functionality.

### Beads

| Bead ID | Description |
| --- | --- |
| markform-230 | Unit tests: parse `state` attribute on fields |
| markform-231 | Unit tests: parse sentinel in value fence |
| markform-232 | Unit tests: parse `{% note %}` tags |
| markform-233 | Unit tests: serialize state attribute and notes |
| markform-234 | Unit tests: patch operations |
| markform-235 | Unit tests: progress computation with responseState |
| markform-236 | Unit tests: completion logic with abortedFields |
| markform-237 | Golden tests: sessions with skip/abort/notes patches |
| markform-253 | Round-trip tests: markdown, YAML, JSON with notes and sentinels |

### Files to Touch

- `packages/markform/tests/unit/engine/parse.test.ts`

- `packages/markform/tests/unit/engine/serialize.test.ts`

- `packages/markform/tests/unit/engine/apply.test.ts`

- `packages/markform/tests/unit/engine/summaries.test.ts`

- `packages/markform/tests/golden/sessions/` (new session files)

### Test Coverage Requirements

See Testing Plan in plan spec for complete test list (sections 1-9).

* * *

## Phase 7: CLI Updates

### Summary

Update CLI commands to show notes and response state information.

### Beads

| Bead ID | Description |
| --- | --- |
| markform-238 | Update CLI `inspect` to show notes and `responseState` per field |
| markform-239 | Update CLI `dump`/`export` to include notes in all formats |

### Files to Touch

- `packages/markform/src/cli/commands/inspect.ts`

- `packages/markform/src/cli/commands/dump.ts`

- `packages/markform/src/cli/commands/export.ts`

### Implementation Details

#### markform-238: inspect output

Add to the YAML output:

- `responseState` in each field’s progress

- `hasNotes` and `noteCount` per field

- `totalNotes` in counts

- Notes summary section

#### markform-239: dump/export output

Include notes array in JSON and YAML export with structure:
```yaml
notes:
  - id: n1
    ref: company_name
    role: agent
    state: skipped
    text: "Not applicable for this analysis type."
```

* * *

## Phase 8: Architecture Documentation

### Summary

Update the architecture document to reflect the new unified response model.

### Beads

| Bead ID | Description |
| --- | --- |
| markform-240 | Add ResponseState and FieldResponse documentation |
| markform-241 | Add Note type documentation |
| markform-242 | Update ParsedForm documentation |
| markform-243 | Update Patch operations documentation |
| markform-244 | Add Field State attribute and serialization formats |
| markform-245 | Update ProgressCounts documentation |
| markform-246 | Update completion formula documentation |
| markform-247 | Add error taxonomy section |
| markform-248 | Add design decision for unified response model |
| markform-249 | Final review — terminology consistency, organization |

### Files to Touch

- `docs/project/architecture/current/arch-markform-initial-design.md`

* * *

## Dependencies

```
Phase 1 (Types) ──┬─► Phase 2 (Parsing) ──┬─► Phase 4 (Apply) ──► Phase 5 (Progress)
                  │                       │
                  ├─► Phase 3 (Serialization)
                  │
                  └─► All phases depend on Phase 1 types

Phase 6 (Testing) depends on Phases 2-5 implementation
Phase 7 (CLI) depends on Phases 2-5
Phase 8.10 (Final Review) depends on all other Phase 8 beads
```

* * *

## Open Questions (resolve now)

All open questions have been resolved in the plan spec.
See plan spec “Open Questions” section for decisions.

* * *

## Out of Scope (do NOT do now)

- UI changes in web serve mode (follow-up)

- Agent prompt changes to teach abort/note behavior (separate feature)

- Note editing (can add and remove, but not modify)

- Multi-line notes with complex markdown (keep simple for v1)

- Multi-process synchronization (caller’s responsibility)
