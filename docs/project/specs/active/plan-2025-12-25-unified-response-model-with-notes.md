# Plan Spec: Unified Response Model with Notes

## Purpose

This is a technical design doc for refactoring markform’s form value model to cleanly
support skipped fields, aborted fields, and agent notes as first-class concepts.

**This spec supersedes `plan-2025-12-25-skip-field-and-answered-tracking.md`** with a
cleaner, more orthogonal design.

## Background

**Current Problems:**

1. **Skip state is runtime-only metadata** — The current design stores skip state in
   `skipsByFieldId` separate from values, and explicitly states “Skip state is not
   serialized to the form markdown file.”
   This breaks the “form is the state” principle.

2. **No “aborted” concept** — When an agent genuinely can’t answer a required field,
   there’s no way to express this explicitly.
   The agent either makes something up or leaves it empty (indistinguishable from “not
   yet attempted”).

3. **Three-way ambiguity** — An empty field could mean:

   - Template state (never attempted)

   - Agent tried but couldn’t find a value

   - Agent explicitly chose to skip

4. **Reasons stored separately** — Skip reasons are attached to the skip metadata, not
   as a general-purpose mechanism.

**Related Docs:**

- [arch-markform-initial-design.md](../architecture/current/arch-markform-initial-design.md)

- [plan-2025-12-25-skip-field-and-answered-tracking.md](plan-2025-12-25-skip-field-and-answered-tracking.md)
  — superseded by this spec

## Summary of Task

### Core Design Principles

1. **Sentinels are simple tokens** — `|SKIP|` and `|ABORT|` with no embedded data

2. **Notes are a general mechanism** — Text linked to any ID (field, group, form)

3. **Skip/abort with reason = syntactic sugar** — Sets sentinel + adds note

4. **Form is the state** — All response data serializes to the form markdown

### Error Types (Parse vs Validation)

Markform has two distinct error categories:

| Error Type | Scope | When | Examples |
| --- | --- | --- | --- |
| **Parse error** | Markdown/Markdoc syntax | During lexing/parsing | Malformed tags, unclosed fences, invalid attribute syntax |
| **Validation error** | Markform model consistency | During semantic analysis | `state="skipped"` on filled field, invalid ref in note, conflicting attributes |

**Definitions:**

- **Parse errors** occur during initial markdown parsing (Markdoc layer).
  The input is syntactically malformed and cannot be tokenized/parsed into an AST.

- **Validation errors** occur during markform model construction and semantic checks.
  The markdown parses correctly, but the markform semantics are violated.

- Both should be surfaced clearly with location info (line numbers, field IDs).

In this spec, “validation error” is used for markform model consistency issues, not
markdown syntax issues.

**Architecture and Code Changes Required:**

| Item | Current State | Required Change |
| --- | --- | --- |
| `coreTypes.ts` | No formal error types | Add `ParseError` and `ValidationError` types with location info |
| `parse.ts` | Uses generic errors | Distinguish parse vs validation errors; throw appropriate type |
| `arch-markform-initial-design.md` | No error taxonomy | Add section on error types and when each applies |
| Error messages | Inconsistent terminology | Use "parse error" only for syntax; "validation error" for semantics |

**Error Type Definitions (to add to `coreTypes.ts`):**

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

**Examples of each error type:**

| Scenario | Error Type | Reason |
| --- | --- | --- |
| `{% string-field id="x" ` (unclosed tag) | Parse | Syntax malformed |
| `\`\`\`value` without closing fence | Parse | Syntax malformed |
| `state="skipped"` on filled field | Validation | Semantically invalid |
| Note with invalid `ref` | Validation | References non-existent ID |
| Conflicting `state` attr and sentinel | Validation | Semantically inconsistent |
| Duplicate field IDs | Validation | Model constraint violated |
| `state` attr on field-group | Validation | Wrong element type |

### 1. Field Syntax Categories

Fields are categorized by their value representation syntax:

```typescript
/**
 * How field values are represented in markform syntax.
 * This determines how "filled" is detected during parsing.
 */
type FieldSyntax = 'text' | 'checkboxes';
```

**Mapping of field kinds to syntax:**

| FieldKind | FieldSyntax | Filled When |
| --- | --- | --- |
| `string` | `text` | Value fence has non-empty content |
| `number` | `text` | Value fence has non-empty content |
| `string_list` | `text` | Value fence has non-empty content |
| `url` | `text` | Value fence has non-empty content |
| `url_list` | `text` | Value fence has non-empty content |
| `single_select` | `text` | Value fence has non-empty content |
| `multi_select` | `text` | Value fence has non-empty content |
| `checkboxes` | `checkboxes` | Any inline marker changed from default |

**Note:** `single_select` and `multi_select` use `text` syntax because their values are
serialized in value fences (selected option IDs), not via inline markers.

### 2. Add Sentinel Values to FieldValue Union

`|SKIP|` and `|ABORT|` become first-class field values:

```typescript
/** Sentinel values for special field states */
type FieldSkipped = { kind: 'skipped' };
type FieldAborted = { kind: 'aborted' };

/** Extended FieldValue union */
type FieldValue =
  | { kind: 'string'; value: string | null }
  | { kind: 'number'; value: number | null }
  | { kind: 'string_list'; items: string[] }
  | { kind: 'checkboxes'; values: Record<OptionId, CheckboxValue> }
  | { kind: 'single_select'; selected: OptionId | null }
  | { kind: 'multi_select'; selected: OptionId[] }
  | { kind: 'url'; value: string | null }
  | { kind: 'url_list'; items: string[] }
  | FieldSkipped    // NEW
  | FieldAborted;   // NEW
```

### 3. Add Notes as General-Purpose Mechanism

Notes are text linked to any form element, with unique IDs and role tracking:

```typescript
/** Unique note ID (incrementing: n1, n2, n3, ...) */
type NoteId = string;  // pattern: /^n\d+$/

/** Note attached to a field, group, or form */
interface Note {
  id: NoteId;                           // unique note ID (n1, n2, n3, ...)
  ref: Id;                              // target (field, group, or form ID)
  role: string;                         // who created note (e.g., 'agent', 'user')
  state?: 'skipped' | 'aborted';        // links note to skip/abort action
  text: string;                         // markdown content
}

/** Parsed form with notes */
interface ParsedForm {
  schema: FormSchema;
  valuesByFieldId: Record<Id, FieldValue>;  // includes skipped/aborted
  notes: Note[];                            // NEW: replaces skipsByFieldId
  nextNoteId: number;                       // counter for generating note IDs
  docs: DocumentationBlock[];
  orderIndex: Id[];
  idIndex: Map<Id, IdIndexEntry>;
}
```

**Note ID generation:** Each note gets a unique ID like `n1`, `n2`, `n3`. The counter
persists in `nextNoteId` and increments monotonically.
When parsing a form, extract the highest note ID and set `nextNoteId` accordingly.

**Thread safety:** Multiple agents may operate on the same form concurrently.
Note ID generation must be thread-safe to ensure unique, sequential IDs.
Use atomic operations or locking when incrementing `nextNoteId`. The library should be
thread-safe for all mutating operations on `ParsedForm`.

**Note ordering:** Notes are always sorted numerically by ID (n1, n2, n3, ...) which
preserves the order in which they were added.
This is the canonical serialization order.

### 4. Patch Operations

```typescript
type Patch =
  // ... existing value patches ...
  | { op: 'skip_field'; fieldId: Id; role: string; reason?: string }
  | { op: 'abort_field'; fieldId: Id; role: string; reason?: string }
  | { op: 'add_note'; ref: Id; role: string; text: string; state?: 'skipped' | 'aborted' }
  | { op: 'remove_note'; noteId: NoteId }
  | { op: 'remove_notes'; ref: Id; role: string };
```

**Semantics:**

| Operation | Effect | Returns |
| --- | --- | --- |
| `skip_field(id, role)` | Set value to `{ kind: 'skipped' }` | — |
| `skip_field(id, role, reason)` | Set value + add note with `state="skipped"` | note ID |
| `abort_field(id, role)` | Set value to `{ kind: 'aborted' }` | — |
| `abort_field(id, role, reason)` | Set value + add note with `state="aborted"` | note ID |
| `add_note(ref, role, text)` | Add general note (no state) | note ID |
| `add_note(ref, role, text, state)` | Add note with state link | note ID |
| `remove_note(noteId)` | Remove specific note by ID | — |
| `remove_notes(ref, role)` | Remove all notes for ref + role | count removed |

