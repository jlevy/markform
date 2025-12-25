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
 * This is a parser-internal concept, not part of the public API.
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
| `single_select` | `checkboxes` | Any option has `[x]` marker |
| `multi_select` | `checkboxes` | Any option has `[x]` marker |
| `checkboxes` | `checkboxes` | Any marker changed from default |

**Text syntax fields** use a value fence (`` ```value ``) for their content.
Sentinel values (`|SKIP|`, `|ABORT|`) can appear in the fence as alternative syntax.

**Checkboxes syntax fields** use `[ ]`/`[x]` markers on list items.
They do NOT have value fences, so sentinels cannot appear in content—use the `state`
attribute on the field tag instead.

**Note:** This categorization is a parser-internal detail to determine how to detect
“filled” state and where sentinels can appear.
It is not exposed in the public API.

### 2. Response State Model

**Design principle:** Keep `FieldValue.kind` strictly for field types.
Response state (empty/answered/skipped/aborted) is orthogonal to field type and stored
separately.

```typescript
/**
 * Response state for a field.
 * Orthogonal to field type (kind) — any field can be in any response state.
 */
type ResponseState = 'empty' | 'answered' | 'skipped' | 'aborted';

/**
 * FieldValue remains unchanged — kind is strictly for field types.
 * No sentinel kinds added.
 */
type FieldValue =
  | { kind: 'string'; value: string | null }
  | { kind: 'number'; value: number | null }
  | { kind: 'string_list'; items: string[] }
  | { kind: 'checkboxes'; values: Record<OptionId, CheckboxValue> }
  | { kind: 'single_select'; selected: OptionId | null }
  | { kind: 'multi_select'; selected: OptionId[] }
  | { kind: 'url'; value: string | null }
  | { kind: 'url_list'; items: string[] };

/**
 * Field response: combines response state with optional value.
 * Used in valuesByFieldId for fields that have been explicitly addressed.
 */
interface FieldResponse {
  state: ResponseState;
  value?: FieldValue;  // present only when state === 'answered'
}
```

**Why this design?**

1. **`kind` invariant preserved:** `FieldValue.kind` remains strictly for field type
   discrimination. Switch statements on `value.kind` don’t need sentinel branches.

2. **Exhaustiveness checks work:** When switching on `value.kind`, you handle all field
   types. No risk of missing `'skipped'` or `'aborted'` cases in field-type logic.

3. **Clear separation:** Response state is about *whether* a value exists; field kind is
   about *what type* of value it is.
   These are orthogonal concerns.

4. **Simpler validators/serializers:** Code that processes field values only runs when
   `state === 'answered'`, keeping type-specific logic clean.

**Storage model:**

```typescript
interface ParsedForm {
  schema: FormSchema;
  responsesByFieldId: Record<Id, FieldResponse>;  // state + optional value
  notes: Note[];
  docs: DocumentationBlock[];
  orderIndex: Id[];
  idIndex: Map<Id, IdIndexEntry>;
}
```

**Response state semantics:**

| State | Meaning | `value` property |
| --- | --- | --- |
| `empty` | No response yet (template state) | `undefined` |
| `answered` | Has a value | Required (the actual `FieldValue`) |
| `skipped` | Explicitly skipped (optional fields only) | `undefined` |
| `aborted` | Agent failed to provide value | `undefined` |

### 3. Add Notes as General-Purpose Mechanism

Notes are text linked to any form element, with unique IDs and role tracking:

```typescript
/** Unique note ID */
type NoteId = string;

/** Note attached to a field, group, or form */
interface Note {
  id: NoteId;                           // unique note ID
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
  docs: DocumentationBlock[];
  orderIndex: Id[];
  idIndex: Map<Id, IdIndexEntry>;
}
```

**Note ID format (implementation detail):**

The TypeScript implementation uses sequential IDs like `n1`, `n2`, `n3` for
human-readability. This is an **implementation detail**, not part of the specification.
Other implementations could use ULIDs, UUIDs, or other unique ID schemes.

Requirements for any implementation:

- IDs must be unique within a form

- IDs must be stable across parse/serialize round-trips

- Notes must serialize in a deterministic order (the reference implementation sorts
  numerically by ID suffix, which preserves insertion order)

**Note ordering:** Notes serialize in a deterministic order.
The reference implementation sorts numerically by ID (n1, n2, n10 before n3), which
preserves insertion order when IDs are generated sequentially.

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
| `skip_field(id, role)` | Set response to `{ state: 'skipped' }` | — |
| `skip_field(id, role, reason)` | Set response + add note with `state="skipped"` | note ID |
| `abort_field(id, role)` | Set response to `{ state: 'aborted' }` | — |
| `abort_field(id, role, reason)` | Set response + add note with `state="aborted"` | note ID |
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

- `state="skipped"` on a **required** field → **validation error** (required fields
  cannot be skipped; they must be answered or aborted)

- `state` attribute is only valid on fields, NOT on field-groups

**Conflict rules (validation errors):**

Any mismatch between `state` attribute and field content is a **validation error**:

1. **Filled field with state attribute**: A field with actual content (value in fence,
   or selected options) cannot have `state="skipped"` or `state="aborted"` — this is a
   validation error

2. **Conflicting sentinel and state**: If fence contains a sentinel that doesn’t match
   the `state` attribute (e.g., `state="skipped"` with `|ABORT|` in fence), this is a
   validation error

3. **Redundant but valid**: `state="skipped"` with `|SKIP|` in fence is accepted
   (redundant but not conflicting); serialization normalizes to state-attribute-only

**Parsing rules (when no conflict):**

1. If `state` attribute is `'skipped'` or `'aborted'` (and field is unfilled): use that
   state

2. Else if text fence contains exact sentinel (`|SKIP|` or `|ABORT|`): parse as that
   state

3. Else if field has content: parse as `'answered'` with the value

4. Else: field is `'empty'`

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

| Internal FieldResponse | → markform format |
| --- | --- |
| `undefined` or `{ state: 'empty' }` | no value fence, no state attr |
| `{ state: 'skipped' }` | `state="skipped"`, no value fence |
| `{ state: 'aborted' }` | `state="aborted"`, no value fence |
| `{ state: 'answered', value }` | value fence with content (state attr omitted, defaults to 'answered') |

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

#### Value Serialization (Export Formats)

**JSON export (structured, default):**

JSON export uses structured objects to avoid ambiguity with actual string values:

```json
{
  "company_name": { "state": "skipped" },
  "revenue_m": { "state": "aborted" },
  "quarterly_growth": { "state": "answered", "value": 12.5 },
  "ticker": { "state": "answered", "value": "ACME" }
}
```

This eliminates any collision between sentinel strings and legitimate field values.

**YAML export (structured, default):**

```yaml
company_name:
  state: skipped
revenue_m:
  state: aborted
quarterly_growth:
  state: answered
  value: 12.5
ticker:
  state: answered
  value: ACME
```

**YAML export (friendly mode, `--friendly` flag):**

For human-readable output, an optional friendly mode uses sentinel tokens:

```yaml
company_name: "|SKIP|"
revenue_m: "|ABORT|"
quarterly_growth: 12.5
ticker: ACME
```

The sentinels `|SKIP|` and `|ABORT|` are string values that represent the
skipped/aborted states.
**Use friendly mode only for human consumption**, not for machine-to-machine interchange
(since a field could legitimately have the value `"|SKIP|"`).

**Import behavior:**

When importing values (from YAML or JSON):

- Structured format: parse `state` and `value` properties

- Friendly YAML: recognize `|SKIP|` and `|ABORT|` sentinel strings

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
| `tag` attr | description, instructions, notes, examples | — |
| `state` attr | — | skipped, aborted, or omitted |
| Deletable | No (part of schema) | Yes (via remove_note) |

### 7. Progress Summary Updates

```typescript
interface FieldProgress {
  kind: FieldKind;
  required: boolean;

  /** Response state (unified, replaces old 'submitted' boolean) */
  responseState: ResponseState;  // 'empty' | 'answered' | 'skipped' | 'aborted'

  /** Whether this field has associated notes */
  hasNotes: boolean;

  /** Count of notes for this field */
  noteCount: number;

  state: ProgressState;
  valid: boolean;
  issueCount: number;
  checkboxProgress?: CheckboxProgressCounts;
}

interface ProgressCounts {
  totalFields: number;
  requiredFields: number;

  /** Response state counts (mutually exclusive, sum to totalFields) */
  answeredFields: number;    // fields with state === 'answered'
  skippedFields: number;     // fields with state === 'skipped'
  abortedFields: number;     // fields with state === 'aborted'
  emptyFields: number;       // fields with state === 'empty' (or no entry)

  /** Note count */
  totalNotes: number;

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

**Removed:** The `submitted` and `submittedFields` properties are removed.
Use `responseState` and the four state counts instead.
“Submitted” was ambiguous (did it include skipped?
aborted?); the new model is explicit.

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

2. **No unified response state** — Current `FieldProgress` has `skipped: boolean` and
   `submitted: boolean` but not a clean `responseState`.

3. **No `abortedFields` count** — Current `ProgressCounts` only has `skippedFields`.

**Changes required in `summaries.ts`:**

```typescript
// NEW: Get response state from FieldResponse
function getResponseState(response: FieldResponse | undefined): ResponseState {
  if (!response) return 'empty';
  return response.state;
}

// NEW: Check if a FieldValue has actual content (for 'answered' state validation)
function isValueFilled(value: FieldValue): boolean {
  switch (value.kind) {
    case 'string':
      return value.value !== null && value.value.trim() !== '';
    case 'number':
      return value.value !== null;
    case 'string_list':
      return value.items.length > 0;
    case 'single_select':
      return value.selected !== null;
    case 'multi_select':
      return value.selected.length > 0;
    case 'checkboxes':
      // Filled if any checkbox changed from default
      return Object.values(value.values).some(v => v !== 'todo' && v !== 'unfilled');
    case 'url':
      return value.value !== null && value.value.trim() !== '';
    case 'url_list':
      return value.items.length > 0;
  }
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

// AFTER: Takes responsesByFieldId (unified model), notes for counting
export function computeProgressSummary(
  schema: FormSchema,
  responses: Record<Id, FieldResponse>,  // state + optional value
  issues: InspectIssue[],
  notes: Note[] = []
): ProgressSummary
```

**Changes to `isFormComplete()`:**

```typescript
export function isFormComplete(progress: ProgressSummary): boolean {
  const { counts } = progress;

  // Aborted fields block completion (they're failures)
  if (counts.abortedFields > 0) {
    return false;
  }

  // All fields must be either answered or skipped
  const allFieldsAccountedFor =
    (counts.answeredFields + counts.skippedFields) === counts.totalFields;

  // No required validation issues
  const noRequiredIssues = counts.invalidFields === 0;

  return allFieldsAccountedFor && noRequiredIssues;
}
```

**Changes to `computeFormState()`:**

```typescript
export function computeFormState(progress: ProgressSummary): ProgressState {
  const { counts } = progress;

  // Aborted fields make the form invalid
  if (counts.abortedFields > 0) {
    return 'invalid';
  }

  // Validation errors make the form invalid
  if (counts.invalidFields > 0) {
    return 'invalid';
  }

  // Check if all fields are accounted for
  const allAccountedFor =
    (counts.answeredFields + counts.skippedFields) === counts.totalFields;

  if (!allAccountedFor || counts.emptyRequiredFields > 0) {
    return 'incomplete';
  }

  return 'complete';
}
```

**Files to modify:**

| File | Changes |
| --- | --- |
| `coreTypes.ts` | Add `ResponseState` and `FieldResponse` types; add `responseState` to `FieldProgress`; add `abortedFields`, `emptyFields`, `totalNotes` to `ProgressCounts`; remove `SkipInfo` and `skipsByFieldId`; remove `submitted`/`submittedFields` |
| `summaries.ts` | Update `computeProgressSummary()` to take `responses: Record<Id, FieldResponse>`; compute all counts from `response.state`; remove skip handling from separate map |
| `apply.ts` | Remove `skipsByFieldId` handling; store `FieldResponse` objects |
| `parse.ts` | Parse `state` attribute; build `responsesByFieldId`; validate state vs filled consistency |
| `serialize.ts` | Emit `state` attribute for skipped/aborted; structured export for JSON/YAML |
| `inspect.ts` | Update to use new completion logic |

**Key semantic changes:**

1. **Unified response model** — Each field has a `FieldResponse` with `state` and
   optional `value`. No separate maps for skips.

2. **Clean separation** — `FieldValue.kind` is strictly for field types.
   Response state is orthogonal.

3. **Completion requires no aborts** — Unlike skipped (which counts as “addressed”),
   aborted is a failure state that blocks completion.

4. **Notes are counted** — `totalNotes` and per-field `hasNotes`/`noteCount` track agent
   comments.

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN — this is a breaking
  refactor of the value model.
  `valuesByFieldId` and `skipsByFieldId` are replaced by unified `responsesByFieldId`.

- **Library APIs**: DO NOT MAINTAIN — `skip_field` patch now sets response state, not
  metadata. New `abort_field`, `add_note`, `remove_note`, `remove_notes` patches added.
  Export format changes to structured by default.

- **Server APIs**: N/A

- **File formats**: SUPPORT BOTH — Old forms without state attributes/notes work
  unchanged. New forms with `state` attribute and `{% note %}` tags parse correctly.
  Old forms without these features continue to work (state defaults to ‘empty’ or
  ‘answered’ based on whether field is filled).

- **Database schemas**: N/A

**Migration Notes:**

- Existing forms without skip/abort/notes work unchanged (empty fields default to
  `state: 'empty'`; filled fields default to `state: 'answered'`)

- Forms with the old `skipsByFieldId` runtime state will need re-filling (skip state was
  never persisted anyway)

- Callers using `valuesByFieldId` must migrate to `responsesByFieldId.*.value`

- Callers using `submitted`/`submittedFields` must migrate to `responseState`/counts

- No automated migration needed—this is a forward-only enhancement

## Stage 1: Planning Stage

### Current State Analysis

**Existing Components:**

| Component | Location | Change Needed |
| --- | --- | --- |
| `FieldValue` union | `coreTypes.ts` | Unchanged (no sentinel kinds) |
| New: `ResponseState` | `coreTypes.ts` | Add `'empty' \| 'answered' \| 'skipped' \| 'aborted'` |
| New: `FieldResponse` | `coreTypes.ts` | Add `{ state: ResponseState; value?: FieldValue }` |
| `Patch` union | `coreTypes.ts` | Add `abort_field`, `add_note`, `remove_note`, `remove_notes`; update `skip_field` |
| `ParsedForm` | `coreTypes.ts` | Replace `valuesByFieldId` + `skipsByFieldId` with `responsesByFieldId`; add `notes: Note[]` |
| `FieldProgress` | `coreTypes.ts` | Replace `submitted`/`skipped` with `responseState`; add `hasNotes`, `noteCount` |
| `ProgressCounts` | `coreTypes.ts` | Add `abortedFields`, `emptyFields`, `totalNotes`; remove `submittedFields` |
| Error types | `coreTypes.ts` | Add `ParseError`, `ValidationError`, `MarkformError` types |
| `parseForm()` | `parse.ts` | Parse `state` attribute on fields, parse `{% note %}` tags; build `responsesByFieldId` |
| `serialize()` | `serialize.ts` | Emit `state` attribute for skipped/aborted; structured export; emit notes at end |
| `applyPatches()` | `apply.ts` | Handle `abort_field`, `add_note`, `remove_note`, `remove_notes`; work with `FieldResponse` |
| `computeProgressSummary()` | `summaries.ts` | Take `responsesByFieldId`; compute new counts from `response.state` |
| `inspect()` | `inspect.ts` | Update completion logic |
| Architecture doc | `arch-markform-initial-design.md` | Add error taxonomy section; document ResponseState/FieldResponse |

### Feature Scope

**In Scope:**

- `ResponseState` type (`'empty' | 'answered' | 'skipped' | 'aborted'`)

- `FieldResponse` type (combines `state` with optional `value`)

- `state` attribute on field tags in markform format

- Structured export format for JSON/YAML (default); friendly sentinel format (optional)

- `Note` type and `notes: Note[]` in `ParsedForm`

- `{% note %}` tag parsing and serialization

- `abort_field` and `add_note` patch operations

- `skip_field` updated to set response state (not metadata)

- `remove_note` and `remove_notes` patch operations

- `responseState`, `hasNotes`, and `noteCount` in `FieldProgress`

- `abortedFields`, `emptyFields`, `totalNotes` in `ProgressCounts`

- Updated completion formula (aborted fields block completion)

- Remove `skipsByFieldId` and `valuesByFieldId` from `ParsedForm`; replace with
  `responsesByFieldId`

- Golden tests for all new features

- CLI inspect showing notes and response states

- Dump/export includes notes in all formats (JSON, YAML, etc.)

- Formalize `ParseError` and `ValidationError` types in `coreTypes.ts`

- Update architecture doc with error taxonomy

- Validation: `state="skipped"` on required field is an error

**Out of Scope (Explicit Non-Goals):**

- UI changes in web serve mode (follow-up)

- Agent prompt changes to teach abort/note behavior (separate feature)

- Note editing (can add and remove, but not modify)

- Multi-line notes with complex markdown (keep simple for v1)

- Multi-process synchronization (caller’s responsibility)

### Acceptance Criteria

**Markform format parsing:**

1. `state="skipped"` on unfilled field parses to `{ state: 'skipped' }`

2. `state="aborted"` on unfilled field parses to `{ state: 'aborted' }`

3. `state="skipped"` or `state="aborted"` on filled field → validation error

4. `state="skipped"` on required field → validation error

5. `state` attribute on field-group → validation error (only valid on fields)

6. `{% note %}` tags parse correctly with `id`, `ref`, `role`, and optional `state`

**Patch operations:**

7. `skip_field` patch sets response to `{ state: 'skipped' }`

8. `skip_field` on required field is rejected with error

9. `skip_field` with reason sets response AND adds note with `state="skipped"`

10. `abort_field` patch sets response to `{ state: 'aborted' }`

11. `abort_field` with reason sets response AND adds note with `state="aborted"`

12. `add_note` patch adds note to `notes` array and returns note ID

13. `add_note` with invalid ref is rejected with error

14. `remove_note` removes specific note by ID

15. `remove_notes(ref, role)` removes all notes for that ref + role

**Serialization:**

16. Markform serialization emits `state="skipped"` or `state="aborted"` on field tags

17. JSON/YAML export uses structured format by default: `{ state: 'skipped' }`

18. YAML export with `--friendly` uses sentinel strings: `"|SKIP|"`, `"|ABORT|"`

**Sentinel in value fence (text syntax fields):**

19. `|SKIP|` in text value fence parses as `{ state: 'skipped' }`

20. `|ABORT|` in text value fence parses as `{ state: 'aborted' }`

21. Sentinel with conflicting state attr produces validation error

22. Sentinel normalizes to state attr on serialize (canonical form)

**Notes serialization:**

23. Serialization emits notes at end of form, in deterministic order

24. Notes include `id`, `ref`, `role`, and optional `state` attributes

**Progress and completion:**

25. `responseState` correctly computed for each field from `FieldResponse.state`

26. `abortedFields` count correctly computed

27. Form with aborted fields has `form_state: 'invalid'`

28. Form completion requires `abortedFields == 0`

**Auto-cleanup:**

29. Setting value on skipped field auto-removes `state="skipped"` notes

30. Setting value on aborted field auto-removes `state="aborted"` notes

31. General notes (no state) are preserved when setting values

**Concurrency and export:**

32. Note ID generation produces unique IDs within a process

33. Dump/export includes notes in JSON and YAML formats (structured by default)

**Testing:**

34. Golden tests verify state attribute and note round-tripping (markform format)

35. Golden tests verify structured format round-tripping (JSON/YAML export)

36. CLI inspect shows notes and response states

**Internal changes:**

37. `valuesByFieldId` and `skipsByFieldId` removed; replaced with `responsesByFieldId`

38. `computeProgressSummary()` takes `responsesByFieldId` (unified model)

39. Response state read from `FieldResponse.state`, not computed from value

40. `isFormComplete()` returns false when `abortedFields > 0`

41. All round-trip tests pass for markdown, YAML, and JSON with notes

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

- [ ] Parse `|SKIP|` in string field value fence → `{ state: 'skipped' }`

- [ ] Parse `|ABORT|` in string field value fence → `{ state: 'aborted' }`

- [ ] Parse `|SKIP|` in number field value fence → `{ state: 'skipped' }`

- [ ] Parse `|ABORT|` in url field value fence → `{ state: 'aborted' }`

- [ ] Sentinel with matching state attr is valid (no conflict)

- [ ] Sentinel with conflicting state attr produces validation error

- [ ] Sentinel normalizes to state attr on round-trip (parse → serialize → parse)

- [ ] Sentinel not applicable to inline syntax fields (checkboxes, selects)

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

- [ ] Serialize `{ state: 'skipped' }` as `state="skipped"` on field tag (no value
  fence)

- [ ] Serialize `{ state: 'aborted' }` as `state="aborted"` on field tag (no value
  fence)

- [ ] Serialize skipped checkboxes: `state="skipped"`, markers at defaults

- [ ] Serialize aborted single-select: `state="aborted"`, markers at defaults

- [ ] Filled field has no state attr (defaults to ‘answered’)

- [ ] Empty field has no state attr (defaults to ‘empty’)

- [ ] Round-trip: parse → serialize → parse produces identical result

**Structured export (JSON/YAML):**

- [ ] Export `{ state: 'skipped' }` as `{ "state": "skipped" }` in JSON

- [ ] Export `{ state: 'aborted' }` as `{ "state": "aborted" }` in JSON

- [ ] Export `{ state: 'answered', value }` as `{ "state": "answered", "value": ... }`

- [ ] Parse structured format back to correct FieldResponse

- [ ] Round-trip: export → import → export produces identical values

**Friendly YAML export (optional):**

- [ ] With `--friendly`, export skipped as `"|SKIP|"` string

- [ ] With `--friendly`, export aborted as `"|ABORT|"` string

- [ ] Parse friendly format (`"|SKIP|"`) back to `{ state: 'skipped' }`

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

- [ ] `skip_field` on optional field sets `{ state: 'skipped' }`

- [ ] `skip_field` on required field returns error

- [ ] `skip_field` with reason adds note with `state="skipped"`

- [ ] `skip_field` without reason does not add note

- [ ] `skip_field` clears any existing response (becomes skipped)

**abort_field:**

- [ ] `abort_field` on any field sets `{ state: 'aborted' }`

- [ ] `abort_field` with reason adds note with `state="aborted"`

- [ ] `abort_field` without reason does not add note

- [ ] `abort_field` clears any existing response (becomes aborted)

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

- [ ] Field with `{ state: 'answered', value }`: `responseState = 'answered'`

- [ ] Field with `{ state: 'skipped' }`: `responseState = 'skipped'`

- [ ] Field with `{ state: 'aborted' }`: `responseState = 'aborted'`

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

**Response state from FieldResponse:**

- [ ] Response is undefined → `responseState = 'empty'`

- [ ] Response is `{ state: 'empty' }` → `responseState = 'empty'`

- [ ] Response is `{ state: 'skipped' }` → `responseState = 'skipped'`

- [ ] Response is `{ state: 'aborted' }` → `responseState = 'aborted'`

- [ ] Response is `{ state: 'answered', value: { kind: 'string', value: 'hello' } }` →
  `responseState = 'answered'`

**`computeProgressSummary()` counts:**

- [ ] All empty: `emptyFields == totalFields`, others zero

- [ ] Mix of answered/skipped/aborted: each count correct

- [ ] Counts derived from `response.state`, not from inspecting values

- [ ] Notes parameter used to compute `totalNotes` and per-field `hasNotes`/`noteCount`

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
 * How field values are represented in markform syntax (parser-internal).
 */
type FieldSyntax = 'text' | 'checkboxes';

/**
 * Response state for a field (orthogonal to field type).
 */
type ResponseState = 'empty' | 'answered' | 'skipped' | 'aborted';

/**
 * Unique note ID (implementation uses n1, n2, ... but format is not specified).
 */
type NoteId = string;

/**
 * Field response: combines response state with optional value.
 */
interface FieldResponse {
  state: ResponseState;
  value?: FieldValue;  // present only when state === 'answered'
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

// --- Unchanged Types ---

/**
 * FieldValue: kind is strictly for field types (no sentinel kinds).
 */
type FieldValue =
  | { kind: 'string'; value: string | null }
  | { kind: 'number'; value: number | null }
  | { kind: 'string_list'; items: string[] }
  | { kind: 'checkboxes'; values: Record<OptionId, CheckboxValue> }
  | { kind: 'single_select'; selected: OptionId | null }
  | { kind: 'multi_select'; selected: OptionId[] }
  | { kind: 'url'; value: string | null }
  | { kind: 'url_list'; items: string[] };

// --- Updated Types ---

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
  responsesByFieldId: Record<Id, FieldResponse>;  // state + optional value
  notes: Note[];           // NEW (replaces skipsByFieldId)
  docs: DocumentationBlock[];
  orderIndex: Id[];
  idIndex: Map<Id, IdIndexEntry>;
}

interface FieldProgress {
  kind: FieldKind;
  required: boolean;
  responseState: ResponseState;  // replaces submitted + skipped booleans
  hasNotes: boolean;
  noteCount: number;
  state: ProgressState;
  valid: boolean;
  issueCount: number;
  checkboxProgress?: CheckboxProgressCounts;
}

interface ProgressCounts {
  totalFields: number;
  requiredFields: number;

  // Response state counts (mutually exclusive, sum to totalFields)
  answeredFields: number;
  skippedFields: number;
  abortedFields: number;
  emptyFields: number;

  // Note count
  totalNotes: number;

  // Validation counts (unchanged)
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

const SENTINEL_SKIP = '|SKIP|';
const SENTINEL_ABORT = '|ABORT|';

function getFieldSyntax(fieldKind: FieldKind): FieldSyntax {
  // Checkboxes syntax: select and checkbox fields use [ ]/[x] markers
  if (fieldKind === 'checkboxes' || fieldKind === 'single_select' || fieldKind === 'multi_select') {
    return 'checkboxes';
  }
  // Text syntax: fields with value fences
  return 'text';
}

/**
 * Parse a field tag and return its response (state + optional value).
 */
function parseFieldTag(
  node: Tag,
  fieldKind: FieldKind,
  fieldRequired: boolean
): FieldResponse {
  const stateAttr = node.attributes.state as ResponseState | undefined;
  const fieldSyntax = getFieldSyntax(fieldKind);

  // For text syntax fields, check for sentinel values in fence
  if (fieldSyntax === 'text') {
    const valueFence = extractValueFence(node);
    const valueFenceContent = valueFence?.trim() ?? '';

    if (valueFenceContent === SENTINEL_SKIP) {
      if (stateAttr && stateAttr !== 'skipped') {
        throw new ValidationError(
          `Field ${node.attributes.id}: conflicting state="${stateAttr}" with |SKIP| sentinel`
        );
      }
      if (fieldRequired) {
        throw new ValidationError(
          `Field ${node.attributes.id}: cannot skip required field`
        );
      }
      return { state: 'skipped' };
    }

    if (valueFenceContent === SENTINEL_ABORT) {
      if (stateAttr && stateAttr !== 'aborted') {
        throw new ValidationError(
          `Field ${node.attributes.id}: conflicting state="${stateAttr}" with |ABORT| sentinel`
        );
      }
      return { state: 'aborted' };
    }

    // Has actual content
    if (valueFenceContent !== '') {
      if (stateAttr === 'skipped' || stateAttr === 'aborted') {
        throw new ValidationError(
          `Field ${node.attributes.id}: state="${stateAttr}" not allowed on filled field`
        );
      }
      const value = parseValueFence(valueFence, fieldKind);
      return { state: 'answered', value };
    }
  }

  // For checkboxes syntax fields, check markers
  if (fieldSyntax === 'checkboxes') {
    const isFilled = hasChangedMarkers(node, fieldKind);

    if (isFilled) {
      if (stateAttr === 'skipped' || stateAttr === 'aborted') {
        throw new ValidationError(
          `Field ${node.attributes.id}: state="${stateAttr}" not allowed on filled field`
        );
      }
      const value = parseInlineMarkers(node, fieldKind);
      return { state: 'answered', value };
    }
  }

  // Field is unfilled — check state attribute
  if (stateAttr === 'skipped') {
    if (fieldRequired) {
      throw new ValidationError(
        `Field ${node.attributes.id}: cannot skip required field`
      );
    }
    return { state: 'skipped' };
  }

  if (stateAttr === 'aborted') {
    return { state: 'aborted' };
  }

  // Default: empty
  return { state: 'empty' };
}

function validateFieldGroupTag(node: Tag): void {
  if (node.attributes.state) {
    throw new ValidationError(
      `Field-group ${node.attributes.id}: state attribute not allowed on field-groups`
    );
  }
}

function parseNoteTag(node: Tag, idIndex: Map<Id, IdIndexEntry>): Note {
  const id = node.attributes.id as NoteId;
  const ref = node.attributes.ref as string;
  const role = node.attributes.role as string;
  const state = node.attributes.state as 'skipped' | 'aborted' | undefined;
  const text = extractContent(node);

  if (!id) {
    throw new ValidationError(`Note missing required id attribute`);
  }
  if (!ref) {
    throw new ValidationError(`Note missing required ref attribute`);
  }
  if (!role) {
    throw new ValidationError(`Note missing required role attribute`);
  }
  if (!idIndex.has(ref)) {
    throw new ValidationError(`Note references unknown ID: ${ref}`);
  }

  return { id, ref, role, state, text };
}
```

### Serialization Logic

```typescript
// In serialize.ts

const SENTINEL_SKIP = '|SKIP|';
const SENTINEL_ABORT = '|ABORT|';

/**
 * Serialize field tag with optional state attribute.
 * State attribute is only emitted for skipped/aborted (unfilled fields).
 */
function serializeFieldTag(field: Field, response: FieldResponse | undefined): string {
  const attrs = buildBaseFieldAttrs(field);
  const fieldSyntax = getFieldSyntax(field.kind);

  // No response = empty field
  if (!response || response.state === 'empty') {
    return serializeEmptyField(field, attrs);
  }

  // Skipped or aborted: emit state attribute, no value
  if (response.state === 'skipped' || response.state === 'aborted') {
    attrs.state = response.state;
    return serializeEmptyField(field, attrs);
  }

  // Answered: emit value (no state attribute, defaults to 'answered')
  if (fieldSyntax === 'text') {
    const valueFence = serializeValueFence(response.value!, field.kind);
    return `{% ${getTagName(field.kind)} ${formatAttrs(attrs)} %}\n${valueFence}{% /${getTagName(field.kind)} %}`;
  } else {
    // Inline syntax: markers are part of the field body
    const body = serializeInlineMarkers(response.value!, field);
    return `{% ${getTagName(field.kind)} ${formatAttrs(attrs)} %}\n${body}{% /${getTagName(field.kind)} %}`;
  }
}

function serializeEmptyField(field: Field, attrs: Record<string, unknown>): string {
  const fieldSyntax = getFieldSyntax(field.kind);

  if (fieldSyntax === 'checkboxes') {
    // For checkboxes-style fields, emit default markers
    const body = serializeDefaultMarkers(field);
    return `{% ${getTagName(field.kind)} ${formatAttrs(attrs)} %}\n${body}{% /${getTagName(field.kind)} %}`;
  }

  // Text fields: no value fence
  return `{% ${getTagName(field.kind)} ${formatAttrs(attrs)} %}{% /${getTagName(field.kind)} %}`;
}

/**
 * Structured export (default for JSON and YAML).
 * Returns objects with state and optional value.
 */
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

/**
 * Friendly export (optional for YAML, human-readable).
 * Uses sentinel strings for skipped/aborted.
 */
function serializeResponseFriendly(response: FieldResponse | undefined): unknown {
  if (!response || response.state === 'empty') {
    return null;
  }
  if (response.state === 'skipped') {
    return SENTINEL_SKIP;
  }
  if (response.state === 'aborted') {
    return SENTINEL_ABORT;
  }
  return serializeValueContent(response.value!);
}

/**
 * Parse response from structured import (JSON/YAML).
 */
function parseResponseFromImport(
  raw: unknown,
  fieldKind: FieldKind
): FieldResponse | undefined {
  if (raw === null || raw === undefined) {
    return undefined;  // empty
  }

  // Friendly format: sentinel strings
  if (raw === SENTINEL_SKIP) {
    return { state: 'skipped' };
  }
  if (raw === SENTINEL_ABORT) {
    return { state: 'aborted' };
  }

  // Structured format: { state, value? }
  if (typeof raw === 'object' && raw !== null && 'state' in raw) {
    const obj = raw as { state: ResponseState; value?: unknown };
    if (obj.state === 'empty') return undefined;
    if (obj.state === 'skipped') return { state: 'skipped' };
    if (obj.state === 'aborted') return { state: 'aborted' };
    if (obj.state === 'answered' && obj.value !== undefined) {
      return { state: 'answered', value: parseImportedValue(obj.value, fieldKind) };
    }
  }

  // Raw value (legacy or friendly format)
  const value = parseImportedValue(raw, fieldKind);
  return { state: 'answered', value };
}

function serializeNotes(notes: Note[]): string {
  // Sort by ID for deterministic output (implementation sorts numerically)
  const sorted = sortNotesByIdForExport(notes);

  return sorted.map(note => {
    const stateAttr = note.state ? ` state="${note.state}"` : '';
    return `{% note id="${note.id}" ref="${note.ref}" role="${note.role}"${stateAttr} %}\n${note.text}\n{% /note %}`;
  }).join('\n\n');
}

/**
 * Implementation detail: sort notes by numeric ID suffix.
 * Other implementations may use different sorting strategies.
 */
function sortNotesByIdForExport(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    // Extract numeric suffix (n1 -> 1, n12 -> 12)
    const aNum = parseInt(a.id.replace(/^n/, ''), 10) || 0;
    const bNum = parseInt(b.id.replace(/^n/, ''), 10) || 0;
    return aNum - bNum;
  });
}
```

### Apply Logic

```typescript
// In apply.ts

/**
 * Note ID generation (implementation detail).
 * The reference implementation uses sequential n1, n2, n3 IDs.
 * Other implementations may use ULIDs, UUIDs, etc.
 */
function generateNoteId(form: ParsedForm): NoteId {
  // Find max existing ID and increment
  const existingIds = form.notes.map(n => {
    const match = n.id.match(/^n(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  });
  const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
  return `n${maxId + 1}`;
}

function applySkipField(form: ParsedForm, patch: SkipFieldPatch): ApplyResult {
  const field = findFieldById(form, patch.fieldId);
  if (!field) {
    return errorResult(`Field not found: ${patch.fieldId}`);
  }

  if (field.required) {
    return errorResult(`Cannot skip required field: ${field.label}`);
  }

  // Set response state to skipped (no value)
  form.responsesByFieldId[patch.fieldId] = { state: 'skipped' };

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

  // Set response state to aborted (no required check - abort works on any field)
  form.responsesByFieldId[patch.fieldId] = { state: 'aborted' };

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

/**
 * Apply a value patch. Auto-cleanup: when setting a value on a field that
 * was previously skipped/aborted, remove notes with matching state.
 */
function applySetValue(form: ParsedForm, patch: SetValuePatch): ApplyResult {
  const existingResponse = form.responsesByFieldId[patch.fieldId];

  // Check if replacing a skipped or aborted response
  if (existingResponse?.state === 'skipped' || existingResponse?.state === 'aborted') {
    const stateToRemove = existingResponse.state;
    // Remove notes with matching state for this field (preserve general notes)
    form.notes = form.notes.filter(
      n => !(n.ref === patch.fieldId && n.state === stateToRemove)
    );
  }

  // Set the new response with the value
  form.responsesByFieldId[patch.fieldId] = {
    state: 'answered',
    value: patch.value,
  };

  return successResult(form);
}
```

### Completion Logic

```typescript
// In inspect.ts

export function inspect(form: ParsedForm, options: InspectOptions = {}): InspectResult {
  const progressSummary = computeProgressSummary(
    form.schema,
    form.responsesByFieldId,
    validationIssues,
    form.notes
  );

  // Role-filtered completion (optional)
  const targetRoles = options.targetRoles ?? ['*'];  // '*' means all roles
  const targetRoleFields = getFieldsForRoles(form.schema, targetRoles);
  const targetFieldIds = new Set(targetRoleFields.map(f => f.id));

  // Count response states for target role fields only
  let targetAnswered = 0;
  let targetSkipped = 0;
  let targetAborted = 0;
  let targetTotal = 0;

  for (const field of targetRoleFields) {
    targetTotal++;
    const response = form.responsesByFieldId[field.id];
    const state = response?.state ?? 'empty';

    if (state === 'answered') targetAnswered++;
    else if (state === 'skipped') targetSkipped++;
    else if (state === 'aborted') targetAborted++;
  }

  // Completion checks
  const allFieldsAccountedFor = (targetAnswered + targetSkipped) === targetTotal;
  const noAbortedFields = targetAborted === 0;
  const noRequiredIssues = !validationIssues.some(
    i => i.severity === 'required' && targetFieldIds.has(i.ref)
  );

  // Completion formula: all fields answered or skipped, no aborted, no required issues
  const isComplete = allFieldsAccountedFor && noAbortedFields && noRequiredIssues;

  // Form state computation (centralized logic)
  const formState = computeFormState(progressSummary, targetAborted);

  return {
    structureSummary,
    progressSummary,
    issues: validationIssues,
    isComplete,
    formState,
  };
}

/**
 * Centralized form state computation.
 * Called from inspect() and also used for frontmatter serialization.
 */
function computeFormState(
  progress: ProgressSummary,
  abortedCount: number = progress.counts.abortedFields
): ProgressState {
  // Aborted fields = failure state
  if (abortedCount > 0) {
    return 'invalid';
  }

  // Validation errors = invalid
  if (progress.counts.invalidFields > 0) {
    return 'invalid';
  }

  // Not all fields accounted for = incomplete
  const allAccountedFor =
    (progress.counts.answeredFields + progress.counts.skippedFields) ===
    progress.counts.totalFields;

  if (!allAccountedFor || progress.counts.emptyRequiredFields > 0) {
    return 'incomplete';
  }

  return 'complete';
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

### 1. Response State Type (new, before FieldValue)

Add response state as a new concept orthogonal to field types:

```ts
/**
 * Response state for a field.
 * Orthogonal to field type — any field can be in any response state.
 */
type ResponseState = 'empty' | 'answered' | 'skipped' | 'aborted';

/**
 * Field response: combines response state with optional value.
 */
interface FieldResponse {
  state: ResponseState;
  value?: FieldValue;  // present only when state === 'answered'
}
```

### 2. FieldValue Union (unchanged)

FieldValue remains unchanged — `kind` is strictly for field types:

```ts
type FieldValue =
  | { kind: 'string'; value: string | null }
  | { kind: 'number'; value: number | null }
  | { kind: 'string_list'; items: string[] }
  | { kind: 'checkboxes'; values: Record<OptionId, CheckboxValue> }
  | { kind: 'single_select'; selected: OptionId | null }
  | { kind: 'multi_select'; selected: OptionId[] }
  | { kind: 'url'; value: string | null }
  | { kind: 'url_list'; items: string[] };
```

**Design rationale:** Keeping `kind` strictly for field types ensures:

- Switch statements on `value.kind` handle all field types without sentinel branches

- Exhaustiveness checks in TypeScript work correctly

- Field-type logic is cleanly separated from response-state logic

### 3. Note Type (new section after DocumentationBlock)

```ts
/** Unique note ID (implementation detail: format may vary) */
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

### 4. ParsedForm (around line ~860)

Replace `valuesByFieldId` and `skipsByFieldId` with unified `responsesByFieldId`:

```ts
interface ParsedForm {
  schema: FormSchema;
  responsesByFieldId: Record<Id, FieldResponse>;  // state + optional value
  notes: Note[];              // NEW: agent notes (replaces skipsByFieldId)
  docs: DocumentationBlock[];
  orderIndex: Id[];
  idIndex: Map<Id, IdIndexEntry>;
}
```

### 5. Patch Schema (around line ~1760)

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
  | { op: 'skip_field'; fieldId: Id; role: string; reason?: string }  // updated: role required
  | { op: 'abort_field'; fieldId: Id; role: string; reason?: string } // NEW
  | { op: 'add_note'; ref: Id; role: string; text: string; state?: 'skipped' | 'aborted' }  // NEW
  | { op: 'remove_note'; noteId: NoteId }                              // NEW
  | { op: 'remove_notes'; ref: Id; role: string };                     // NEW
```

### 6. Patch Semantics (around line ~1789)

Update documentation:

```markdown
**Response state patches:**

- `skip_field`: Set field response to `{ state: 'skipped' }`.
  - Can only be applied to optional fields (required fields reject with error)
  - `role` is required (identifies who skipped)
  - If `reason` provided, also adds a note with `state="skipped"`

- `abort_field`: Set field response to `{ state: 'aborted' }`.
  - Can be applied to any field (indicates agent failure)
  - `role` is required (identifies who aborted)
  - If `reason` provided, also adds a note with `state="aborted"`
  - Aborted fields block form completion

**Note patches:**

- `add_note`: Add a note to the form.
  - `ref` must be a valid field, group, or form ID
  - `role` is required (identifies who created the note)
  - `state` optionally links the note to a skip/abort action

- `remove_note`: Remove a specific note by ID.
  - Returns error if note ID not found

- `remove_notes`: Remove all notes for a given ref + role combination.
  - Returns count of notes removed
```

### 7. Serialization: Field State Attribute (markform format)

```markdown
#### Field State Attribute

Fields support a `state` attribute to indicate response status:

| State | Meaning | When Valid |
|-------|---------|------------|
| `empty` | No response yet (default for unfilled) | Unfilled field |
| `answered` | Has a value (default for filled) | Filled field |
| `skipped` | Explicitly skipped | Unfilled optional field only |
| `aborted` | Agent couldn't provide value | Unfilled field only |

**Validation rules:**

- `state="skipped"` or `state="aborted"` on a filled field → validation error
- `state="skipped"` on a required field → validation error
- `state` attribute on field-group → validation error (only valid on fields)

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

#### Value Export Formats

**Structured export (default for JSON and YAML):**

\`\`\`json
{
  "company_name": { "state": "skipped" },
  "revenue_m": { "state": "aborted" },
  "quarterly_growth": { "state": "answered", "value": 12.5 }
}
\`\`\`

**Friendly YAML export (optional, with `--friendly` flag):**

\`\`\`yaml
company_name: "|SKIP|"
revenue_m: "|ABORT|"
quarterly_growth: 12.5
\`\`\`

The friendly format uses sentinel strings for human readability but should not be
used for machine interchange (since a field could legitimately have the value `"|SKIP|"`).
```

### 8. Serialization: Note Tags (new section)

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

- `id` (required): Unique note identifier (format is implementation-defined)
- `ref` (required): ID of target element (field, group, or form)
- `role` (required): Who created the note (e.g., 'agent', 'user')
- `state` (optional): `"skipped"` or `"aborted"` to link note to action

**Placement rules:**

- Notes appear at the end of the form, before `{% /form %}`
- Notes serialize in deterministic order (implementation sorts by ID)
- Multiple notes can reference the same target
```

### 9. ProgressCounts (around line ~1069)

Update counts:

```ts
interface ProgressCounts {
  totalFields: number;
  requiredFields: number;

  // Response state counts (mutually exclusive, sum to totalFields)
  answeredFields: number;        // fields with state === 'answered'
  skippedFields: number;         // fields with state === 'skipped'
  abortedFields: number;         // fields with state === 'aborted'
  emptyFields: number;           // fields with state === 'empty'

  // Note count
  totalNotes: number;

  // Validation counts (unchanged)
  completeFields: number;
  incompleteFields: number;
  invalidFields: number;
  emptyRequiredFields: number;
  emptyOptionalFields: number;
}
```

### 10. FieldProgress (around line ~1026)

Update fields:

```ts
interface FieldProgress {
  kind: FieldKind;
  required: boolean;
  responseState: ResponseState;  // replaces 'submitted' boolean
  hasNotes: boolean;
  noteCount: number;
  state: ProgressState;
  valid: boolean;
  issueCount: number;
  checkboxProgress?: CheckboxProgressCounts;
}
```

### 11. Completion Definition (around line ~1721)

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
- Empty optional fields don't block completion if all required fields are answered
```

### 12. Form State Computation (around line ~1074)

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

**Invariant:** Form state is computed from ProgressCounts and is the same whether
computed during inspect(), apply(), or serialize(). Centralize in one function.
```

### 13. Design Decisions (around line ~2809)

Add new decision:

```markdown
XX. **Unified response model with notes** — The form response model separates response
    state (`empty`/`answered`/`skipped`/`aborted`) from field values. FieldValue.kind
    remains strictly for field types—no sentinel kinds. Each field has a FieldResponse
    with `state` and optional `value` (present only when `state === 'answered'`).

    Reasons and observations are stored as Notes, a general-purpose mechanism for
    attaching text to any form element. The `skip_field` and `abort_field` patches with
    reasons set the response state + add a note. Notes serialize at the end of the form
    in `{% note %}` tags. Aborted fields block form completion.

    This design keeps field-type discrimination clean (no sentinel branches in switch
    statements) while providing explicit response tracking.
```

## Open Questions

### Resolved

1. **Where do notes serialize?**

   - **Decision:** At end of form, before `{% /form %}`

2. **How are notes sorted?**

   - **Decision:** Deterministic order; implementation uses numeric suffix sort (n1, n2,
     n10) which preserves insertion order when IDs are generated sequentially

3. **Can notes be deleted?**

   - **Decision:** Yes, via `remove_note(noteId)` or `remove_notes(ref, role)`

4. **Do notes have unique IDs?**

   - **Decision:** Yes. The ID format is an implementation detail (reference uses n1, n2,
     n3; other implementations may use ULIDs, UUIDs, etc.)

5. **Do notes track who created them?**

   - **Decision:** Yes, `role` attribute is required (e.g., ‘agent’, ‘user’)

6. **Is the library thread-safe?**

   - **Decision:** The library handles concurrent async operations within a single
     process (JavaScript event loop provides this naturally).
     Multi-process access to the same form file requires external coordination (file
     locks, etc.) and is out of scope for the library.

7. **What happens to notes when setting a value on a skipped/aborted field?**

   - **Decision:** Notes with matching `state` are auto-removed; general notes preserved

8. **Can agents add notes without skip/abort?**

   - **Decision:** Yes, via `add_note` patch without state attribute

9. **Should dump/export include notes?**

   - **Decision:** Yes, notes are included in all output formats (JSON, YAML, etc.)

10. **Should sentinel kinds be added to FieldValue?**

    - **Decision:** No. Response state is orthogonal to field type.
      Use a FieldResponse wrapper with `state` and optional `value` instead of adding
      `'skipped'`/`'aborted'` to `FieldValue.kind`. This keeps field-type discrimination
      clean.

11. **How should JSON/YAML export represent response states?**

    - **Decision:** Default to structured format (`{ state: 'skipped' }`) for machine
      interchange. Optional friendly format with sentinel strings (`"|SKIP|"`) for human
      readability, enabled with `--friendly` flag.

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
| 2025-12-25 | Claude | **Major revision:** Replaced sentinel kinds with FieldResponse wrapper (state + optional value); kept FieldValue.kind strictly for field types |
| 2025-12-25 | Claude | Categorized select fields under 'checkboxes' syntax (they use [ ]/[x] markers like checkboxes) |
| 2025-12-25 | Claude | Clarified note ID format is implementation detail (n1, n2, n3 not required by spec) |
| 2025-12-25 | Claude | Clarified concurrency: library handles async within single process; multi-process is out of scope |
| 2025-12-25 | Claude | Changed JSON/YAML export to structured format by default; friendly sentinel format is optional |
| 2025-12-25 | Claude | Added explicit validation rule: state="skipped" on required field is an error |
| 2025-12-25 | Claude | Removed deprecated 'submitted'/'submittedFields' terminology; use responseState counts only |