**Auto-cleanup on value set:**

When setting a real value on a field that has a `|SKIP|` or `|ABORT|` sentinel:

- The sentinel is replaced with the new value

- Notes with matching `state` for that field are **automatically removed**

- General notes (no `state`) for that field are **preserved**

This ensures skip/abort reasons are cleaned up when a value is provided, while
preserving any general observations about the field.

### 5. Serialization Formats

There are two serialization contexts with different representations:

1. **Markform format** (markdown with tags): Uses `state` attribute on field tags

2. **Value serialization** (YAML/JSON dump): Uses `|SKIP|` and `|ABORT|` sentinels

#### Markform Format (state attribute)

**Field state attribute:**

All field tags support an optional `state` attribute:

```typescript
type FieldState = 'empty' | 'answered' | 'skipped' | 'aborted';
```

**Terminology:**

- **Filled**: Field has a value fence with content, or checkbox markers changed from
  default

- **Unfilled**: No value fence present, or checkbox markers at default state

- **FieldState**: The semantic state of the field response

**Default state inference:**

- Unfilled field with no `state` attr → `'empty'`

- Filled field with no `state` attr → `'answered'`

**Validation rules:**

- `state="skipped"` or `state="aborted"` is only valid on **unfilled** fields

- If a field is filled AND has `state="skipped"` or `state="aborted"` → **validation
  error**

- `state` attribute is only valid on fields, NOT on field-groups

**Examples:**

```md
{% string-field id="company_name" label="Company name" state="skipped" %}
{% /string-field %}

{% number-field id="revenue_m" label="Revenue (millions)" required=true state="aborted" %}
{% /number-field %}

{% checkboxes id="docs_reviewed" label="Documents reviewed" state="skipped" %}
- [ ] 10-K {% #ten_k %}
- [ ] 10-Q {% #ten_q %}
{% /checkboxes %}
```

For skipped/aborted checkboxes, inline markers remain as schema defaults (ignored during
value interpretation).
The `state` attribute is the source of truth.

**Serialization logic (internal → markform):**

| Internal value | → markform format |
| --- | --- |
| `undefined` | no value fence, no state attr |
| `{ kind: 'skipped' }` | `state="skipped"`, no value fence |
| `{ kind: 'aborted' }` | `state="aborted"`, no value fence |
| real value | value fence with content (state defaults to 'answered') |

#### Parsing: Sentinel Values in Text Value Fences

For fields with `FieldSyntax = 'text'`, sentinel values (`|SKIP|`, `|ABORT|`) in the
value fence are accepted as an alternative syntax:

```md
{% string-field id="company_name" label="Company name" %}
\```value
|SKIP|
\```
{% /string-field %}
```

**Parsing behavior:**

- If value fence contains exactly `|SKIP|` or `|ABORT|` (trimmed), parse as if
  `state="skipped"` or `state="aborted"` were set on the field tag

- The value fence content is NOT stored as a string value

- This provides compatibility with value export format being pasted into markform

**Normalization on serialize:**

When serializing, always use the canonical form (state attribute, no value fence):

```md
{% string-field id="company_name" label="Company name" state="skipped" %}
{% /string-field %}
```

This means: `parse → serialize → parse` normalizes sentinel-in-fence to state-attribute.

**Note:** This only applies to `text` syntax fields.
For `checkboxes` syntax, there is no value fence to contain sentinels—use the `state`
attribute directly.

#### Value Serialization (YAML/JSON dump)

For value-only export (no tags available), use sentinel tokens:

```yaml
company_name: "|SKIP|"
revenue_m: "|ABORT|"
quarterly_growth: 12.5
```

The sentinels `|SKIP|` and `|ABORT|` are string values that represent the
skipped/aborted states in formats that don’t support metadata attributes.

**Notes at end of form (sorted numerically by id, preserving insertion order):**

```md
{% form id="quarterly_earnings" title="Quarterly Earnings Analysis" %}

{% field-group id="company_info" title="Company Info" %}
...
{% /field-group %}

{% note id="n1" ref="company_name" role="agent" state="skipped" %}
Not applicable for this analysis type.
{% /note %}

{% note id="n2" ref="revenue_m" role="agent" state="aborted" %}
Could not contact API provider after 3 retries. Error: Connection timeout.
{% /note %}

{% note id="n3" ref="quarterly_earnings" role="agent" %}
Analysis completed with partial data due to API limitations.
{% /note %}

{% note id="n4" ref="company_name" role="user" %}
Please verify company name spelling before finalizing.
{% /note %}

{% /form %}
```

**Note attributes:**

- `id` (required): Unique note identifier (n1, n2, ...)

- `ref` (required): Target element ID (field, group, or form)

- `role` (required): Who created the note (e.g., ‘agent’, ‘user’)

- `state` (optional): Links note to skip/abort action

### 6. Note vs Doc Block Distinction

| Aspect | `{% doc %}` | `{% note %}` |
| --- | --- | --- |
| Purpose | Schema/template content | Runtime agent/user response |
| When created | Form authoring | Form filling |
| Examples | Instructions, examples | Skip/abort reasons, observations |
| `id` attr | — | Required (n1, n2, ...) |
| `role` attr | — | Required (agent, user, ...) |
| `kind` attr | description, instructions, notes, examples | — |
| `state` attr | — | skipped, aborted, or omitted |
| Deletable | No (part of schema) | Yes (via remove_note) |

### 7. Progress Summary Updates

```typescript
interface FieldProgress {
  kind: FieldKind;
  required: boolean;

  /** Response state (unified) */
  responseState: 'empty' | 'answered' | 'skipped' | 'aborted';

  /** Whether this field has associated notes */
  hasNotes: boolean;

  state: ProgressState;
  valid: boolean;
  issueCount: number;
  checkboxProgress?: CheckboxProgressCounts;
}

interface ProgressCounts {
  totalFields: number;
  requiredFields: number;

  answeredFields: number;    // filled with real values
  skippedFields: number;     // |SKIP| sentinel
  abortedFields: number;     // |ABORT| sentinel
  emptyFields: number;       // no response yet

  totalNotes: number;        // count of all notes

  // ... existing validation counts ...
}
```

### 8. Completion Formula

```
isComplete = (answeredFields + skippedFields == totalFields for target roles)
             AND (abortedFields == 0)
             AND (no issues with severity == 'required')
```

Aborted fields prevent completion—they represent failure states.

### 9. Completion Logic Implementation Changes

**Current implementation (`summaries.ts`):**

The current code has several problems to fix:

1. **`skipsByFieldId` is a separate map** — Skip state is stored separately from values,
   passed as a parameter to `computeProgressSummary()`.

2. **`isFieldSubmitted()` doesn’t handle sentinels** — It only checks for null/empty
   values, not `{ kind: 'skipped' }` or `{ kind: 'aborted' }`.

3. **No `responseState` field** — Current `FieldProgress` has `skipped: boolean` but not
   a unified response state.

4. **No `abortedFields` count** — Current `ProgressCounts` only has `skippedFields`.

**Changes required in `summaries.ts`:**

```typescript
// BEFORE: isFieldSubmitted only checks for content
function isFieldSubmitted(field: Field, value: FieldValue | undefined): boolean {
  if (!value) return false;
  // ... type-specific checks ...
}

// AFTER: Add sentinel detection helper
function getResponseState(
  value: FieldValue | undefined
): 'empty' | 'answered' | 'skipped' | 'aborted' {
  if (!value) return 'empty';
  if (value.kind === 'skipped') return 'skipped';
  if (value.kind === 'aborted') return 'aborted';
  // Check if it's a real value (not just empty)
  return isValueFilled(value) ? 'answered' : 'empty';
}

function isValueFilled(value: FieldValue): boolean {
  switch (value.kind) {
    case 'string':
      return value.value !== null && value.value.trim() !== '';
    case 'number':
      return value.value !== null;
    case 'string_list':
      return value.items.length > 0;
    // ... etc, same logic as current isFieldSubmitted ...
    case 'skipped':
    case 'aborted':
      return false;  // Sentinels are not "filled"
  }
}
```

**Changes required to `ProgressCounts`:**

```typescript
// BEFORE
interface ProgressCounts {
  skippedFields: number;  // From separate skipsByFieldId map
  // no abortedFields
}

// AFTER
interface ProgressCounts {
  answeredFields: number;    // Fields with real values (filled)
  skippedFields: number;     // Fields with { kind: 'skipped' }
  abortedFields: number;     // Fields with { kind: 'aborted' }  NEW
  emptyFields: number;       // Fields with no value yet
  totalNotes: number;        // Count of all notes  NEW
  // ... rest unchanged ...
}
```

**Changes to `computeProgressSummary()`:**

```typescript
// BEFORE: Takes skipsByFieldId as separate parameter
export function computeProgressSummary(
  schema: FormSchema,
  values: Record<Id, FieldValue>,
  issues: InspectIssue[],
  skips: Record<Id, SkipInfo> = {}  // REMOVE THIS
): ProgressSummary

// AFTER: Skips are in values, notes passed for counting
export function computeProgressSummary(
  schema: FormSchema,
  values: Record<Id, FieldValue>,  // Now includes skipped/aborted sentinels
  issues: InspectIssue[],
  notes: Note[] = []  // For totalNotes count and hasNotes per field
): ProgressSummary
```

**Changes to `isFormComplete()`:**

```typescript
// BEFORE: Uses separate skipped count
export function isFormComplete(progress: ProgressSummary): boolean {
  const { counts } = progress;
  const baseComplete = counts.invalidFields === 0 && ...;
  const allFieldsAccountedFor =
    (counts.answeredFields + counts.skippedFields) === counts.totalFields;
  return baseComplete && allFieldsAccountedFor;
}

// AFTER: Add aborted check
export function isFormComplete(progress: ProgressSummary): boolean {
  const { counts } = progress;

  // Aborted fields block completion (they're failures)
  if (counts.abortedFields > 0) {
    return false;
  }

  const baseComplete = counts.invalidFields === 0 && ...;
  const allFieldsAccountedFor =
    (counts.answeredFields + counts.skippedFields) === counts.totalFields;
  return baseComplete && allFieldsAccountedFor;
}
```

**Changes to `computeFormState()`:**

```typescript
// AFTER: Aborted = invalid state
export function computeFormState(progress: ProgressSummary): ProgressState {
  // Aborted fields make the form invalid
  if (progress.counts.abortedFields > 0) {
    return 'invalid';
  }

  // ... rest of existing logic ...
}
```

**Files to modify:**

| File | Changes |
| --- | --- |
| `coreTypes.ts` | Add `FieldSkipped`, `FieldAborted` to `FieldValue` union; add `FieldState` type; add `responseState` to `FieldProgress`; add `abortedFields`, `totalNotes` to `ProgressCounts`; remove `SkipInfo` and `skipsByFieldId` |
| `summaries.ts` | Add `getResponseState()` helper; update `computeProgressSummary()` signature; update all count logic; update `isFormComplete()` and `computeFormState()` |
| `apply.ts` | Remove `skipsByFieldId` handling; use sentinel values instead |
| `parse.ts` | Remove `skipsByFieldId` from `ParsedForm`; parse `state` attribute on field tags; validate state vs filled consistency |
| `serialize.ts` | Emit `state` attribute on field tags for skipped/aborted; use sentinels for value-only export |
| `inspect.ts` | Update to use new completion logic |
| `fieldRegistry.ts` | Add `FieldSkippedValueSchema` and `FieldAbortedValueSchema`; update derived `FieldValue` union to include sentinels |

**Key semantic changes:**

1. **Skipped fields ARE values** — `{ kind: 'skipped' }` is stored in `valuesByFieldId`,
   not in a separate map.

2. **Aborted fields ARE values** — `{ kind: 'aborted' }` is also a value, not metadata.

3. **Completion requires no aborts** — Unlike skipped (which counts as “addressed”),
   aborted is a failure state that blocks completion.

4. **Notes are counted** — `totalNotes` and per-field `hasNotes` track agent comments.

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN — this is a breaking
  refactor of the value model.
  `skipsByFieldId` is removed; replaced by unified `valuesByFieldId` with sentinel
  kinds.

- **Library APIs**: DO NOT MAINTAIN — `skip_field` patch now sets a sentinel value, not
  metadata. New `abort_field` and `add_note` patches added.

- **Server APIs**: N/A

- **File formats**: SUPPORT BOTH — Old forms without sentinels/notes work unchanged.
  New forms with `|SKIP|`/`|ABORT|` and `{% note %}` tags parse correctly.
  Old forms without these features continue to work.

- **Database schemas**: N/A

**Migration Notes:**

- Existing forms without skip/abort/notes work unchanged (empty fields are just empty)

- Forms with the old `skipsByFieldId` runtime state will need re-filling (skip state was
  never persisted anyway)

- No automated migration needed—this is a forward-only enhancement

## Stage 1: Planning Stage

### Current State Analysis

**Existing Components:**

| Component | Location | Change Needed |
| --- | --- | --- |
| `FieldValue` union | `coreTypes.ts` | Add `FieldSkipped`, `FieldAborted` kinds |
| `Patch` union | `coreTypes.ts` | Add `abort_field`, `add_note` |
| `ParsedForm` | `coreTypes.ts` | Remove `skipsByFieldId`, add `notes: Note[]` |
| `FieldProgress` | `coreTypes.ts` | Add `responseState`, `hasNotes` |
| `ProgressCounts` | `coreTypes.ts` | Add `abortedFields`, `emptyFields`, `totalNotes` |
| Error types | `coreTypes.ts` | Add `ParseError`, `ValidationError`, `MarkformError` types |
| `parseForm()` | `parse.ts` | Parse `state` attribute on fields, parse `{% note %}` tags |
| `serialize()` | `serialize.ts` | Emit `state` attribute for skipped/aborted, emit notes at end |
| `applyPatches()` | `apply.ts` | Handle `abort_field`, `add_note` |
| `computeProgressSummary()` | `summaries.ts` | Compute new counts |
| `inspect()` | `inspect.ts` | Update completion logic |
| Architecture doc | `arch-markform-initial-design.md` | Add error taxonomy section |

### Feature Scope

**In Scope:**

- `FieldSkipped` and `FieldAborted` sentinel kinds in `FieldValue` union

- `FieldState` type (`'empty' | 'answered' | 'skipped' | 'aborted'`)

- `state` attribute on field tags in markform format

- `|SKIP|` and `|ABORT|` sentinels for value-only serialization (YAML/JSON dump)

- `Note` type and `notes: Note[]` in `ParsedForm`

- `{% note %}` tag parsing and serialization

- `abort_field` and `add_note` patch operations

- `skip_field` updated to set sentinel (not metadata)

- `responseState` and `hasNotes` in `FieldProgress`

- `abortedFields`, `emptyFields`, `totalNotes` in `ProgressCounts`

- Updated completion formula (aborted fields block completion)

- Remove `skipsByFieldId` from `ParsedForm`

- Golden tests for all new features

- CLI inspect showing notes and response states

- `remove_note` and `remove_notes` patch operations

- Thread-safe note ID generation for concurrent agents

- Dump/export includes notes in all formats (JSON, YAML, etc.)

- Formalize `ParseError` and `ValidationError` types in `coreTypes.ts`

- Update architecture doc with error taxonomy

**Out of Scope (Explicit Non-Goals):**

- UI changes in web serve mode (follow-up)

- Agent prompt changes to teach abort/note behavior (separate feature)

- Note editing (can add and remove, but not modify)

- Multi-line notes with complex markdown (keep simple for v1)

### Acceptance Criteria

**Markform format parsing:**

1. `state="skipped"` on unfilled field parses to `{ kind: 'skipped' }`

2. `state="aborted"` on unfilled field parses to `{ kind: 'aborted' }`

3. `state="skipped"` or `state="aborted"` on filled field → validation error

4. `state` attribute on field-group → validation error (only valid on fields)

5. `{% note %}` tags parse correctly with `id`, `ref`, `role`, and optional `state`

**Patch operations:**

6. `skip_field` patch sets `{ kind: 'skipped' }` value

7. `skip_field` with reason sets value AND adds note with `state="skipped"`

8. `abort_field` patch sets `{ kind: 'aborted' }` value

9. `abort_field` with reason sets value AND adds note with `state="aborted"`

10. `add_note` patch adds note to `notes` array and returns note ID

11. `add_note` with invalid ref is rejected with error

12. `remove_note` removes specific note by ID

13. `remove_notes(ref, role)` removes all notes for that ref + role

**Serialization:**

14. Markform serialization emits `state="skipped"` or `state="aborted"` on field tags

15. Value-only serialization (YAML/JSON) uses `|SKIP|` and `|ABORT|` sentinels

**Sentinel in value fence (text syntax fields):**

16. `|SKIP|` in text value fence parses as `{ kind: 'skipped' }`

17. `|ABORT|` in text value fence parses as `{ kind: 'aborted' }`

18. Sentinel with conflicting state attr produces validation error

19. Sentinel normalizes to state attr on serialize (canonical form)

**Notes serialization:**

20. Serialization emits notes at end of form, sorted numerically by ID

21. Notes include `id`, `ref`, `role`, and optional `state` attributes

**Progress and completion:**

22. `responseState` correctly computed for each field

23. `abortedFields` count correctly computed

24. Form with aborted fields has `form_state: 'invalid'`

25. Form completion requires `abortedFields == 0`

**Auto-cleanup:**

26. Setting value on skipped field auto-removes `state="skipped"` notes

27. Setting value on aborted field auto-removes `state="aborted"` notes

28. General notes (no state) are preserved when setting values

**Thread safety and export:**

29. Note ID generation is thread-safe for concurrent agents

30. Dump/export includes notes in JSON and YAML formats

**Testing:**

31. Golden tests verify state attribute and note round-tripping (markform format)

32. Golden tests verify sentinel round-tripping (YAML/JSON value export)

33. CLI inspect shows notes and response states

**Internal changes:**

34. `skipsByFieldId` removed from `ParsedForm` (values in `valuesByFieldId` instead)

35. `computeProgressSummary()` no longer takes `skips` parameter

36. `getResponseState()` helper correctly classifies empty/answered/skipped/aborted

37. `isFormComplete()` returns false when `abortedFields > 0`

38. All round-trip tests pass for markdown, YAML, and JSON with notes

### Testing Plan

#### 1. Unit Tests: Sentinel Parsing (`tests/unit/engine/parse.test.ts`)

- [ ] Parse `state="skipped"` on unfilled string field

- [ ] Parse `state="aborted"` on unfilled string field

- [ ] Parse `state="skipped"` on unfilled number field

- [ ] Parse `state="aborted"` on unfilled number field

- [ ] Parse `state="skipped"` on unfilled checkboxes (inline markers ignored)

- [ ] Parse `state="aborted"` on unfilled single-select

- [ ] `state="skipped"` on filled field produces validation error

- [ ] `state="aborted"` on filled field produces validation error

- [ ] `state` attribute on field-group produces validation error

- [ ] Regular values still parse correctly (state defaults to ‘answered’)

- [ ] Unfilled field with no state attr defaults to ‘empty’

**Sentinel in value fence (text syntax fields):**

- [ ] Parse `|SKIP|` in string field value fence → `{ kind: 'skipped' }`

- [ ] Parse `|ABORT|` in string field value fence → `{ kind: 'aborted' }`

- [ ] Parse `|SKIP|` in number field value fence → `{ kind: 'skipped' }`

- [ ] Parse `|ABORT|` in url field value fence → `{ kind: 'aborted' }`

- [ ] Sentinel with matching state attr is valid (no conflict)

- [ ] Sentinel with conflicting state attr produces validation error

- [ ] Sentinel normalizes to state attr on round-trip (parse → serialize → parse)

- [ ] Sentinel not applicable to checkboxes (no value fence for checkbox syntax)

#### 2. Unit Tests: Note Parsing (`tests/unit/engine/parse.test.ts`)

- [ ] Parse `{% note id="n1" ref="field_id" role="agent" %}` with content

- [ ] Parse note with `state="skipped"`

- [ ] Parse note with `state="aborted"`

- [ ] Parse multiple notes at end of form

- [ ] Invalid ref in note produces validation error

- [ ] Missing id attribute produces validation error

- [ ] Missing role attribute produces validation error

- [ ] Note with empty content is valid

- [ ] Notes sorted by id in parsed output

- [ ] `nextNoteId` set to max(note ids) + 1 after parsing

#### 3. Unit Tests: Markform Serialization (`tests/unit/engine/serialize.test.ts`)

**State attribute on field tags:**

- [ ] Serialize `{ kind: 'skipped' }` as `state="skipped"` on field tag (no value fence)

- [ ] Serialize `{ kind: 'aborted' }` as `state="aborted"` on field tag (no value fence)

- [ ] Serialize skipped checkboxes: `state="skipped"`, markers at defaults

- [ ] Serialize aborted single-select: `state="aborted"`, no value fence

- [ ] Filled field has no state attr (defaults to ‘answered’)

- [ ] Empty field has no state attr (defaults to ‘empty’)

- [ ] Round-trip: parse → serialize → parse produces identical result

**Value-only serialization (YAML/JSON dump):**

- [ ] Serialize `{ kind: 'skipped' }` as `|SKIP|` string in YAML

- [ ] Serialize `{ kind: 'aborted' }` as `|ABORT|` string in YAML

- [ ] Parse `|SKIP|` string in YAML back to `{ kind: 'skipped' }`

- [ ] Parse `|ABORT|` string in YAML back to `{ kind: 'aborted' }`

- [ ] Round-trip: dump → load → dump produces identical values

#### 4. Unit Tests: Note Serialization (`tests/unit/engine/serialize.test.ts`)

**Basic serialization:**

- [ ] Serialize notes at end of form (before `{% /form %}`)

- [ ] Notes sorted numerically by id (n1, n2, n10, not n1, n10, n2)

- [ ] Note with all attributes (id, ref, role, state) serialized correctly

- [ ] General notes (no state) serialized correctly

- [ ] Note text with markdown content preserved

**Markdown round-trip:**

- [ ] Round-trip: parse → serialize → parse for notes

- [ ] `nextNoteId` correctly computed after parse (max note id + 1)

- [ ] Notes with gaps in IDs (n1, n3, n5) round-trip correctly

- [ ] Removed notes don’t reappear on round-trip

**YAML export:**

- [ ] `dumpValues` includes notes array

- [ ] Note YAML includes id, ref, role, state, text fields

- [ ] Notes with undefined state omit state field in YAML

- [ ] YAML round-trip: export → import → export produces identical notes

**JSON export:**

- [ ] JSON export includes notes array

- [ ] Note JSON structure matches YAML structure

- [ ] JSON round-trip: export → import → export produces identical notes

#### 5. Unit Tests: Patch Operations (`tests/unit/engine/apply.test.ts`)

**skip_field:**

- [ ] `skip_field` on optional field sets `{ kind: 'skipped' }`

- [ ] `skip_field` on required field returns error

- [ ] `skip_field` with reason adds note with `state="skipped"`

- [ ] `skip_field` without reason does not add note

- [ ] `skip_field` clears any existing value

**abort_field:**

- [ ] `abort_field` on any field sets `{ kind: 'aborted' }`

- [ ] `abort_field` with reason adds note with `state="aborted"`

- [ ] `abort_field` without reason does not add note

- [ ] `abort_field` clears any existing value

**add_note:**

- [ ] `add_note` with valid field ref adds note and returns noteId

- [ ] `add_note` with valid group ref adds note

- [ ] `add_note` with valid form ref adds note

- [ ] `add_note` with invalid ref returns error

- [ ] `add_note` with state adds note with state

- [ ] Multiple notes can reference same ref

- [ ] Note IDs increment correctly (n1, n2, n3, ...)

- [ ] Role is stored on note

**remove_note:**

- [ ] `remove_note` with valid noteId removes note

- [ ] `remove_note` with invalid noteId returns error

- [ ] Removing note does not affect other notes

**remove_notes:**

- [ ] `remove_notes(ref, role)` removes all matching notes

- [ ] `remove_notes` with invalid ref returns error

- [ ] Returns count of removed notes

- [ ] Notes from other roles are preserved

**Value clears sentinel and state-linked notes:**

- [ ] Setting value on skipped field: value replaces sentinel

- [ ] Setting value on skipped field: notes with `state="skipped"` are removed

- [ ] Setting value on skipped field: notes without state are preserved

- [ ] Setting value on aborted field: value replaces sentinel

- [ ] Setting value on aborted field: notes with `state="aborted"` are removed

- [ ] Setting value on aborted field: notes without state are preserved

**Sequence test:**

- [ ] Complex sequence: add_note → skip_field → add_note → set_value → remove_note

  - Verifies note IDs remain unique

  - Verifies auto-cleanup on set_value

  - Verifies remove_note works correctly

#### 6. Unit Tests: Progress Computation (`tests/unit/engine/summaries.test.ts`)

**responseState:**

- [ ] Field with no entry: `responseState = 'empty'`

- [ ] Field with value: `responseState = 'answered'`

- [ ] Field with `{ kind: 'skipped' }`: `responseState = 'skipped'`

- [ ] Field with `{ kind: 'aborted' }`: `responseState = 'aborted'`

**hasNotes:**

- [ ] Field with no notes: `hasNotes = false`

- [ ] Field with notes: `hasNotes = true`

**Counts:**

- [ ] `answeredFields` counts filled fields only

- [ ] `skippedFields` counts skipped fields

- [ ] `abortedFields` counts aborted fields

- [ ] `emptyFields` counts empty fields

- [ ] `totalNotes` counts all notes

- [ ] `answeredFields + skippedFields + abortedFields + emptyFields == totalFields`

#### 7. Unit Tests: Completion Logic (`tests/unit/engine/summaries.test.ts` and `inspect.test.ts`)

**`getResponseState()` helper:**

- [ ] Value is undefined → `responseState = 'empty'`

- [ ] Value is `{ kind: 'skipped' }` → `responseState = 'skipped'`

- [ ] Value is `{ kind: 'aborted' }` → `responseState = 'aborted'`

- [ ] Value is `{ kind: 'string', value: 'hello' }` → `responseState = 'answered'`

- [ ] Value is `{ kind: 'string', value: null }` → `responseState = 'empty'`

- [ ] Value is `{ kind: 'string', value: '' }` → `responseState = 'empty'`

**`computeProgressSummary()` counts:**

- [ ] All empty: `emptyFields == totalFields`, others zero

- [ ] Mix of filled/skipped/aborted: each count correct

- [ ] Sentinel values are NOT counted as submitted/answered

- [ ] Notes parameter used to compute `totalNotes` and per-field `hasNotes`

**`isFormComplete()` logic:**

- [ ] Form with all fields answered: complete

- [ ] Form with answered + skipped (all addressed): complete

- [ ] Form with empty required: not complete

- [ ] Form with aborted field: NOT complete (even if all others answered)

- [ ] Form with multiple aborted fields: NOT complete

- [ ] Skipped optional + answered required: complete

**`computeFormState()` logic:**

- [ ] Form with aborted field: `form_state = 'invalid'`

- [ ] Form with invalid fields (no abort): `form_state = 'invalid'`

- [ ] Form with only empty fields: `form_state = 'empty'`

- [ ] Form with some filled, some empty: `form_state = 'incomplete'`

- [ ] Form with all addressed (filled + skipped): `form_state = 'complete'`

**Role-filtered completion:**

- [ ] Role-filtered completion only counts target-role fields

- [ ] Non-target-role aborted fields don’t block completion

- [ ] Non-target-role empty required fields don’t block completion

#### 8. Golden Tests (`tests/golden/`)

**Session tests:**

- [ ] Session with `skip_field` patches

- [ ] Session with `abort_field` patches

- [ ] Session with `add_note` patches

- [ ] Session with `remove_note` patches

- [ ] Session with note add/remove sequence:

  - add_note → add_note → remove_note → add_note

  - Verifies IDs remain unique (n1, n2, n4 after removing n2 doesn’t reuse n2)

  - Verifies note count is correct after each operation

- [ ] Session with skip_field then set_value:

  - skip_field with reason → add general note → set_value

  - Verifies state-linked note is removed but general note preserved

**Markdown round-trip tests:**

- [ ] Form with sentinels round-trips correctly (parse → serialize → parse)

- [ ] Form with notes round-trips correctly (parse → serialize → parse)

- [ ] Form with mixed notes (different roles, states) round-trips correctly

- [ ] Note IDs preserved across round-trip

- [ ] Note ordering (by ID) preserved across round-trip

- [ ] `nextNoteId` correctly computed on parse

**YAML/JSON round-trip tests:**

- [ ] Dump form with notes to YAML → parse YAML → verify notes match

- [ ] Dump form with notes to JSON → parse JSON → verify notes match

- [ ] Export includes notes array with all attributes (id, ref, role, state, text)

- [ ] Import YAML with notes → serialize to markdown → notes preserved

#### 9. Integration Tests

- [ ] CLI `markform dump` includes notes in output

- [ ] CLI `markform export --format=json` includes notes

- [ ] CLI `markform export --format=yaml` includes notes

- [ ] CLI `markform inspect` shows notes summary and per-field note counts

## Stage 2: Architecture Stage

### Type Changes Summary

```typescript
// --- New Types ---

/**
 * How field values are represented in markform syntax.
 * Determines how "filled" is detected during parsing.
 */
type FieldSyntax = 'text' | 'checkboxes';

/**
 * Semantic state of a field response.
 */
type FieldState = 'empty' | 'answered' | 'skipped' | 'aborted';

type NoteId = string;  // pattern: /^n\d+$/ (e.g., n1, n2, n3)

interface FieldSkipped {
  kind: 'skipped';
}

interface FieldAborted {
  kind: 'aborted';
}

interface Note {
  id: NoteId;                           // unique note ID
  ref: Id;                              // target element ID
  role: string;                         // who created (agent, user, ...)
  state?: 'skipped' | 'aborted';        // optional link to action
  text: string;                         // note content
}

interface SkipFieldPatch {
  op: 'skip_field';
  fieldId: Id;
  role: string;
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

// --- Updated Types ---

type FieldValue =
  | { kind: 'string'; value: string | null }
  | { kind: 'number'; value: number | null }
  | { kind: 'string_list'; items: string[] }
  | { kind: 'checkboxes'; values: Record<OptionId, CheckboxValue> }
  | { kind: 'single_select'; selected: OptionId | null }
  | { kind: 'multi_select'; selected: OptionId[] }
  | { kind: 'url'; value: string | null }
  | { kind: 'url_list'; items: string[] }
  | FieldSkipped
  | FieldAborted;

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
  | SkipFieldPatch     // updated: now has role
  | AbortFieldPatch    // NEW
  | AddNotePatch       // NEW
  | RemoveNotePatch    // NEW
  | RemoveNotesPatch;  // NEW

interface ParsedForm {
  schema: FormSchema;
  valuesByFieldId: Record<Id, FieldValue>;
  notes: Note[];           // NEW (replaces skipsByFieldId)
  nextNoteId: number;      // NEW: counter for generating note IDs
  docs: DocumentationBlock[];
  orderIndex: Id[];
  idIndex: Map<Id, IdIndexEntry>;
}

interface FieldProgress {
  kind: FieldKind;
  required: boolean;
  submitted: boolean;  // deprecated, use responseState
  responseState: 'empty' | 'answered' | 'skipped' | 'aborted';  // NEW
  hasNotes: boolean;   // NEW
  noteCount: number;   // NEW: count of notes for this field
  state: ProgressState;
  valid: boolean;
  issueCount: number;
  checkboxProgress?: CheckboxProgressCounts;
  // skipped, skipReason REMOVED (now in responseState + notes)
}

interface ProgressCounts {
  totalFields: number;
  requiredFields: number;
  submittedFields: number;       // deprecated, same as answeredFields
  answeredFields: number;
  skippedFields: number;
  abortedFields: number;         // NEW
  emptyFields: number;           // NEW
  totalNotes: number;            // NEW
  completeFields: number;
  incompleteFields: number;
  invalidFields: number;
  emptyRequiredFields: number;
  emptyOptionalFields: number;
}
```

### Parsing Logic

```typescript
// In parse.ts

type FieldState = 'empty' | 'answered' | 'skipped' | 'aborted';
type FieldSyntax = 'text' | 'checkboxes';

const SENTINEL_SKIP = '|SKIP|';
const SENTINEL_ABORT = '|ABORT|';

function getFieldSyntax(fieldKind: FieldKind): FieldSyntax {
  return fieldKind === 'checkboxes' ? 'checkboxes' : 'text';
}

function parseFieldTag(node: Tag, fieldKind: FieldKind): { value: FieldValue | undefined; state: FieldState } {
  const stateAttr = node.attributes.state as FieldState | undefined;
  const valueFence = extractValueFence(node);
  const valueFenceContent = valueFence?.trim() ?? '';
  const fieldSyntax = getFieldSyntax(fieldKind);

  // Check for sentinel values in text value fences (alternative syntax)
  if (fieldSyntax === 'text' && valueFenceContent) {
    if (valueFenceContent === SENTINEL_SKIP) {
      if (stateAttr && stateAttr !== 'skipped') {
        throw new ValidationError(`Field ${node.attributes.id}: conflicting state="${stateAttr}" with |SKIP| sentinel`);
      }
      return { value: { kind: 'skipped' }, state: 'skipped' };
    }
    if (valueFenceContent === SENTINEL_ABORT) {
      if (stateAttr && stateAttr !== 'aborted') {
        throw new ValidationError(`Field ${node.attributes.id}: conflicting state="${stateAttr}" with |ABORT| sentinel`);
      }
      return { value: { kind: 'aborted' }, state: 'aborted' };
    }
  }

  const isFilled = fieldSyntax === 'text' 
    ? valueFenceContent !== '' 
    : hasChangedCheckboxMarkers(node);

  // Validate state attribute
  if (stateAttr === 'skipped' || stateAttr === 'aborted') {
    if (isFilled) {
      throw new ValidationError(`Field ${node.attributes.id}: state="${stateAttr}" not allowed on filled field`);
    }
    return { 
      value: { kind: stateAttr }, 
      state: stateAttr 
    };
  }

  // Default state inference
  if (isFilled) {
    const value = parseValueFence(valueFence, fieldKind);
    return { value, state: 'answered' };
  }

  return { value: undefined, state: 'empty' };
}

function validateFieldGroupTag(node: Tag): void {
  if (node.attributes.state) {
    throw new ValidationError(`Field-group ${node.attributes.id}: state attribute not allowed on field-groups`);
  }
}

function parseNoteTag(node: Tag): Note {
  const id = node.attributes.id as NoteId;
  const ref = node.attributes.ref as string;
  const role = node.attributes.role as string;
  const state = node.attributes.state as 'skipped' | 'aborted' | undefined;
  const text = extractContent(node);

  if (!id) {
    throw new ValidationError(`Note missing required id attribute`);
  }
  if (!role) {
    throw new ValidationError(`Note missing required role attribute`);
  }
  if (!idIndex.has(ref)) {
    throw new ValidationError(`Note references unknown ID: ${ref}`);
  }

  return { id, ref, role, state, text };
}

// After parsing all notes, set nextNoteId to max + 1
function computeNextNoteId(notes: Note[]): number {
  if (notes.length === 0) return 1;
  const maxId = Math.max(...notes.map(n => parseInt(n.id.slice(1), 10)));
  return maxId + 1;
}
```

### Serialization Logic

```typescript
// In serialize.ts

/**
 * Serialize field tag with optional state attribute.
 * State is only emitted for skipped/aborted (unfilled fields).
 */
function serializeFieldTag(field: Field, value: FieldValue | undefined): string {
  const attrs = buildBaseFieldAttrs(field);

  if (value?.kind === 'skipped') {
    attrs.state = 'skipped';
    return `{% ${field.kind}-field ${formatAttrs(attrs)} %}\n{% /${field.kind}-field %}`;
  }
  if (value?.kind === 'aborted') {
    attrs.state = 'aborted';
    return `{% ${field.kind}-field ${formatAttrs(attrs)} %}\n{% /${field.kind}-field %}`;
  }

  // For filled or empty fields, no state attr (defaults inferred)
  const valueFence = value ? serializeValue(value, field.kind) : '';
  return `{% ${field.kind}-field ${formatAttrs(attrs)} %}\n${valueFence}{% /${field.kind}-field %}`;
}

/**
 * For YAML/JSON value-only export, use sentinel strings.
 */
const SENTINEL_SKIP = '|SKIP|';
const SENTINEL_ABORT = '|ABORT|';

function serializeValueForExport(value: FieldValue): unknown {
  if (value.kind === 'skipped') return SENTINEL_SKIP;
  if (value.kind === 'aborted') return SENTINEL_ABORT;
  // Normal value serialization for export...
  return serializeValueContent(value);
}

function parseValueFromImport(raw: unknown, fieldKind: FieldKind): FieldValue {
  if (raw === SENTINEL_SKIP) return { kind: 'skipped' };
  if (raw === SENTINEL_ABORT) return { kind: 'aborted' };
  // Parse normal value...
  return parseImportedValue(raw, fieldKind);
}

function serializeNotes(notes: Note[]): string {
  // Sort numerically by id (n1, n2, n3...) to preserve insertion order
  const sorted = [...notes].sort((a, b) => {
    const aNum = parseInt(a.id.slice(1), 10);
    const bNum = parseInt(b.id.slice(1), 10);
    return aNum - bNum;
  });

  return sorted.map(note => {
    const stateAttr = note.state ? ` state="${note.state}"` : '';
    return `{% note id="${note.id}" ref="${note.ref}" role="${note.role}"${stateAttr} %}\n${note.text}\n{% /note %}`;
  }).join('\n\n');
}
```

### Apply Logic

```typescript
// In apply.ts

/**
 * Thread-safe note ID generation.
 * Uses a mutex/lock to ensure unique sequential IDs when multiple agents
 * operate on the same form concurrently.
 */
function generateNoteId(form: ParsedForm): NoteId {
  // In Node.js, use a mutex or atomic operation
  // In browser, use a lock or synchronized access
  return form.withLock(() => {
    const id = `n${form.nextNoteId}`;
    form.nextNoteId++;
    return id;
  });
}

// Alternative: use atomic increment if available
function generateNoteIdAtomic(form: ParsedForm): NoteId {
  const nextId = Atomics.add(form.nextNoteIdBuffer, 0, 1);
  return `n${nextId}`;
}

function applySkipField(form: ParsedForm, patch: SkipFieldPatch): ApplyResult {
  const field = findFieldById(form, patch.fieldId);
  if (!field) {
    return errorResult(`Field not found: ${patch.fieldId}`);
  }

  if (field.required) {
    return errorResult(`Cannot skip required field: ${field.label}`);
  }

  // Set sentinel value
  form.valuesByFieldId[patch.fieldId] = { kind: 'skipped' };

  // Add note if reason provided
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

function applyAbortField(form: ParsedForm, patch: AbortFieldPatch): ApplyResult {
  const field = findFieldById(form, patch.fieldId);
  if (!field) {
    return errorResult(`Field not found: ${patch.fieldId}`);
  }

  // Set sentinel value (no required check - abort works on any field)
  form.valuesByFieldId[patch.fieldId] = { kind: 'aborted' };

  // Add note if reason provided
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

function applyAddNote(form: ParsedForm, patch: AddNotePatch): ApplyResult {
  // Validate ref exists
  if (!form.idIndex.has(patch.ref)) {
    return errorResult(`Note references unknown ID: ${patch.ref}`);
  }

  const noteId = generateNoteId(form);
  form.notes.push({
    id: noteId,
    ref: patch.ref,
    role: patch.role,
    state: patch.state,
    text: patch.text,
  });

  return successResult(form, { noteId });
}

function applyRemoveNote(form: ParsedForm, patch: RemoveNotePatch): ApplyResult {
  const index = form.notes.findIndex(n => n.id === patch.noteId);
  if (index === -1) {
    return errorResult(`Note not found: ${patch.noteId}`);
  }

  form.notes.splice(index, 1);
  return successResult(form);
}

function applyRemoveNotes(form: ParsedForm, patch: RemoveNotesPatch): ApplyResult {
  // Validate ref exists
  if (!form.idIndex.has(patch.ref)) {
    return errorResult(`Note references unknown ID: ${patch.ref}`);
  }

  const before = form.notes.length;
  form.notes = form.notes.filter(
    n => !(n.ref === patch.ref && n.role === patch.role)
  );
  const removed = before - form.notes.length;

  return successResult(form, { removedCount: removed });
}

// Auto-cleanup: when setting a value on a field with sentinel, remove state-linked notes
function applySetValue(form: ParsedForm, patch: SetValuePatch): ApplyResult {
  const existingValue = form.valuesByFieldId[patch.fieldId];

  // Check if replacing a sentinel
  if (existingValue?.kind === 'skipped' || existingValue?.kind === 'aborted') {
    const stateToRemove = existingValue.kind;
    // Remove notes with matching state for this field (preserve general notes)
    form.notes = form.notes.filter(
      n => !(n.ref === patch.fieldId && n.state === stateToRemove)
    );
  }

  // Set the new value
  form.valuesByFieldId[patch.fieldId] = patch.value;

  return successResult(form);
}
```

### Completion Logic

```typescript
// In inspect.ts

export function inspect(form: ParsedForm, options: InspectOptions = {}): InspectResult {
  // ... existing logic ...

  const targetRoleFields = getFieldsForRoles(form, options.targetRoles ?? ['*']);
  const targetFieldIds = new Set(targetRoleFields.map(f => f.id));

  let targetAnswered = 0;
  let targetSkipped = 0;
  let targetAborted = 0;

  for (const [fieldId, fp] of Object.entries(progressSummary.fields)) {
    if (targetFieldIds.has(fieldId)) {
      if (fp.responseState === 'answered') targetAnswered++;
      if (fp.responseState === 'skipped') targetSkipped++;
      if (fp.responseState === 'aborted') targetAborted++;
    }
  }

  const allFieldsAccountedFor = (targetAnswered + targetSkipped) === targetRoleFields.length;
  const noAbortedFields = targetAborted === 0;
  const noRequiredIssues = !filteredIssues.some(i => i.severity === 'required');

  // Aborted fields block completion
  const isComplete = allFieldsAccountedFor && noAbortedFields && noRequiredIssues;

  // Form state computation
  let formState: ProgressState;
  if (targetAborted > 0) {
    formState = 'invalid';  // Aborted = failure
  } else if (progressSummary.counts.invalidFields > 0) {
    formState = 'invalid';
  } else if (!allFieldsAccountedFor) {
    formState = 'incomplete';
  } else {
    formState = 'complete';
  }

  return {
    // ...
    isComplete,
    formState,
  };
}
```

## Stage 3: Refine Architecture

### Reusable Components

| Component | File | Reuse Strategy |
| --- | --- | --- |
| `findFieldById()` | `valueCoercion.ts` | Use for field lookup in apply |
| `applyPatches()` | `apply.ts` | Extend with abort_field, add_note cases |
| `PatchSchema` | `coreTypes.ts` | Extend discriminated union |
| `idIndex` on ParsedForm | `parse.ts` | Use for note ref validation |

### Key Design Decisions

1. **Sentinels are simple tokens** — `|SKIP|` and `|ABORT|` have no embedded data.
   Reasons go in notes.

2. **Notes are general-purpose** — Can be used for skip/abort reasons OR general agent
   observations.

3. **Notes have unique IDs** — Sequential IDs like n1, n2, n3 for easy reference and
   deletion.

4. **Notes track role** — Required `role` attribute tracks who created the note (agent,
   user, etc.).

5. **Notes at end of form** — Keep form body clean; notes are runtime additions.
   Sorted numerically by ID to preserve insertion order.

6. **State attribute on notes** — Links note to skip/abort action for semantic grouping.

7. **Aborted blocks completion** — Unlike skipped, aborted is a failure state.

8. **Notes can be deleted** — Via `remove_note(id)` or `remove_notes(ref, role)`.

9. **Value clears sentinel and state-linked notes** — Setting a real value replaces
   skip/abort state and removes notes with matching `state`, but preserves general
   notes.

10. **Thread-safe note ID generation** — Use mutex/atomic operations for concurrent
    agents operating on the same form.

11. **Notes in all output formats** — Dump/export includes notes in JSON, YAML, etc.

12. **Type-safe field registry** — Use `fieldRegistry.ts` to ensure all field kinds are
    consistently handled across the codebase.
    Adding `skipped` and `aborted` as FieldValue kinds will require updating switch
    statements with exhaustiveness checks.

### Migration Path

**Phase 1: Types**

- Add `FieldSkipped`, `FieldAborted` to `FieldValue` union

- Add `Note` type

- Add `AbortFieldPatch`, `AddNotePatch`

- Remove `SkipInfo` and `skipsByFieldId`

- Update `FieldProgress` and `ProgressCounts`

**Phase 2: Parsing**

- Parse `|SKIP|` and `|ABORT|` in value fences

- Parse `{% note %}` tags

- Validate note refs

**Phase 3: Serialization**

- Emit sentinels in value fences

- Emit notes at end of form

**Phase 4: Apply**

- Update `skip_field` to set sentinel + optional note

- Add `abort_field` handler

- Add `add_note` handler

**Phase 5: Progress & Completion**

- Compute `responseState` per field

- Compute new counts

- Update completion formula

**Phase 6: Tests & Documentation**

- Golden tests for sentinels and notes

- CLI output updates

- Architecture doc updates

## Architecture Documentation Changes

The following changes need to be made to
`docs/project/architecture/current/arch-markform-initial-design.md`:

### 1. FieldValue Union (around line ~830)

Add sentinel kinds:

```ts
type FieldValue =
  | { kind: 'string'; value: string | null }
  | { kind: 'number'; value: number | null }
  | { kind: 'string_list'; items: string[] }
  | { kind: 'checkboxes'; values: Record<OptionId, CheckboxValue> }
  | { kind: 'single_select'; selected: OptionId | null }
  | { kind: 'multi_select'; selected: OptionId[] }
  | { kind: 'url'; value: string | null }
  | { kind: 'url_list'; items: string[] }
  | { kind: 'skipped' }    // NEW: field explicitly skipped
  | { kind: 'aborted' };   // NEW: agent couldn't provide value
```

### 2. Note Type (new section after DocumentationBlock)

```ts
/** Note attached to a field, group, or form */
interface Note {
  ref: Id;                              // target ID (field, group, or form)
  state?: 'skipped' | 'aborted';        // optional: links note to action
  text: string;                         // markdown content
}
```

### 3. ParsedForm (around line ~860)

Replace `skipsByFieldId` with `notes`:

```ts
interface ParsedForm {
  schema: FormSchema;
  valuesByFieldId: Record<Id, FieldValue>;
  notes: Note[];              // NEW: agent notes (replaces skipsByFieldId)
  docs: DocumentationBlock[];
  orderIndex: Id[];
  idIndex: Map<Id, IdIndexEntry>;
}
```

### 4. Patch Schema (around line ~1760)

Add new patch types:

```ts
type Patch =
  | { op: 'set_string'; fieldId: Id; value: string | null }
  | { op: 'set_number'; fieldId: Id; value: number | null }
  | { op: 'set_string_list'; fieldId: Id; items: string[] }
  | { op: 'set_checkboxes'; fieldId: Id; values: Record<OptionId, CheckboxValue> }
  | { op: 'set_single_select'; fieldId: Id; selected: OptionId | null }
  | { op: 'set_multi_select'; fieldId: Id; selected: OptionId[] }
  | { op: 'set_url'; fieldId: Id; value: string | null }
  | { op: 'set_url_list'; fieldId: Id; items: string[] }
  | { op: 'clear_field'; fieldId: Id }
  | { op: 'skip_field'; fieldId: Id; reason?: string }
  | { op: 'abort_field'; fieldId: Id; reason?: string }     // NEW
  | { op: 'add_note'; ref: Id; text: string; state?: 'skipped' | 'aborted' };  // NEW
```

### 5. Patch Semantics (around line ~1789)

Update documentation:

```markdown
**Sentinel patches:**

- `skip_field`: Set field value to `{ kind: 'skipped' }`.
  - Can only be applied to optional fields (required fields reject with error)
  - If `reason` provided, also adds a note with `state="skipped"`

- `abort_field`: Set field value to `{ kind: 'aborted' }`.
  - Can be applied to any field (indicates agent failure)
  - If `reason` provided, also adds a note with `state="aborted"`
  - Aborted fields block form completion

- `add_note`: Add a note to the form.
  - `ref` must be a valid field, group, or form ID
  - `state` optionally links the note to a skip/abort action
  - Notes are append-only (cannot be deleted)
```

### 6. Serialization: Field State Attribute (markform format)

```markdown
#### Field State Attribute

Fields support a `state` attribute to indicate skipped/aborted status:

| State | Meaning | When Valid |
|-------|---------|------------|
| `empty` | No response yet (default for unfilled) | Unfilled field |
| `answered` | Has a value (default for filled) | Filled field |
| `skipped` | Explicitly skipped | Unfilled field only |
| `aborted` | Agent couldn't provide value | Unfilled field only |

**Validation:** `state="skipped"` or `state="aborted"` on a filled field is a validation error.

**Examples:**

String field skipped:
\`\`\`md
{% string-field id="company_name" label="Company name" state="skipped" %}
{% /string-field %}
\`\`\`

Checkboxes aborted (inline markers remain as schema defaults):
\`\`\`md
{% checkboxes id="docs_reviewed" label="Documents reviewed" state="aborted" %}
- [ ] 10-K {% #ten_k %}
- [ ] 10-Q {% #ten_q %}
{% /checkboxes %}
\`\`\`

#### Sentinel Values for Value Export (YAML/JSON)

For value-only export (no tags), use sentinel strings:

| Internal Value | Export As |
|----------------|-----------|
| `{ kind: 'skipped' }` | `"|SKIP|"` |
| `{ kind: 'aborted' }` | `"|ABORT|"` |

Example YAML:
\`\`\`yaml
company_name: "|SKIP|"
revenue_m: "|ABORT|"
quarterly_growth: 12.5
\`\`\`
```

### 7. Serialization: Note Tags (new section)

```markdown
#### Note Tags

Notes are runtime additions by agents/users, serialized at the end of the form:

\`\`\`md
{% note id="n1" ref="field_id" role="agent" %}
General observation about this field.
{% /note %}

{% note id="n2" ref="field_id" role="agent" state="skipped" %}
Reason why this field was skipped.
{% /note %}

{% note id="n3" ref="field_id" role="agent" state="aborted" %}
Reason why agent couldn't fill this field.
{% /note %}
\`\`\`

**Attributes:**

- `id` (required): Unique note identifier (n1, n2, n3, ...)
- `ref` (required): ID of target element (field, group, or form)
- `role` (required): Who created the note (e.g., 'agent', 'user')
- `state` (optional): `"skipped"` or `"aborted"` to link note to action

**Placement rules:**

- Notes appear at the end of the form, before `{% /form %}`
- Notes are sorted numerically by `id` to preserve insertion order
- Multiple notes can reference the same target
```

### 8. ProgressCounts (around line ~1069)

Update counts:

```ts
interface ProgressCounts {
  totalFields: number;
  requiredFields: number;
  submittedFields: number;       // deprecated: use answeredFields
  answeredFields: number;        // fields with real values
  skippedFields: number;         // fields with |SKIP| sentinel
  abortedFields: number;         // NEW: fields with |ABORT| sentinel
  emptyFields: number;           // NEW: fields with no response
  totalNotes: number;            // NEW: count of all notes
  completeFields: number;
  incompleteFields: number;
  invalidFields: number;
  emptyRequiredFields: number;
  emptyOptionalFields: number;
}
```

### 9. FieldProgress (around line ~1026)

Update fields:

```ts
interface FieldProgress {
  kind: FieldKind;
  required: boolean;
  submitted: boolean;                    // deprecated
  responseState: 'empty' | 'answered' | 'skipped' | 'aborted';  // NEW
  hasNotes: boolean;                     // NEW
  state: ProgressState;
  valid: boolean;
  issueCount: number;
  checkboxProgress?: CheckboxProgressCounts;
}
```

### 10. Completion Definition (around line ~1721)

Update completion formula:

```markdown
**Completion formula:**

\`\`\`
isComplete = (answeredFields + skippedFields == totalFields for target roles)
             AND (abortedFields == 0)
             AND (no issues with severity == 'required')
\`\`\`

Key points:
- All fields must be either answered or skipped
- Aborted fields block completion (they represent failures)
- Required fields must have real values (can't be skipped)
```

### 11. Form State Computation (around line ~1074)

Update form state rules:

```markdown
**Form state computation (`form_state` in frontmatter):**

\`\`\`
if counts.abortedFields > 0:
  form_state = 'invalid'  // Aborted = failure state
elif counts.invalidFields > 0:
  form_state = 'invalid'
elif not allFieldsAccountedFor or counts.emptyRequiredFields > 0:
  form_state = 'incomplete'
else:
  form_state = 'complete'
\`\`\`
```

### 12. Design Decisions (around line ~2809)

Add new decision:

```markdown
XX. **Unified response model with notes** — The form value model treats SKIPPED and
    ABORTED as first-class sentinel values (`{ kind: 'skipped' }`, `{ kind: 'aborted' }`).
    Reasons and observations are stored as Notes, a general-purpose mechanism for
    attaching text to any form element. The `skip_field` and `abort_field` patches with
    reasons are syntactic sugar for setting the sentinel + adding a note. Notes serialize
    at the end of the form in `{% note %}` tags. Aborted fields block form completion.
```

## Open Questions

### Resolved

1. **Where do notes serialize?**

   - **Decision:** At end of form, before `{% /form %}`

2. **How are notes sorted?**

   - **Decision:** Numerically by ID (n1, n2, n3 …) which preserves insertion order

3. **Can notes be deleted?**

   - **Decision:** Yes, via `remove_note(noteId)` or `remove_notes(ref, role)`

4. **Do notes have unique IDs?**

   - **Decision:** Yes, incrementing IDs like n1, n2, n3

5. **Do notes track who created them?**

   - **Decision:** Yes, `role` attribute is required (e.g., ‘agent’, ‘user’)

6. **Is the library thread-safe?**

   - **Decision:** Yes, use mutex/atomic operations for note ID generation

7. **What happens to notes when setting a value on a skipped/aborted field?**

   - **Decision:** Notes with matching `state` are auto-removed; general notes preserved

8. **Can agents add notes without skip/abort?**

   - **Decision:** Yes, via `add_note` patch without state attribute

9. **Should dump/export include notes?**

   - **Decision:** Yes, notes are included in all output formats (JSON, YAML, etc.)

### Deferred

10. **Should notes support markdown formatting?**

    - Keep simple plain text for v1; revisit if needed

11. **Should there be a limit on notes per field?**

    - No limit for v1; monitor for abuse

## Revision History

| Date | Author | Changes |
| --- | --- | --- |
| 2025-12-25 | Claude | Initial draft based on discussion of unified response model |
| 2025-12-25 | Claude | Added note IDs (n1, n2, n3...), role tracking, remove_note/remove_notes operations |
| 2025-12-25 | Claude | Added thread-safety requirements for concurrent agents |
| 2025-12-25 | Claude | Added auto-cleanup of state-linked notes when setting values |
| 2025-12-25 | Claude | Added requirement to include notes in dump/export |
| 2025-12-25 | Claude | Expanded golden tests: markdown/YAML/JSON round-trip, session with add/remove notes |
| 2025-12-25 | Claude | Added detailed completion logic implementation changes (summaries.ts) |
| 2025-12-25 | Claude | Added comprehensive completion logic tests; expanded acceptance criteria |
| 2025-12-25 | Claude | Redesigned serialization: state attr on field tags (markform), sentinels for value export only |
| 2025-12-25 | Claude | Added FieldSyntax ('text' \| 'checkboxes') type; sentinel in value fence accepted and normalized |
| 2025-12-25 | Claude | Added comprehensive parse vs validation error section with type definitions and architecture changes |
| 2025-12-25 | Claude | Ensured url and url_list field kinds included in all Patch unions; added type-safe field registry design decision |
