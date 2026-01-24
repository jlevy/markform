<!--
SPDX-License-Identifier: CC-BY-4.0

Markform Specification - Licensed under Creative Commons Attribution 4.0 International
https://creativecommons.org/licenses/by/4.0/

You may freely implement this specification in your own software under any license.
The reference implementation at https://github.com/jlevy/markform is separately
licensed under AGPL-3.0-or-later. Contact the author for commercial licensing options.
-->

# Markform Specification

**Version:** MF/0.1 (draft)

## Overview

Markform is a format, data model, and editing API for agent-friendly, human-readable
text forms. The format is a superset of Markdown based on
[Markdoc](https://github.com/markdoc/markdoc) that is easily readable by agents and
humans.

Key design principles:

- **Form content, structure, and field values in one text file** for better context
  engineering

- **Incremental filling** where agents or humans can iterate until the form is complete

- **Flexible validation** at multiple scopes (field/group/form), including declarative
  constraints and external hook validators

This specification defines the portable, language-agnostic elements of Markform:

- **Layer 1: Syntax** — The `.form.md` file format

- **Layer 2: Form Data Model** — Precise data structures for forms, fields, and values

- **Layer 3: Validation & Form Filling** — Rules for validation and form manipulation

- **Layer 4: Tool API & Interfaces** — Operations for agents and humans to interact with
  forms

## Revision History

| Version | Date | Code Version | Summary |
| --- | --- | --- | --- |
| MF/0.1 (draft) | 2025-12-27 | v0.1.2 | Initial draft. Defines core syntax, data model, validation pipeline, and tool API. |

## Specification Terminology

The keywords MUST, MUST NOT, REQUIRED, SHALL, SHOULD, SHOULD NOT, RECOMMENDED, MAY, and
OPTIONAL are to be interpreted as described in
[RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

In this specification we use these keywords:

| Term | Definition |
| --- | --- |
| *required* | A constraint that MUST be satisfied. Enforced by engine validation; violations produce errors. |
| *recommended* | A convention that SHOULD be followed for consistency and best practices. Not enforced by the engine; violations do not produce errors. |

### Markform Terminology

**Form concepts:**

| Term | Definition |
| --- | --- |
| **Field** | A single data entry point within a form. Fields have a kind (type), label, and optional constraints. |
| **Kind** | The type of a field. One of: `string`, `number`, `string_list`, `checkboxes`, `single_select`, `multi_select`, `url`, `url_list`. Determines the field's value structure, input behavior, and validation rules. |
| **Field group** | A container that organizes related fields together. Groups have an id, optional title, and may have custom validators. Currently (MF/0.1), groups contain only fields (they are not nested groups). |
| **Template form** | A form with no values filled in (schema only). Starting point for filling. |
| **Incomplete form** | A form with some values but not yet complete or valid. |
| **Completed form** | A form with all required fields filled and passing validation. |

**Checkbox modes:**

| Term | Definition |
| --- | --- |
| **Simple checkbox** | Checkbox mode with 2 states: `todo` and `done`. GFM-compatible. |
| **Multi checkbox** | Checkbox mode with 5 states: `todo`, `done`, `incomplete`, `active`, `na`. Default mode. |
| **Explicit checkbox** | Checkbox mode requiring explicit `yes`/`no` answer for each option. No implicit "unchecked = no". |

**Field state concepts:**

| Term | Definition |
| --- | --- |
| **AnswerState** | The action taken on a field: `unanswered` (no action), `answered` (has value), `skipped` (explicitly bypassed), `aborted` (explicitly abandoned). |
| **ProgressState** | Form-level completion status: `empty`, `incomplete`, `invalid`, `complete`. |
| **ProgressCounts** | Rollup counts with three orthogonal dimensions: AnswerState (unanswered/answered/skipped/aborted), Validity (valid/invalid), Value presence (empty/filled). |
| **FieldProgress** | Per-field progress info including `answerState`, `valid`, `empty`, and optional `checkboxProgress`. |

**Execution concepts:**

| Term | Definition |
| --- | --- |
| **Harness loop** | The execution wrapper that manages step-by-step form filling, tracking state and suggesting next actions. Also called just "harness" or "loop" — these refer to the same component. |
| **Session** | A single execution run from template form to completed form (or abandonment). |
| **Turn** | One iteration of the harness loop: inspect → recommend → apply patches → validate. |
| **Patch** | A single atomic change operation applied to form values (e.g., setting a string field, toggling checkboxes). |

**Testing and files:**

| Term | Definition |
| --- | --- |
| **Session transcript** | YAML serialization of a session's turns for golden testing (`.session.yaml`). |
| **Completed mock** | A pre-filled completed form file used in mock mode to provide deterministic "correct" values for testing. |
| **Sidecar file** | A companion file with the same basename but different extension (e.g., `X.form.md` → `X.valid.ts`). |

* * *

## Layer 1: Syntax

Defines the **Markform document format** (`.form.md`) containing the form schema and
current filled-in state.
Built on [Markdoc’s tag syntax specification][markdoc-spec] and
[syntax conventions][markdoc-syntax].

#### File Format

- **Extension:** `.form.md` (*required*)

- **Frontmatter:** (*required*) YAML with a top-level `markform` object containing
  version and derived metadata (see [Markdoc Frontmatter][markdoc-frontmatter]).

**Frontmatter structure (MF/0.1):**

```yaml
---
markform:
  spec: MF/0.1
  run_mode: research       # optional: interactive | fill | research
  form_summary: { ... }    # derived: structure summary
  form_progress: { ... }   # derived: progress summary
  form_state: complete|incomplete|invalid|empty   # derived: overall progress state
---
```

**Optional metadata fields:**

- `run_mode` (*recommended*): Suggests how CLI tools should execute this form.
  Values: `interactive` (user fills via prompts), `fill` (agent fills), or `research`
  (agent fills with web search).
  When omitted, tools may infer from field roles or require explicit selection.
  This is a hint for tooling, not enforced by the engine.

**Behavioral rules (*required*):**

- *required:* `form_summary`, `form_progress`, and `form_state` are derived,
  engine-owned metadata

- *required:* The engine recomputes and overwrites these on every serialize/canonicalize

- *required:* They are not authoritative—the source of truth is the body schema + values

- *required:* On parse, existing `form_summary`/`form_progress`/`form_state` values are
  ignored; fresh summaries are computed from the parsed body

See [StructureSummary and ProgressSummary](#structuresummary-and-progresssummary) in the
Data Model section for complete type definitions.

#### ID Conventions

IDs are organized into **two scoping levels** with different uniqueness requirements:

**1. Structural IDs** (form, group, field):

- *required:* Must be globally unique across the entire document

- *required:* Enforced by engine validation at parse time (duplicate = error)

- *recommended:* Use `snake_case` (e.g., `company_info`, `revenue_m`)

**2. Option IDs** (within single-select, multi-select, checkboxes):

- *required:* Must be unique within the containing field (field-scoped)

- *required:* Enforced by engine validation at parse time

- *recommended:* Use a slugified version of the option label (e.g., `ten_k`, `bullish`)

- Use [Markdoc’s annotation shorthand][markdoc-attributes] `{% #my_id %}` after list
  items

- This allows reusing common option patterns across multiple fields without renaming
  (e.g., `[ ] 10-K {% #ten_k %}` can appear in multiple checkbox fields)

- When referencing an option externally (patches, doc blocks), use qualified form:
  `{fieldId}.{optionId}` (e.g., `docs_reviewed.ten_k`)

**Markdoc compatibility:** Markdoc’s `{% #id %}` shorthand simply sets an `id` attribute
on the element—Markdoc itself does not enforce uniqueness (see [Markdoc Attributes]).
Markform defines its own scoping rules where option IDs are field-scoped.

**3. Documentation blocks:**

- Doc blocks do not have their own IDs

- *required:* Identified by `(ref, tag)` combination, which must be unique (e.g., only
  one `{% instructions ref="foo" %}` allowed)

- Duplicate `(ref, tag)` pairs are an error

- Multiple doc blocks can reference the same target with different tags (e.g., both `{%
  description ref="foo" %}` and `{% instructions ref="foo" %}` are allowed)

- To reference an option, use qualified form: `ref="{fieldId}.{optionId}"`

**General conventions (*recommended*, not enforced):**

- IDs use `snake_case` (e.g., `company_info`, `ten_k`)

- The `field` tag uses a `kind` attribute to specify the field kind

#### Structural Tags

- `form` — the root container

- `group` — containers for fields or nested groups

#### Field Tags

Custom tags are defined following [Markdoc tag conventions][markdoc-tags]. See
[Markdoc Config][markdoc-config] for how to register custom tags.

All fields use the unified `{% field kind="..." %}` syntax.
The `kind` attribute identifies what type of field a `Field` or `FieldValue` represents.
(In TypeScript, the type is `FieldKind`.)

| Kind | Description |
| --- | --- |
| `string` | String value; optional `required`, `pattern`, `minLength`, `maxLength` |
| `number` | Numeric value; optional `min`, `max`, `integer` |
| `date` | ISO 8601 date (YYYY-MM-DD); optional `min`, `max` date constraints |
| `year` | Integer year; optional `min`, `max` year constraints |
| `string_list` | Array of strings (open-ended list); supports `minItems`, `maxItems`, `itemMinLength`, `itemMaxLength`, `uniqueItems` |
| `single_select` | Select one option from enumerated list |
| `multi_select` | Select multiple options; supports `minSelections`, `maxSelections` constraints |
| `checkboxes` | Stateful checklist; supports `checkboxMode` with values `multi` (5 states), `simple` (2 states), or `explicit` (yes/no); optional `minDone` for completion threshold |
| `url` | Single URL value with built-in format validation |
| `url_list` | Array of URLs (for citations, sources, references); supports `minItems`, `maxItems`, `uniqueItems` |
| `table` | Structured tabular data with typed columns; supports `columnIds`, `columnLabels`, `columnTypes`, `minRows`, `maxRows` |

**Syntax:** `{% field kind="<kind>" id="..." label="..." %}...{% /field %}`

**Note on `pattern`:** The `pattern` attribute accepts a JavaScript-compatible regular
expression string (without delimiters).
Example: `pattern="^[A-Z]{1,5}$"` for a ticker symbol.

**Common attributes (all field kinds):**

| Attribute | Type | Description |
| --- | --- | --- |
| `id` | string | Required. Unique identifier (snake_case) |
| `label` | string | Required. Human-readable field name |
| `required` | boolean | Whether field must be filled for form completion |
| `role` | string | Target actor (e.g., `"user"`, `"agent"`). See role-filtered completion |

The `role` attribute enables multi-actor workflows where different fields are assigned
to different actors.

**Text-entry field attributes (string, number, string-list, url, url-list only):**

| Attribute | Type | Description |
| --- | --- | --- |
| `placeholder` | string | Hint text shown in empty fields (displayed in UI) |
| `examples` | string[] | Example values for the field (helps LLMs, shown in prompts) |

These attributes are only valid on text-entry field kinds.
Using them on chooser fields (single-select, multi-select, checkboxes) will result in a
parse error.

**Nesting constraints:**
- Field tags MUST NOT be nested inside other field tags
- Nested field tags produce a parse error:
  `Field tags cannot be nested. Found 'inner_id' inside 'outer_id'`

**Example with placeholder and examples:**
```md
{% field kind="string" id="company_name" label="Company name" placeholder="Enter company name" examples=["ACME Corp", "Globex Inc"] %}{% /field %}
```

For number fields, examples must be valid numbers:
```md
{% field kind="number" id="revenue" label="Revenue (USD)" placeholder="1000000" examples=["500000", "1000000", "5000000"] %}{% /field %}
```

For URL fields, examples must be valid URLs:
```md
{% field kind="url" id="website" label="Website" placeholder="https://example.com" examples=["https://example.com", "https://github.com"] %}{% /field %}
```

When running the fill harness with `targetRoles`, only fields matching those roles are
considered for completion.
See **Role-filtered completion** in the ProgressState Definitions section.

#### Option Syntax (Markform-specific)

Markdoc does **not** natively support GFM-style task list checkbox syntax.
The `[ ]` and `[x]` markers are **Markform-specific syntax** parsed within tag content.

All selection field kinds use checkbox-style markers for broad markdown renderer
compatibility:

| Field Kind | Marker | Meaning | Example |
| --- | --- | --- | --- |
| `checkboxes` | `[ ]` | Unchecked / todo / unfilled | `- [ ] Item {% #item_id %}` |
| `checkboxes` | `[x]` | Checked / done | `- [x] Item {% #item_id %}` |
| `checkboxes` | `[/]` | Incomplete (multi only) | `- [/] Item {% #item_id %}` |
| `checkboxes` | `[*]` | Active (multi only) | `- [*] Item {% #item_id %}` |
| `checkboxes` | `[-]` | Not applicable (multi only) | `- [-] Item {% #item_id %}` |
| `checkboxes` | `[y]` | Yes (explicit only) | `- [y] Item {% #item_id %}` |
| `checkboxes` | `[n]` | No (explicit only) | `- [n] Item {% #item_id %}` |
| `single_select` | `[ ]` | Unselected | `- [ ] Option {% #opt_id %}` |
| `single_select` | `[x]` | Selected (exactly one) | `- [x] Option {% #opt_id %}` |
| `multi_select` | `[ ]` | Unselected | `- [ ] Option {% #opt_id %}` |
| `multi_select` | `[x]` | Selected | `- [x] Option {% #opt_id %}` |

**Note:** `single_select` enforces that exactly one option has `[x]`. The distinction
between `single_select` and `multi_select` is in the `kind` attribute, not the marker
syntax.

The `{% #id %}` annotation **is** native Markdoc syntax (see
[Attributes][markdoc-attributes]).

**Implementation note:** Markform’s parser extracts list items from the tag’s children,
then applies regex matching to detect markers.
This is custom parsing layered on top of Markdoc’s AST traversal.

#### Checkbox State Tokens

Markform supports three checkbox modes:

**`checkboxMode="multi"`** (default) — 5 states for rich workflow tracking:

| Token | State | Notes |
| --- | --- | --- |
| `[ ]` | todo | Not started. Standard GFM ([spec][gfm-tasklists], [GitHub docs][github-tasklists]) |
| `[x]` | done | Completed. Standard GFM |
| `[/]` | incomplete | Work started but not finished. Obsidian convention ([discussion][obsidian-tasks-discussion]) |
| `[*]` | active | Currently being worked on (current focus). Useful for agents to indicate which step they're executing |
| `[-]` | na | Not applicable / skipped. Obsidian convention ([guide][obsidian-tasks-guide]) |

**`checkboxMode="simple"`** — 2 states for GFM compatibility:

| Token | State | Notes |
| --- | --- | --- |
| `[ ]` | todo | Unchecked |
| `[x]` | done | Checked |

**`checkboxMode="explicit"`** — Requires explicit yes/no answer (no implicit “unchecked
= no”):

| Token | Value | Notes |
| --- | --- | --- |
| `[ ]` | unfilled | Not yet answered (invalid if required) |
| `[y]` | yes | Explicit affirmative |
| `[n]` | no | Explicit negative |

Use `checkboxMode` attribute to select mode:

- `checkboxMode="multi"` (default) — 5 states for workflow tracking

- `checkboxMode="simple"` — 2 states for GFM compatibility; use `minDone` to control
  completion threshold

- `checkboxMode="explicit"` — Requires explicit yes/no, validates all options answered

**The `minDone` attribute (for `simple` mode):**

Controls how many options must be `done` for a required checkbox field to be complete.
Type: `integer`, default: `-1` (require all).

- **`minDone=-1` (default):** All options must be `done` (strict completion)

- **`minDone=0`:** No minimum; any state is valid (effectively optional even when
  `required`)

- **`minDone=1`:** At least one option must be `done`

- **`minDone=N`:** At least N options must be `done`

Example with partial completion allowed:
```md
{% field kind="checkboxes" id="optional_tasks" label="Optional tasks" required=true minDone=1 %}
- [ ] Task A {% #task_a %}
- [ ] Task B {% #task_b %}
- [ ] Task C {% #task_c %}
{% /field %}
```

**Note:** `minDone` only applies to `simple` mode.
For `multi` mode, completion requires all options in terminal states (`done` or `na`).
For `explicit` mode, all options must have explicit `yes` or `no` answers.

**Checkbox mode and `required` attribute:**

Fields with `checkboxMode="explicit"` are inherently required—every option must receive
an explicit `yes` or `no` answer.
The parser enforces this:

- Omitting `required` → defaults to `true`

- Setting `required=true` → redundant but valid

- Setting `required=false` → **parse error** (explicit mode cannot be optional)

| Checkbox Mode | `required` Effect |
| --- | --- |
| `simple` | Optional by default; when required, `minDone` threshold must be met |
| `multi` | Optional by default; when required, all options in terminal state (`done`/`na`) |
| `explicit` | Always required (enforced by parser; `required=false` is an error) |

**Distinction between `incomplete` and `active`:**

- `incomplete` (`[/]`): Work has started on this item (may be paused)

- `active` (`[*]`): This item is the current focus right now (useful for showing where
  an agent is in a multi-step workflow)

#### Table Fields

Table fields enable structured tabular data collection with typed columns.
They use standard markdown table syntax for values and support validation per column
type.

**Table field attributes:**

| Attribute | Type | Required | Description |
| --- | --- | --- | --- |
| `columnIds` | string[] | Yes | Array of snake_case column identifiers |
| `columnLabels` | string[] | No | Array of display labels (backfilled from table header row if omitted) |
| `columnTypes` | string[] | No | Array of column types (defaults to all `'string'`) |
| `minRows` | number | No | Minimum row count (default: 0) |
| `maxRows` | number | No | Maximum row count (default: unlimited) |

**Column types and validation:**

| Type | Description | Validation |
| --- | --- | --- |
| `string` | Any text value | None |
| `number` | Numeric value | Integer or float |
| `url` | URL value | Valid URL format |
| `date` | Date value | ISO 8601 format (YYYY-MM-DD) |
| `year` | Year value | Integer (1000-9999) |

**Per-column required setting:** Column types can optionally specify a `required` flag:
```md
columnTypes=[{type: "string", required: true}, "number", "url"]
```

**Basic table-field (columnLabels backfilled from header row):**
```md
{% field kind="table" id="team" label="Team Members"
   columnIds=["name", "title", "department"] %}
| Name | Title | Department |
|------|-------|------------|
{% /field %}
```

**Explicit column labels (when different from header row):**
```md
{% field kind="table" id="team" label="Team Members"
   columnIds=["name", "title", "department"]
   columnLabels=["Full Name", "Job Title", "Department"]
   columnTypes=["string", "string", "string"] %}
| Full Name | Job Title | Department |
|-----------|-----------|------------|
{% /field %}
```

**Complete example with types and data:**
```md
{% field kind="table" id="films" label="Notable Films" required=true
   columnIds=["release_year", "title", "rt_score", "box_office_m"]
   columnLabels=["Year", "Title", "RT Score", "Box Office ($M)"]
   columnTypes=["year", "string", "number", "number"]
   minRows=1 maxRows=10 %}
| Year | Title | RT Score | Box Office ($M) |
|------|-------|----------|-----------------|
| 2023 | Barbie | 88 | 1441.8 |
| 2019 | Once Upon a Time in Hollywood | 85 | 374.3 |
{% /field %}
```

**Sentinel values in table cells:** Cells can use `%SKIP%` and `%ABORT%` sentinels with
optional reasons:
```md
| 2017 | I, Tonya | 90 | %SKIP% (Box office not tracked) |
```

**Cell escaping:** Use `\|` for literal pipe characters in cell values.

#### Documentation Blocks

Documentation blocks provide contextual help attached to form elements and each has its
own tag:

```md
{% description ref="<target_id>" %}
Markdown content here...
{% /description %}

{% instructions ref="<target_id>" %}
Step-by-step guidance...
{% /instructions %}

{% notes ref="<target_id>" %}
Additional notes...
{% /notes %}

{% examples ref="<target_id>" %}
Example values or usage...
{% /examples %}
```

- `ref` (*required*): References the ID of a form, group, field, or option

- The Markdoc tag name determines the documentation `tag` property (`description`,
  `instructions`, `notes`, `examples`, or `documentation` for general content)

**Placement rules (MF/0.1):**

- Doc blocks MAY appear inside `form` and `group` as direct children

- *required:* Parser will reject doc blocks that appear inside field tag bodies (doc
  blocks MUST NOT be nested inside a field tag)

- For field-level docs: place immediately after the field block (as a sibling within the
  group)

- Canonical serialization places doc blocks immediately after the referenced element

This keeps parsing simple: field value extraction only needs to find the `value` fence
without filtering out nested doc blocks.

**Identification:**

- Doc blocks do not have their own IDs

- *required:* `(ref, tag)` combination must be unique (e.g., only one `{% instructions
  ref="foo" %}`)

- Multiple doc blocks with different tags can reference the same target (e.g., both `{%
  description ref="foo" %}` and `{% instructions ref="foo" %}` are allowed)

#### Field Values

Values are encoded differently based on field kind.
The `fence` node with `language="value"` is used for scalar values (see
[Markdoc Nodes][markdoc-nodes] for fence handling).

##### String Fields

**Empty:** Omit the body entirely:
```md
{% field kind="string" id="company_name" label="Company name" required=true %}{% /field %}
```

**Filled:** Value in a fenced code block with language `value`:
````md
{% field kind="string" id="company_name" label="Company name" required=true %}
```value
ACME Corp
````
{% /field %}
````

##### Number Fields

**Empty:**
```md
{% field kind="number" id="revenue_m" label="Revenue (millions)" %}{% /field %}
````

**Filled:** Numeric value as string in fence (parsed to number):
````md
{% field kind="number" id="revenue_m" label="Revenue (millions)" %}
```value
1234.56
````
{% /field %}
````

##### Single-Select Fields

Values are encoded **inline** via `[x]` marker—at most one option may be selected (if
`required=true`, exactly one must be selected):
```md
{% field kind="single_select" id="rating" label="Rating" %}
- [ ] Bullish {% #bullish %}
- [x] Neutral {% #neutral %}
- [ ] Bearish {% #bearish %}
{% /field %}
````

Option IDs are scoped to the field—reference as `rating.bullish`, `rating.neutral`, etc.

##### Multi-Select Fields

Values are encoded **inline** via `[x]` markers—no separate value fence:
```md
{% field kind="multi_select" id="categories" label="Categories" %}
- [x] Technology {% #tech %}
- [ ] Healthcare {% #health %}
- [x] Finance {% #finance %}
{% /field %}
```

##### Checkboxes Fields

Values are encoded **inline** via state markers—no separate value fence:
```md
{% field kind="checkboxes" id="tasks" label="Tasks" %}
- [x] Review docs {% #review %}
- [/] Write tests {% #tests %}
- [*] Run CI {% #ci %}
- [ ] Deploy {% #deploy %}
- [-] Manual QA {% #manual_qa %}
{% /field %}
```

For simple two-state checkboxes:
```md
{% field kind="checkboxes" id="agreements" label="Agreements" checkboxMode="simple" %}
- [x] I agree to terms {% #terms %}
- [ ] Subscribe to newsletter {% #newsletter %}
{% /field %}
```

For explicit yes/no checkboxes (requires answer for each):
```md
{% field kind="checkboxes" id="risk_factors" label="Risk Assessment" checkboxMode="explicit" required=true %}
- [y] Market volatility risk assessed {% #market %}
- [n] Regulatory risk assessed {% #regulatory %}
- [ ] Currency risk assessed {% #currency %}
{% /field %}
```

In this example, `risk_factors.currency` is unfilled (`[ ]`) and will fail validation
because `checkboxMode="explicit"` requires all options to have explicit `[y]` or `[n]`
answers.

##### Implicit Checkboxes (Plan Documents)

Forms designed as task lists or plans can omit explicit field wrappers. When a form
contains:
- A `{% form %}` wrapper (or `<!-- form ... -->`)
- No explicit `{% field %}` tags
- Standard markdown checkboxes with ID annotations

The parser automatically creates an implicit checkboxes field:

| Property | Value |
| --- | --- |
| ID | `_checkboxes` (reserved) |
| Label | `Checkboxes` |
| Mode | `multi` (always) |
| Options | All checkboxes in document order |
| Implicit | `true` |

**Example:**
```md
---
markform:
  spec: MF/0.1
---
{% form id="plan" title="Project Plan" %}

## Phase 1: Research
- [ ] Literature review {% #lit_review %}
- [ ] Competitive analysis {% #comp %}

## Phase 2: Design
- [x] Architecture doc {% #arch %}
- [/] API design {% #api %}

{% /form %}
```

The above form parses to a schema with a single implicit checkboxes field containing
four options: `lit_review`, `comp`, `arch`, and `api`.

**Requirements:**
- Each checkbox MUST have an ID annotation (`{% #id %}` or `<!-- #id -->`)
- ID `_checkboxes` is reserved and MUST NOT be used for explicit fields
- Nested checkboxes (indented list items) are collected as separate options

**Error conditions:**
- Checkbox without ID annotation: `Option in implicit field '_checkboxes' missing ID annotation`
- Mixed mode (explicit fields AND checkboxes outside fields): Parse error
- Explicit field with ID `_checkboxes`: Parse error (reserved ID)

##### String-List Fields

String-list fields represent open-ended arrays of user-provided strings.
Items do not have individual IDs—the field has an ID and items are positional strings.

**Empty:**
```md
{% field kind="string_list" id="key_commitments" label="Key commitments" minItems=1 %}{% /field %}
```

**Filled:** One item per non-empty line in the value fence:
````md
{% field kind="string_list" id="key_commitments" label="Key commitments" minItems=1 %}
```value
Ship v1.0 by end of Q1
Complete security audit
Migrate legacy users to new platform
````
{% /field %}
````

**Parsing rules:**
- Split fence content by `\n`
- For each line: trim leading/trailing whitespace, ignore empty lines
- Result is `string[]`

**Serialization rules (canonical):**
- Emit one item per line (no bullets)
- Use `process=false` only if any item contains Markdoc syntax
- Empty arrays serialize as empty tag (no value fence)

**Example with constraints:**
```md
{% string-list
  id="top_risks"
  label="Top 5 risks (specific, not generic)"
  required=true
  minItems=5
  itemMinLength=10
%}
```value
Supply chain disruption from single-source vendor
Key engineer departure risk (bus factor = 1)
Regulatory changes in EU market
Competitor launching similar feature in Q2
Customer concentration risk (top 3 = 60% revenue)
````
{% /field %}

{% instructions ref="top_risks" %} One risk per line.
Be specific (company- or product-specific), not generic.
Minimum 5; include more if needed.
{% /instructions %}
````

**Note:** The doc block is a sibling placed after the field, not nested inside it.

##### Field State Attributes

Fields can have a `state` attribute to indicate skip or abort status. The attribute is
serialized on the opening tag:

**Skipped field (no reason):**
```md
{% field kind="string" id="optional_notes" label="Optional notes" state="skipped" %}{% /field %}
````

**Aborted field (no reason):**
```md
{% field kind="string" id="company_name" label="Company name" required=true state="aborted" %}{% /field %}
```

**State attribute values:**

- `state="skipped"`: Field was explicitly skipped via `skip_field` patch

- `state="aborted"`: Field was explicitly aborted via `abort_field` patch

**Serialization with sentinel values and reasons (markform-254):**

When a field has a skip or abort state AND a reason was provided via the patch, the
reason is embedded in the sentinel value using parentheses:

````md
{% field kind="string" id="competitor_analysis" label="Competitor analysis" state="skipped" %}
```value
%SKIP% (Information not publicly available)
````
{% /field %}
````

```md
{% field kind="number" id="projected_revenue" label="Projected revenue" state="aborted" %}
```value
%ABORT% (Financial projections cannot be determined from available data)
````
{% /field %}
````

**Parsing rules:**
- If `state="skipped"` is present, field's responseState is `'skipped'`
- If `state="aborted"` is present, field's responseState is `'aborted'`
- Otherwise, responseState is determined by value presence (`'answered'` or `'empty'`)
- Sentinel values (`%SKIP%` or `%ABORT%`) are parsed as metadata, not field values
- Text in parentheses after sentinel is extracted as `FieldResponse.reason`

**Serialization rules:**
- Only emit `state` attribute when responseState is `'skipped'` or `'aborted'`
- If skip/abort has a reason, serialize as sentinel value with parenthesized reason
- If skip/abort has no reason, omit the value fence entirely

##### Note Serialization Format

Notes are general-purpose runtime annotations by agents/users, serialized at the end of
the form body (before `{% /form %}`). Notes are sorted numerically by ID for
deterministic output.

**Note tag syntax:**

```md
{% note id="n1" ref="field_id" role="agent" %}
General observation about this field.
{% /note %}

{% note id="n2" ref="quarterly_earnings" role="agent" %}
Analysis completed with partial data due to API limitations.
{% /note %}
````

**Note attributes:**

| Attribute | Required | Description |
| --- | --- | --- |
| `id` | Yes | Unique note identifier (implementation uses n1, n2, n3...) |
| `ref` | Yes | Target element ID (field, group, or form) |
| `role` | Yes | Who created the note (e.g., 'agent', 'user') |

> **Note (markform-254):** Notes no longer support a `state` attribute.
> Skip/abort reasons are now embedded directly in the field value using sentinel syntax
> like `%SKIP% (reason)`. Notes are purely for general annotations.

**Placement and ordering:**

- Notes appear at the end of the form, before `{% /form %}`

- Notes are sorted numerically by ID suffix (n1, n2, n10 not n1, n10, n2)

- Multiple notes can reference the same target element

- Notes are separated by blank lines for readability

**Example form with notes:**

````md
{% form id="quarterly_earnings" title="Quarterly Earnings Analysis" %}

{% group id="company_info" title="Company Info" %}
{% field kind="string" id="company_name" label="Company name" state="skipped" %}
```value
%SKIP% (Not applicable for this analysis type)
````
{% /field %} {% /group %}

{% note id="n1" ref="quarterly_earnings" role="agent" %} Analysis completed with partial
data due to API limitations.
{% /note %}

{% /form %}
````

##### The `process=false` Attribute

**Rule:** Only emit `process=false` when the value contains Markdoc syntax.

The `process=false` attribute prevents Markdoc from interpreting content as tags.
It is only required when the value contains Markdoc tag syntax:

- Tag syntax: `{% ... %}`

> **Note:** Markdoc uses HTML comments (`

<!-- ... -->

`), not `{# ... #}`. HTML comments in form values are plain text and don't require
`process=false`.

**Detection:** Check if the value matches the pattern `/\{%/`. A simple regex check is
sufficient since false positives are harmless (adding `process=false` when not needed
has no effect, but we prefer not to clutter the output).

```ts
function containsMarkdocSyntax(value: string): boolean {
  return /\{%/.test(value);
}
````

**Example (process=false required):**
````md
{% field kind="string" id="notes" label="Notes" %}
```value {% process=false %}
Use {% tag %} for special formatting.
````
{% /field %}
````

**Example (process=false not needed):**
```md
{% field kind="string" id="name" label="Name" %}
```value
Alice Johnson
````
{% /field %}
````

See [GitHub Discussion #261][markdoc-process-false] for background on the attribute.

#### Example: Template Form

**Minimal frontmatter (hand-authored):**

```md
---
markform:
  spec: MF/0.1
---

{% form id="quarterly_earnings" title="Quarterly Earnings Analysis" %}

{% description ref="quarterly_earnings" %}
Prepare an earnings-call brief by extracting key financials and writing a thesis.
{% /description %}

{% group id="company_info" title="Company Info" %}
{% field kind="string" id="company_name" label="Company name" required=true %}{% /field %}
{% field kind="string" id="ticker" label="Ticker" required=true %}{% /field %}
{% field kind="string" id="fiscal_period" label="Fiscal period" required=true %}{% /field %}
{% /group %}

{% group id="source_docs" title="Source Documents" %}
{% field kind="checkboxes" id="docs_reviewed" label="Documents reviewed" required=true %}
- [ ] 10-K {% #ten_k %}
- [ ] 10-Q {% #ten_q %}
- [ ] Earnings release {% #earnings_release %}
- [ ] Earnings call transcript {% #call_transcript %}
{% /field %}
{% /group %}

{% group id="financials" title="Key Financials" %}
{% field kind="number" id="revenue_m" label="Revenue (USD millions)" required=true %}{% /field %}
{% field kind="number" id="gross_margin_pct" label="Gross margin (%)" %}{% /field %}
{% field kind="number" id="eps_diluted" label="Diluted EPS" required=true %}{% /field %}
{% /group %}

{% group id="analysis" title="Analysis" %}
{% field kind="single_select" id="rating" label="Overall rating" required=true %}
- [ ] Bullish {% #bullish %}
- [ ] Neutral {% #neutral %}
- [ ] Bearish {% #bearish %}
{% /field %}
{% field kind="string" id="thesis" label="Investment thesis" required=true %}{% /field %}
{% /group %}

{% /form %}
````

**Note:** When the engine serializes this form, it will add `form_summary`,
`form_progress`, and `form_state` to the `markform` block automatically.
Hand-authored forms only need the `spec` field.

#### Example: Incomplete Form

````md
{% group id="company_info" title="Company Info" %}
{% field kind="string" id="company_name" label="Company name" required=true %}
```value
ACME Corp
````
{% /field %} {% field kind="string" id="ticker" label="Ticker" required=true %}
```value
ACME
```
{% /field %} {% field kind="string" id="fiscal_period" label="Fiscal period"
required=true %}{% /field %} {% /group %}

{% group id="source_docs" title="Source Documents" %} {% checkboxes id="docs_reviewed"
label="Documents reviewed" required=true %}

- [x] 10-K {% #ten_k %}

- [x] 10-Q {% #ten_q %}

- [/] Earnings release {% #earnings_release %}

- [ ] Earnings call transcript {% #call_transcript %} {% /field %} {% /group %}
````

Notes:

- Option IDs use Markdoc annotation shorthand `#id` (field-scoped, slugified from label)

- Reference options externally using qualified form: `{fieldId}.{optionId}` (e.g., `docs_reviewed.ten_k`)

- Checkbox states: `[ ]` todo, `[x]` done, `[/]` incomplete, `[*]` active, `[-]` n/a

#### Parsing Strategy

Follows [Markdoc's render phases][markdoc-render] (parse → transform → render):

1. Split frontmatter (YAML) from body

2. `Markdoc.parse(body)` to get AST (see [Getting Started][markdoc-getting-started])

3. `Markdoc.validate(ast, markformConfig)` for syntax-level issues (see [Validation][markdoc-validation])

4. Traverse AST to extract:
   - Form/group/field attributes from tags
   - Option lists from list items within select/checkbox tags
   - Values from `fence` nodes where `language === "value"`
   - Documentation blocks

5. Run **semantic** validation (Markform-specific, not Markdoc built-in):
   - Globally-unique IDs for form/group/field (option IDs are field-scoped only)
   - `ref` resolution (doc blocks reference valid targets)
   - Checkbox mode enforcement (`checkboxMode="simple"` restricts to 2 states)
   - Option marker parsing (`[ ]`, `[x]`, `[/]`, `[*]`, `[-]`, `[y]`, `[n]`, etc.)
   - **Label requirement** (*required*): All fields must have a `label` attribute;
     missing label is a parse error
   - **Option ID annotation** (*required*): All options in select/checkbox fields must
     have `{% #id %}` annotation; missing annotation is a parse error
   - **Option ID uniqueness** (*required*): Option IDs must be unique within their
     containing field; duplicates are a parse error

**Non-Markform content policy (*required*):**

Markform files may contain content outside of Markform tags. This content is handled as follows:

| Content Type | Policy |
|--------------|--------|
| HTML comments (`

<!-- ... -->

`) | Allowed, preserved verbatim on round-trip |
| Markdown headings/text between groups | Allowed, but NOT preserved on canonical serialize |
| Arbitrary Markdoc tags (non-Markform) | Parse warning, ignored |

**MF/0.1 scope:** Only HTML comments are guaranteed to be preserved. Do not rely on
non-Markform content surviving serialization. Future versions may support full
content preservation via raw slicing.

#### Serialization Strategy

Generate markdown string directly (not using `Markdoc.format()` due to canonicalization
requirements beyond what it provides—see [Formatting][markdoc-format]):

**MF/0.1 content restrictions for canonical serialization (*required*):**

To ensure deterministic round-tripping without building a full markdown serializer:

| Content type | Restriction |
|--------------|-------------|
| Option labels | Plain text only—no inline markdown, no nested tags. Validated at parse time. |
| Doc block bodies | Preserved verbatim—stored as raw text slice, re-emitted without reformatting. |
| Field labels | Plain text only—no inline markdown. |
| Group/form titles | Plain text only—no inline markdown. |

**Canonical formatting rules (*required*):**

| Rule | Specification |
|------|---------------|
| Attribute ordering | Alphabetical within each tag |
| Indentation | 0 spaces for top-level, no nested indentation |
| Blank lines | One blank line between adjacent blocks (fields, groups, doc blocks) for readability |
| Value fences | Omit entirely for empty fields |
| Fence character | Smart selection: pick backticks or tildes based on content to avoid collision with nested code blocks. Pick the character with smaller max-run at line start (indent ≤ 3); prefer backticks on tie. Length = max(3, maxRun + 1). |
| `process=false` | Emit only when value contains Markdoc tag syntax (`/{%/`) |
| Option ordering | Preserved as authored (order is significant) |
| Line endings | Unix (`\n`) only |
| Doc block placement | Immediately after the referenced element |

##### Smart Fence Selection

When serializing field values, the fence character (backticks `` ` `` or tildes `~`) is
chosen dynamically to avoid collision with nested code blocks in the content.

**Algorithm:**

1. Count the maximum consecutive run of each fence character at line starts (ignoring
   lines indented 4+ spaces, which are inside indented code blocks per CommonMark)
2. Pick the character with the smaller max-run
3. On a tie, prefer backticks (more common convention)
4. Use fence length = max(3, maxRun + 1) to ensure safe nesting

**Why this matters:** String field values may contain arbitrary Markdown, including
fenced code blocks. Without smart selection, a value containing triple backticks
would create ambiguous or malformed output.

**Example—Markdown documentation inside a value:**

```md
{% field kind="string" id="setup_guide" label="Setup Guide" %}
~~~value
## Installation

Install the package:

```bash
npm install my-library
````

Then configure:

```json
{
  "enabled": true
}
```
~~~
{% /field %}
```

Here the serializer chose tildes (`~~~`) because the content contains backticks. The
content includes multiple fenced code blocks that are preserved exactly as authored.

#### Syntax Styles

Markform supports two syntax styles for structural tags. Both are **always supported**
with no configuration needed—implementations MUST accept either as input.

**Comment syntax** (primary, recommended) uses HTML comments:

```md
<!-- form id="survey" -->
<!-- field kind="string" id="name" label="Name" -->
<!-- /field -->
<!-- /form -->
```

**Tag syntax** (alternative) uses standard Markdoc tag notation:

```md
{% form id="survey" %}
{% field kind="string" id="name" label="Name" %}
{% /field %}
{% /form %}
```

**Why prefer comment syntax?**

- Forms render cleanly on GitHub and standard Markdown editors (comments are hidden)
- Only the content (checkboxes, text) is visible to readers
- Tag names match the Markdoc tags directly (e.g., `form`, `field`, `group`)

**Syntax mapping:**

| Comment Syntax | Tag Syntax | Notes |
| --- | --- | --- |
| `<!-- tag attr="val" -->` | `{% tag attr="val" %}` | Same tag name in both |
| `<!-- /tag -->` | `{% /tag %}` | Closing tags |
| `<!-- tag /-->` | `{% tag /%}` | Self-closing: `/` before `-->` |
| `<!-- #id -->` | `{% #id %}` | ID annotations |
| `<!-- .class -->` | `{% .class %}` | Class annotations |

**Behavioral rules:**

- *required:* Both syntaxes are **always supported** with no configuration needed

- *required:* Implementations MUST accept either syntax as input

- *required:* Whitespace after `<!--` is flexible—both `<!-- form` and `<!--form` MUST be
  accepted as valid input

- *recommended:* Output SHOULD use consistent spacing with a space after `<!--`
  (e.g., `<!-- form -->` not `<!--form -->`)

- *recommended:* Round-trip serialization SHOULD preserve the original syntax style

- *recommended:* Use only one syntax per file for consistency

**Markform document identification:**

A document is identified as a Markform document when it contains a **form tag** that:

1. Uses either comment syntax (`<!-- form ... -->`) or tag syntax (`{% form ... %}`)
2. Contains well-formed attributes (i.e., has at least one `=` character)
3. Includes an `id` attribute (not necessarily as the first attribute)

Examples of valid form tags that identify a Markform document:

```md
<!-- form id="survey" -->                           ✓ valid
<!-- form id="survey" spec="MF/0.1" -->             ✓ valid (spec optional)
{% form id="survey" %}                              ✓ valid (tag syntax)
<!-- form spec="MF/0.1" id="survey" title="..." --> ✓ valid (id not first)
```

Examples that do NOT identify a Markform document:

```md
<!-- form -->                     ✗ no attributes
<!-- form follows -->             ✗ no = (not attributes)
<!-- form notes for meeting -->   ✗ no = (just text)
```

**Tag transformation scope:**

- *required:* Comment-to-tag transformation MUST only occur **within** the form tag
  boundaries (between the opening `<!-- form ... -->` and closing `<!-- /form -->`)

- *required:* HTML comments outside the form tag MUST pass through unchanged, even if
  they match Markform tag names (e.g., `<!-- field notes -->` before the form tag)

- *required:* The form tag itself is always recognized to establish document boundaries

This scoping rule prevents collisions with regular HTML comments in documents that
happen to contain words like "form", "field", or "group".

**Syntax detection:**

- A document is detected as `comments` style when the form tag uses comment syntax
  (`<!-- form id="..." -->`)

- A document is detected as `tags` style when the form tag uses tag syntax
  (`{% form id="..." %}`) or when no valid form tag is found

- Mixed syntax within a document is supported but not recommended

**Example (comment syntax):**

```md
---
markform:
  spec: MF/0.1
---
<!-- form id="survey" -->
<!-- group id="ratings" -->

<!-- field kind="single_select" id="quality" label="Quality Rating" -->
- [ ] Excellent <!-- #excellent -->
- [ ] Good <!-- #good -->
- [ ] Fair <!-- #fair -->
<!-- /field -->

<!-- /group -->
<!-- /form -->
```

On GitHub, all `<!-- ... -->` comments are hidden, leaving only the visible content:
- [ ] Excellent
- [ ] Good
- [ ] Fair

**Constraint:** Values containing the literal string `-->` require escaping or should
use the tag syntax to avoid prematurely closing the comment.

* * *

## Layer 2: Form Data Model

This layer defines the precise data structures for forms, fields, values, and
documentation. We use **Zod schemas** as the canonical notation because they provide:

- Precise, unambiguous type definitions
- Runtime validation built-in
- Easy mapping to JSON Schema (via `zod-to-json-schema`)
- Clear documentation of constraints and invariants

Alternative implementations may use equivalent schema definitions in their native
language (e.g., Pydantic for Python, JSON Schema for language-agnostic interchange).
The schemas below are normative—conforming implementations must support equivalent
data structures.

#### Type System

This section formalizes the distinction between **field kinds** (Markform's field
classification) and **data types** (the underlying value representation).

##### Terminology

| Term | Definition | Examples |
| --- | --- | --- |
| **Field Kind** | Markform field classification. Determines syntax, validation, and behavior. | `string`, `single_select`, `table` |
| **Data Type** | TypeScript/JSON type of the value. | `string`, `number`, `string[]` |
| **Value Type** | Complete type expression including nullability. | `string \| null`, `OptionId[]` |
| **Scalar Type** | Single atomic value (optionally format-constrained). | `string`, `url`, `date` |
| **Column Type** | Type of a cell in a table field (subset of scalar types). | `string`, `number`, `url` |

##### Data Type Taxonomy

**Primitive Types** — Base JSON types:

| Primitive | Description |
| --- | --- |
| `string` | UTF-8 text |
| `number` | IEEE 754 float (includes integers) |
| `boolean` | true/false |
| `null` | Absence of value |

**Scalar Types** — Primitives with optional format constraints:

| Scalar Type | Base Primitive | Format Constraint |
| --- | --- | --- |
| `string` | `string` | — |
| `number` | `number` | — |
| `url` | `string` | Valid URL |
| `date` | `string` | ISO 8601 (YYYY-MM-DD) |
| `year` | `number` | Integer in valid year range |

**Enum Types** — Values constrained to a defined set:

| Enum Type | Base Primitive | Values |
| --- | --- | --- |
| `OptionId` | `string` | One of the field's defined option IDs |
| `CheckboxValue` | `string` | State tokens based on `checkboxMode` |

**Collection Types** — Compound types:

| Collection Type | Structure |
| --- | --- |
| `Array<T>` | Ordered list of `T` |
| `Record<K, V>` | Key-value map |

**Structured Types** — Complex domain objects:

| Structured Type | Definition |
| --- | --- |
| `TableRow` | `Record<ColumnId, CellValue>` |
| `CellValue` | Scalar type determined by column's type |

##### Field Kind Taxonomy

Field kinds are organized into four categories:

```
Field Kinds
├── Simple Kinds ──────── Single scalar value (nullable)
│   ├── string           Also usable as column types
│   ├── number           in table fields
│   ├── url
│   ├── date
│   └── year
│
├── List Kinds ────────── Ordered array of scalars
│   ├── string_list      Open-ended (user provides items)
│   └── url_list
│
├── Chooser Kinds ─────── Selection from predefined options
│   ├── single_select    Pick one
│   ├── multi_select     Pick many
│   └── checkboxes       State per option
│
└── Structured Kinds ──── Complex nested data
    └── table            Rows × typed columns
```

**Simple Kinds** can also be used as column types in table fields.

##### Kind → Type Mapping

| Field Kind | Category | Value Type | Base Type | Notes |
| --- | --- | --- | --- | --- |
| `string` | Simple | `string \| null` | `string` | Plain text |
| `number` | Simple | `number \| null` | `number` | Integer or float |
| `url` | Simple | `string \| null` | `string` | URL format validated |
| `date` | Simple | `string \| null` | `string` | ISO 8601 format |
| `year` | Simple | `number \| null` | `number` | Integer year |
| `string_list` | List | `string[]` | `Array<string>` | Empty = `[]` |
| `url_list` | List | `string[]` | `Array<string>` | URL format validated |
| `single_select` | Chooser | `OptionId \| null` | `string` (enum) | One of defined options |
| `multi_select` | Chooser | `OptionId[]` | `Array<string>` (enum) | Subset of options |
| `checkboxes` | Chooser | `Record<OptionId, CheckboxValue>` | `Record<string, string>` | State per option |
| `table` | Structured | `TableRow[]` | `Array<Record<string, CellValue>>` | Typed columns |

#### Canonical TypeScript Types

```ts
type Id = string; // validated snake_case, e.g., /^[a-z][a-z0-9_]*$/

// Validator reference: simple string ID or parameterized object
type ValidatorRef = string | { id: string; [key: string]: unknown };

// Answer state for a field - orthogonal to field kind
// Any field can be in any answer state
type AnswerState = 'unanswered' | 'answered' | 'skipped' | 'aborted';

// Field response: combines answer state with optional value
// Used in responsesByFieldId for all fields
interface FieldResponse {
  state: AnswerState;
  value?: FieldValue;  // present only when state === 'answered'
  reason?: string;     // skip/abort reason (embedded in sentinel value)
}

// Note system for field/group/form annotations
type NoteId = string;  // unique note ID (implementation uses n1, n2, n3...)

interface Note {
  id: NoteId;
  ref: Id;                       // target ID (field, group, or form)
  role: string;                  // who created (agent, user, ...)
  state?: 'skipped' | 'aborted'; // optional: links note to action
  text: string;                  // markdown content
}

// Multi-checkbox states (checkboxMode="multi", default)
type MultiCheckboxState = 'todo' | 'done' | 'incomplete' | 'active' | 'na';

// Simple checkbox states (checkboxMode="simple")
type SimpleCheckboxState = 'todo' | 'done';

// Explicit checkbox values (checkboxMode="explicit")
type ExplicitCheckboxValue = 'unfilled' | 'yes' | 'no';

// Union type for all checkbox values (validated based on checkboxMode)
type CheckboxValue = MultiCheckboxState | ExplicitCheckboxValue;

type Field =
  | StringField
  | NumberField
  | StringListField
  | CheckboxesField
  | SingleSelectField
  | MultiSelectField
  | UrlField
  | UrlListField;

interface FormSchema {
  id: Id;
  title?: string;
  groups: FieldGroup[];
}

interface FieldGroup {
  id: Id;
  title?: string;
  // Note: `required` on groups is not supported in MF/0.1 (ignored with warning)
  validate?: ValidatorRef[];  // validator references (string IDs or parameterized objects)
  children: Field[];          // MF/0.1/0.2: fields only; nested groups deferred (future)
}

type FieldPriorityLevel = 'high' | 'medium' | 'low';

interface FieldBase {
  id: Id;
  label: string;
  required: boolean;             // explicit: parser defaults to false if not specified
  priority: FieldPriorityLevel;  // explicit: parser defaults to 'medium' if not specified
  validate?: ValidatorRef[];     // validator references (string IDs or parameterized objects)
}

// NOTE: `required` and `priority` are explicit (not optional) in the data model.
// The parser assigns defaults when not specified in markup. This ensures:
// 1. Consumers don't need null/undefined checks or ?? fallbacks
// 2. Intent is always explicit in parsed data - no silent "undefined means false" behavior
// 3. Serialization can always emit these values for clarity

interface StringField extends FieldBase {
  kind: 'string';
  multiline?: boolean;
  pattern?: string;          // JS regex without delimiters
  minLength?: number;
  maxLength?: number;
}

interface NumberField extends FieldBase {
  kind: 'number';
  min?: number;
  max?: number;
  integer?: boolean;
}

interface StringListField extends FieldBase {
  kind: 'string_list';
  minItems?: number;
  maxItems?: number;
  itemMinLength?: number;
  itemMaxLength?: number;
  uniqueItems?: boolean;
}

interface Option {
  id: Id;
  label: string;
  metadata?: Record<string, string>;
}
```

**Option metadata:** Options in checkboxes, single-select, and multi-select fields may
include arbitrary metadata attributes. These are preserved during parsing and
serialization but do not affect validation or form behavior.

Syntax:
```markdown
- [ ] Ship v1.0 {% #ship pr="#203" issue="PROJ-106" %}
- [ ] Security audit <!-- #audit assignee="alice" due="2026-02-01" -->
```

Parsed structure:
```json
{
  "id": "ship",
  "label": "Ship v1.0",
  "metadata": { "pr": "#203", "issue": "PROJ-106" }
}
```

Rules:
- Metadata keys MUST be valid identifiers (alphanumeric + underscore)
- Reserved keys (`id`, `class`) MUST NOT be used as metadata keys
- Metadata values are always strings
- Empty metadata object MAY be omitted during serialization

```typescript
type CheckboxMode = 'multi' | 'simple' | 'explicit';

interface CheckboxesField extends FieldBase {
  kind: 'checkboxes';
  checkboxMode: CheckboxMode;   // explicit: parser defaults to 'multi' if not specified
  minDone?: number;             // simple mode only: integer, default -1 (all)
  options: Option[];
}

interface SingleSelectField extends FieldBase {
  kind: 'single_select';
  options: Option[];
}

interface MultiSelectField extends FieldBase {
  kind: 'multi_select';
  options: Option[];
  minSelections?: number;
  maxSelections?: number;
}

interface UrlField extends FieldBase {
  kind: 'url';
  // No additional constraints - URL format validation is built-in
}

interface UrlListField extends FieldBase {
  kind: 'url_list';
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

// OptionId is local to the containing field (e.g., "ten_k", "bullish")
type OptionId = string;

type FieldValue =
  | { kind: 'string'; value: string | null }
  | { kind: 'number'; value: number | null }
  | { kind: 'string_list'; items: string[] }
  | { kind: 'checkboxes'; values: Record<OptionId, CheckboxValue> }  // keys are local option IDs
  | { kind: 'single_select'; selected: OptionId | null }             // local option ID
  | { kind: 'multi_select'; selected: OptionId[] }                   // local option IDs
  | { kind: 'url'; value: string | null }                            // validated URL string
  | { kind: 'url_list'; items: string[] };                           // array of URL strings

// QualifiedOptionRef is used when referencing options externally (e.g., in doc blocks)
type QualifiedOptionRef = `${Id}.${OptionId}`;  // e.g., "docs_reviewed.ten_k"

/** Documentation tag types (from Markdoc tag name) */
type DocumentationTag = 'description' | 'instructions' | 'documentation';

interface DocumentationBlock {
  ref: Id | QualifiedOptionRef;  // form/group/field ID, or qualified option ref
  tag: DocumentationTag;         // the Markdoc tag name
  bodyMarkdown: string;
}

/** Node type for ID index entries - identifies what structural element an ID refers to */
type NodeType = 'form' | 'group' | 'field';

// IdIndexEntry: lookup entry for fast ID resolution and validation
// NOTE: Options are NOT indexed here (they are field-scoped, not globally unique)
// Use StructureSummary.optionsById for option lookup via QualifiedOptionRef
interface IdIndexEntry {
  nodeType: NodeType;      // what this ID refers to
  parentId?: Id;           // parent group/form ID (undefined for form)
}

// FormMetadata: form-level metadata from YAML frontmatter
interface FormMetadata {
  markformVersion: string;
  roles: string[];                        // available roles for field assignment
  roleInstructions: Record<string, string>; // instructions per role
  runMode?: 'interactive' | 'fill' | 'research';  // optional: hint for CLI tools
}

// ParsedForm: canonical internal representation returned by parseForm()
interface ParsedForm {
  schema: FormSchema;
  responsesByFieldId: Record<Id, FieldResponse>;  // unified response state + value
  notes: Note[];                          // agent/user notes
  docs: DocumentationBlock[];
  orderIndex: Id[];                       // fieldIds in document order (deterministic)
  idIndex: Map<Id, IdIndexEntry>;         // fast lookup for form/group/field (NOT options)
  metadata?: FormMetadata;                // optional for backward compat with forms without frontmatter
}

// InspectIssue: unified type for inspect/apply API results
// Derived from ValidationIssue[] but simplified for agent/UI consumption
// Returned as a single list sorted by priority tier (ascending, P1 = highest)
interface InspectIssue {
  ref: Id | QualifiedOptionRef;  // target this issue relates to (field, group, or qualified option)
  scope: 'form' | 'group' | 'field' | 'option';  // scope of the issue target
  reason: IssueReason;       // machine-readable reason code
  message: string;           // human-readable description
  severity: 'required' | 'recommended';  // *required* = must fix; *recommended* = suggested
  priority: number;          // tier 1-5 (P1-P5); computed from field priority + issue type score
}

// Standard reason codes (keep stable for golden tests)
type IssueReason =
  // Severity: *required* (must be resolved for form completion)
  | 'validation_error'       // Field has validation errors (pattern, range, etc.)
  | 'required_missing'       // Required field with no value
  | 'checkbox_incomplete'    // Required checkboxes with non-terminal states
  | 'min_items_not_met'      // String-list or multi-select below minimum
  // Severity: *recommended* (optional improvements)
  | 'optional_unanswered';   // Optional field not yet addressed

// Mapping from ValidationIssue to InspectIssue:
// - ValidationIssue.severity='error' → InspectIssue.severity='required'
// - ValidationIssue.severity='warning'/'info' → InspectIssue.severity='recommended'
// - Unanswered optional fields → severity='recommended', reason='optional_unanswered'
```

#### StructureSummary and ProgressSummary

These types model the derived metadata stored in frontmatter and exposed via
tool/harness APIs. They provide a quick overview of form structure and filling progress
without exposing actual field values.

##### StructureSummary (form_summary)

Describes the static structure of the form schema:

```ts
// FieldKind matches the 'kind' discriminant on Field types
type FieldKind = 'string' | 'number' | 'string_list' | 'checkboxes' | 'single_select' | 'multi_select' | 'url' | 'url_list';

interface StructureSummary {
  groupCount: number;           // total groups
  fieldCount: number;           // total fields (all kinds)
  optionCount: number;          // total options across all select/checkbox fields

  fieldCountByKind: Record<FieldKind, number>;  // breakdown by field kind

  /** Map of group ID -> 'field_group' (for completeness; groups have one kind) */
  groupsById: Record<Id, 'field_group'>;

  /** Map of field ID -> field kind */
  fieldsById: Record<Id, FieldKind>;

  /**
   * Map of qualified option ref -> parent field info.
   * Keys use qualified form: "{fieldId}.{optionId}" (e.g., "docs_reviewed.ten_k")
   * This allows relating options back to their parent field.
   */
  optionsById: Record<QualifiedOptionRef, {
    parentFieldId: Id;
    parentFieldKind: FieldKind;
  }>;
}
```

**Notes:**

- This is **schema-only**; it does not include values

- All ID maps are sorted alphabetically in YAML output for deterministic serialization

- `optionsById` uses qualified refs to avoid ambiguity between fields with same option
  IDs

##### ProgressSummary (form_progress)

Tracks filling progress per field without exposing actual values:

```ts
// Progress state for a field or the whole form (derived from dimensions)
type ProgressState = 'empty' | 'incomplete' | 'invalid' | 'complete';

interface FieldProgress {
  kind: FieldKind;             // field kind
  required: boolean;           // whether field has required=true

  answerState: AnswerState;    // unified answer state (unanswered/answered/skipped/aborted)
  hasNotes: boolean;           // whether field has any notes attached
  noteCount: number;           // count of notes attached to this field

  empty: boolean;              // true if field has no value
  valid: boolean;              // true iff no validation issues for this field
  issueCount: number;          // count of ValidationIssues referencing this field

  /**
   * Checkbox state rollup (only present for checkboxes fields).
   * Provides counts without exposing which specific options are in each state.
   */
  checkboxProgress?: CheckboxProgressCounts;
}

/**
 * Checkbox progress counts, generalized for all checkbox modes.
 * Only the states valid for the field's checkboxMode will have non-zero values.
 */
interface CheckboxProgressCounts {
  total: number;               // total options in this checkbox field

  // Multi mode states (checkboxMode="multi")
  todo: number;
  done: number;
  incomplete: number;          // camelCase in TS, snake_case in YAML
  active: number;
  na: number;

  // Explicit mode states (checkboxMode="explicit")
  unfilled: number;
  yes: number;
  no: number;
}

interface ProgressSummary {
  counts: ProgressCounts;

  /** Map of field ID -> field progress */
  fields: Record<Id, FieldProgress>;
}

interface ProgressCounts {
  totalFields: number;           // all fields in the form
  requiredFields: number;        // fields with required=true

  // Dimension 1: AnswerState (mutually exclusive, sum to totalFields)
  unansweredFields: number;      // fields with answerState='unanswered'
  answeredFields: number;        // fields with answerState='answered' (have values)
  skippedFields: number;         // fields with answerState='skipped'
  abortedFields: number;         // fields with answerState='aborted'

  // Dimension 2: Validity (mutually exclusive, sum to totalFields)
  validFields: number;           // fields with valid=true
  invalidFields: number;         // fields with valid=false

  // Dimension 3: Value presence (mutually exclusive, sum to totalFields)
  emptyFields: number;           // fields with empty=true (no value)
  filledFields: number;          // fields with empty=false (have value)

  // Derived counts
  emptyRequiredFields: number;   // required fields with no value
  totalNotes: number;            // total notes across all fields/groups/form
}
```

##### ProgressState Definitions

The `ProgressState` is computed deterministically based on submission status, validation
result, and completeness rules:

| State | Meaning |
| --- | --- |
| `empty` | No fields have values |
| `incomplete` | Some fields have values but not all required fields are filled or valid |
| `invalid` | Form has validation errors or aborted fields |
| `complete` | All required fields are filled and all fields are valid |

**AnswerState rules (deterministic, per field):**

The `answerState` is determined by the field’s FieldResponse:

| AnswerState | When |
| --- | --- |
| `unanswered` | No value provided and not skipped/aborted |
| `answered` | FieldResponse has a value (value !== undefined) |
| `skipped` | Explicitly skipped via skip_field patch |
| `aborted` | Explicitly aborted via abort_field patch |

For `answered` fields, value presence is determined per field kind:

| Field Kind | Has value when |
| --- | --- |
| `string` | `value !== null && value.trim().length > 0` |
| `number` | `value !== null` |
| `single_select` | `selected !== null` |
| `multi_select` | `selected.length > 0` |
| `string_list` | `items.length > 0` |
| `url` | `value !== null && value.trim().length > 0` |
| `url_list` | `items.length > 0` |
| `checkboxes` | At least one option state differs from initial (`todo` for multi/simple, `unfilled` for explicit) |

**Completeness rules (for required fields):**

Completeness is relevant only when `required=true`. An answered field is complete if:

| Field Kind | Complete when |
| --- | --- |
| `string` | Submitted (non-empty after trim) |
| `number` | Submitted (non-null) |
| `single_select` | Submitted (exactly one selected) |
| `multi_select` | `selected.length >= max(1, minSelections)` |
| `string_list` | `items.length >= max(1, minItems)` |
| `checkboxes` | All options in terminal state (see checkbox completion rules above) |

**State computation logic:**

```
if not answered AND (skipped OR aborted) AND has validation errors:
  state = 'invalid'  // addressed but problematic
elif not answered:
  state = 'empty'
elif has validation errors:
  state = 'invalid'
elif required and not complete:
  state = 'incomplete'
else:
  state = 'complete'
```

**Form state computation (`form_state` in frontmatter):**

The overall `form_state: ProgressState` is derived from `ProgressSummary.counts`:

```
if counts.answeredFields == 0:
  form_state = 'empty'
elif counts.invalidFields > 0:
  form_state = 'invalid'
elif counts.incompleteFields > 0 or counts.emptyRequiredFields > 0:
  form_state = 'incomplete'
else:
  form_state = 'complete'
```

**Implicit requiredness (*required*):**

For form completion purposes, fields with constraints are treated as implicitly
required:

| Field Kind | Implicit Required When |
| --- | --- |
| `string-list` | `minItems > 0` |
| `multi-select` | `minSelections > 0` |
| `checkboxes` | `minDone > 0` (simple mode) |

These fields contribute to `emptyRequiredFields` count even without explicit
`required=true`. This ensures `form_state` accurately reflects whether all constraints
are satisfied.

**Role-filtered completion (for multi-role forms):**

When running the fill harness with a specific `targetRoles` parameter (e.g., just the
`agent` role), completion should be determined by only the fields assignable to those
roles, not all fields in the form.
The completion formula becomes:

```
Role-filtered completion for targetRoles:
  roleFilteredFields = fields.filter(f => targetRoles.includes(f.role) || !f.role)

  isComplete =
    abortedFields == 0  AND
    for all f in roleFilteredFields:
      f.responseState == 'answered' (with f.state == 'complete')  OR
      f.responseState == 'skipped'
```

This is critical for forms where the user fills some fields first, then the agent fills
the remaining agent-role fields.
Without role filtering, the harness would incorrectly report the form as incomplete even
after all agent fields are filled, because user fields (intended for a different actor)
would still be empty.

**Response states for completion purposes:**

| Response State | Counts as Complete | Notes |
| --- | --- | --- |
| `answered` (complete) | Yes | Field has valid value and passes validation |
| `skipped` | Yes | Explicitly skipped via `skip_field` patch (optional fields only) |
| `aborted` | No | Field marked as unable to complete—blocks all completion |
| `empty` | No | Field has no response—must be answered or skipped |
| `answered` (incomplete) | No | Partially filled (e.g., list with fewer items than `minItems`) |
| `answered` (invalid) | No | Has validation errors |

**Note:** The completion formula requires:

1. All fields to be either *answered* (with complete/valid value) or *skipped*

2. No fields can be in *aborted* state (abortedFields == 0)

Simply leaving an optional field empty does NOT count toward completion—the agent must
actively skip it or provide a value.
This ensures agents acknowledge every field.

Aborted fields block completion entirely, requiring manual intervention to either fill
the field or remove the abort state before the form can be completed.

**Naming convention note:** Markdoc attributes and TypeScript properties both use
`camelCase` (e.g., `checkboxMode`, `minItems`). Only IDs use `snake_case`. This
alignment with JSON Schema keywords reduces translation complexity.

#### Zod Schemas

Use [Zod][zod] as the canonical TypeScript-first schema layer.
See [Zod API][zod-api] for primitives and constraints.

Implement Zod validators for all types, patch operations, session transcript schema, and
tool inputs. Zod is used for:

- CLI validation of inputs

- AI SDK tool `inputSchema` definitions (see [AI SDK Tools][ai-sdk-tools])

- Deriving JSON Schema for MCP tool schemas via [zod-to-json-schema]

**Note:** The `zod-to-json-schema` library has a deprecation notice for some APIs—use
the updated patterns documented in its README.

##### Summary Zod Schemas

Zod schemas for the frontmatter summary types:

```ts
const FieldKindSchema = z.enum([
  'string', 'number', 'string_list', 'checkboxes', 'single_select', 'multi_select', 'url', 'url_list'
]);

const AnswerStateSchema = z.enum(['unanswered', 'answered', 'skipped', 'aborted']);

const StructureSummarySchema = z.object({
  groupCount: z.number().int().nonnegative(),
  fieldCount: z.number().int().nonnegative(),
  optionCount: z.number().int().nonnegative(),
  fieldCountByKind: z.record(FieldKindSchema, z.number().int().nonnegative()),
  groupsById: z.record(z.string(), z.literal('field_group')),
  fieldsById: z.record(z.string(), FieldKindSchema),
  optionsById: z.record(z.string(), z.object({
    parentFieldId: z.string(),
    parentFieldKind: FieldKindSchema,
  })),
});

const ProgressStateSchema = z.enum(['empty', 'incomplete', 'invalid', 'complete']);

const CheckboxProgressCountsSchema = z.object({
  total: z.number().int().nonnegative(),
  // Multi mode
  todo: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  incomplete: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  na: z.number().int().nonnegative(),
  // Explicit mode
  unfilled: z.number().int().nonnegative(),
  yes: z.number().int().nonnegative(),
  no: z.number().int().nonnegative(),
});

const FieldProgressSchema = z.object({
  kind: FieldKindSchema,
  required: z.boolean(),
  answerState: AnswerStateSchema,                // unified answer state
  hasNotes: z.boolean(),
  noteCount: z.number().int().nonnegative(),
  empty: z.boolean(),                            // true if field has no value
  valid: z.boolean(),                            // true if field has no validation errors
  issueCount: z.number().int().nonnegative(),
  checkboxProgress: CheckboxProgressCountsSchema.optional(),
});

const ProgressCountsSchema = z.object({
  totalFields: z.number().int().nonnegative(),
  requiredFields: z.number().int().nonnegative(),
  // Dimension 1: AnswerState (mutually exclusive, sum to totalFields)
  unansweredFields: z.number().int().nonnegative(),
  answeredFields: z.number().int().nonnegative(),
  skippedFields: z.number().int().nonnegative(),
  abortedFields: z.number().int().nonnegative(),
  // Dimension 2: Validity (mutually exclusive, sum to totalFields)
  validFields: z.number().int().nonnegative(),
  invalidFields: z.number().int().nonnegative(),
  // Dimension 3: Value presence (mutually exclusive, sum to totalFields)
  emptyFields: z.number().int().nonnegative(),
  filledFields: z.number().int().nonnegative(),
  // Derived counts
  emptyRequiredFields: z.number().int().nonnegative(),
  totalNotes: z.number().int().nonnegative(),
});

const ProgressSummarySchema = z.object({
  counts: ProgressCountsSchema,
  fields: z.record(z.string(), FieldProgressSchema),
});

// Frontmatter schema for INPUT forms (templates)
const MarkformInputFrontmatterSchema = z.object({
  markformVersion: z.string(),  // Required: e.g., "0.1.0"
  // User metadata allowed but not validated
});

// Frontmatter schema for OUTPUT forms (after processing/serialization)
const MarkformFrontmatterSchema = z.object({
  markformVersion: z.string(),
  formSummary: StructureSummarySchema.optional(),   // Derived on serialize
  formProgress: ProgressSummarySchema.optional(),   // Derived on serialize
  formState: ProgressStateSchema.optional(),        // Derived on serialize
});
```

**YAML serialization:** When writing frontmatter, convert camelCase keys to snake_case:

- `specVersion` → `spec` (or use `MF_SPEC_VERSION` constant directly)

- `formSummary` → `form_summary`

- `formProgress` → `form_progress`

- `formState` → `form_state`

- `fieldCountByKind` → `field_count_by_kind`

- etc.

Use a `toSnakeCaseDeep()` helper for deterministic conversion at the frontmatter
boundary.

#### Comprehensive Field Kind Reference

This section provides a complete mapping between Markdoc syntax, TypeScript types, and
schema representations for all field kinds.

##### Naming Conventions

| Layer | Convention | Example |
| --- | --- | --- |
| Markdoc tag names | kebab-case | `string-field`, `multi-select` |
| Markdoc attributes | camelCase | `minLength`, `checkboxMode`, `minItems` |
| TypeScript interfaces | PascalCase | `StringField`, `MultiSelectField` |
| TypeScript properties | camelCase | `minLength`, `checkboxMode` |
| JSON Schema keywords | camelCase | `minItems`, `maxLength`, `uniqueItems` |
| IDs (values) | snake_case | `company_name`, `ten_k`, `quarterly_earnings` |
| YAML keys (frontmatter, session transcripts) | snake_case | `spec`, `form_summary`, `field_count_by_kind` |
| Kind values (field kinds) | snake_case | `'string'`, `'single_select'` |
| Patch operations | snake_case | `set_string`, `set_single_select` |

**Rationale:** Using camelCase for Markdoc attributes aligns with JSON Schema keywords
and TypeScript conventions, eliminating translation overhead.
IDs remain snake_case as they are data values, not code identifiers.
YAML keys use snake_case for readability and consistency with common YAML conventions.

**Reserved property names:**

| Property | Used on | Values | Notes |
| --- | --- | --- | --- |
| `kind` | `Field`, `FieldValue` | `FieldKind` values | Reserved for field kind discrimination only |
| `tag` | `DocumentationBlock` | `DocumentationTag` values | Identifies doc block type |
| `nodeType` | `IdIndexEntry` | `'form' \| 'group' \| 'field'` | Identifies structural element type |

**Reserved IDs:**

| Reserved ID | Purpose |
| --- | --- |
| `_default` | Implicit group for ungrouped fields |
| `_checkboxes` | Implicit checkboxes field for plan documents |

##### Field Kind Mappings

**`string-field`** — Single string value

| Aspect | Value |
| --- | --- |
| Markdoc tag | `string-field` |
| TypeScript interface | `StringField` |
| TypeScript kind | `'string'` |
| Attributes | `id`, `label`, `required`, `pattern`, `minLength`, `maxLength`, `multiline` |
| FieldValue | `{ kind: 'string'; value: string \| null }` |
| Patch operation | `{ op: 'set_string'; fieldId: Id; value: string \| null }` |
| Zod | `z.string().min(n).max(m).regex(pattern)` |
| JSON Schema | `{ type: "string", minLength, maxLength, pattern }` |

**`number-field`** — Numeric value

| Aspect | Value |
| --- | --- |
| Markdoc tag | `number-field` |
| TypeScript interface | `NumberField` |
| TypeScript kind | `'number'` |
| Attributes | `id`, `label`, `required`, `min`, `max`, `integer` |
| FieldValue | `{ kind: 'number'; value: number \| null }` |
| Patch operation | `{ op: 'set_number'; fieldId: Id; value: number \| null }` |
| Zod | `z.number().min(n).max(m).int()` |
| JSON Schema | `{ type: "number"/"integer", minimum, maximum }` |

**`string-list`** — Array of strings (open-ended list)

| Aspect | Value |
| --- | --- |
| Markdoc tag | `string-list` |
| TypeScript interface | `StringListField` |
| TypeScript kind | `'string_list'` |
| Attributes | `id`, `label`, `required`, `minItems`, `maxItems`, `itemMinLength`, `itemMaxLength`, `uniqueItems` |
| FieldValue | `{ kind: 'string_list'; items: string[] }` |
| Patch operation | `{ op: 'set_string_list'; fieldId: Id; value: string[] }` |
| Zod | `z.array(z.string().min(itemMin).max(itemMax)).min(n).max(m)` |
| JSON Schema | `{ type: "array", items: { type: "string" }, minItems, maxItems, uniqueItems }` |

**`single-select`** — Select exactly one option from enumerated list

| Aspect | Value |
| --- | --- |
| Markdoc tag | `single-select` |
| TypeScript interface | `SingleSelectField` |
| TypeScript kind | `'single_select'` |
| Attributes | `id`, `label`, `required` + inline `options` via list syntax |
| FieldValue | `{ kind: 'single_select'; selected: OptionId \| null }` |
| Patch operation | `{ op: 'set_single_select'; fieldId: Id; value: OptionId \| null }` |
| Zod | `z.enum([...optionIds])` |
| JSON Schema | `{ type: "string", enum: [...optionIds] }` |

**`multi-select`** — Select multiple options from enumerated list

| Aspect | Value |
| --- | --- |
| Markdoc tag | `multi-select` |
| TypeScript interface | `MultiSelectField` |
| TypeScript kind | `'multi_select'` |
| Attributes | `id`, `label`, `required`, `minSelections`, `maxSelections` + inline `options` |
| FieldValue | `{ kind: 'multi_select'; selected: OptionId[] }` |
| Patch operation | `{ op: 'set_multi_select'; fieldId: Id; value: OptionId[] }` |
| Zod | `z.array(z.enum([...optionIds])).min(n).max(m)` |
| JSON Schema | `{ type: "array", items: { enum: [...optionIds] }, minItems, maxItems }` |

**`checkboxes`** — Stateful checklist with configurable checkbox modes

| Aspect | Value |
| --- | --- |
| Markdoc tag | `checkboxes` |
| TypeScript interface | `CheckboxesField` |
| TypeScript kind | `'checkboxes'` |
| Attributes | `id`, `label`, `required`, `checkboxMode` (`multi`/`simple`/`explicit`), `minDone` (simple only) + inline `options` |
| FieldValue | `{ kind: 'checkboxes'; values: Record<OptionId, CheckboxValue> }` |
| Patch operation | `{ op: 'set_checkboxes'; fieldId: Id; value: Record<OptionId, CheckboxValue> }` |
| Zod | `z.record(z.enum([...states]))` |
| JSON Schema | `{ type: "object", additionalProperties: { enum: [...states] } }` |

**`url-field`** — Single URL value

| Aspect | Value |
| --- | --- |
| Markdoc tag | `url-field` |
| TypeScript interface | `UrlField` |
| TypeScript kind | `'url'` |
| Attributes | `id`, `label`, `required` |
| FieldValue | `{ kind: 'url'; value: string \| null }` |
| Patch operation | `{ op: 'set_url'; fieldId: Id; value: string \| null }` |
| Zod | `z.url()` |
| JSON Schema | `{ type: "string", format: "uri" }` |

**`url-list`** — Array of URLs (for citations, sources, references)

| Aspect | Value |
| --- | --- |
| Markdoc tag | `url-list` |
| TypeScript interface | `UrlListField` |
| TypeScript kind | `'url_list'` |
| Attributes | `id`, `label`, `required`, `minItems`, `maxItems`, `uniqueItems` |
| FieldValue | `{ kind: 'url_list'; items: string[] }` |
| Patch operation | `{ op: 'set_url_list'; fieldId: Id; value: string[] }` |
| Zod | `z.array(z.url()).min(n).max(m)` |
| JSON Schema | `{ type: "array", items: { type: "string", format: "uri" }, minItems, maxItems, uniqueItems }` |

**`date-field`** — ISO 8601 date value (YYYY-MM-DD)

| Aspect | Value |
| --- | --- |
| Markdoc tag | `date-field` |
| TypeScript interface | `DateField` |
| TypeScript kind | `'date'` |
| Attributes | `id`, `label`, `required`, `min`, `max` |
| FieldValue | `{ kind: 'date'; value: string \| null }` |
| Patch operation | `{ op: 'set_date'; fieldId: Id; value: string \| null }` |
| Zod | `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` |
| JSON Schema | `{ type: "string", format: "date" }` |

**`year-field`** — Integer year value

| Aspect | Value |
| --- | --- |
| Markdoc tag | `year-field` |
| TypeScript interface | `YearField` |
| TypeScript kind | `'year'` |
| Attributes | `id`, `label`, `required`, `min`, `max` |
| FieldValue | `{ kind: 'year'; value: number \| null }` |
| Patch operation | `{ op: 'set_year'; fieldId: Id; value: number \| null }` |
| Zod | `z.number().int().min(min).max(max)` |
| JSON Schema | `{ type: "integer", minimum: min, maximum: max }` |

**`table-field`** — Structured tabular data with typed columns

| Aspect | Value |
| --- | --- |
| Markdoc tag | `table-field` |
| TypeScript interface | `TableField` |
| TypeScript kind | `'table'` |
| Attributes | `id`, `label`, `required`, `columnIds`, `columnLabels`, `columnTypes`, `minRows`, `maxRows` |
| FieldValue | `{ kind: 'table'; rows: TableRowResponse[] }` |
| Patch operation | `{ op: 'set_table'; fieldId: Id; value: PatchTableRow[] }` |
| Zod | `z.object({ kind: z.literal('table'), rows: z.array(TableRowResponseSchema) })` |
| JSON Schema | `{ type: "object", properties: { kind: { const: "table" }, rows: { type: "array" } } }` |

**Note:** `OptionId` values are local to the field (e.g., `"ten_k"`, `"bullish"`). They
are NOT qualified with the field ID in patches or FieldValue—the field context is
implicit.

##### Checkbox Mode State Values

| Mode | States | Zod Enum |
| --- | --- | --- |
| `multi` (default) | `todo`, `done`, `incomplete`, `active`, `na` | `z.enum(['todo', 'done', 'incomplete', 'active', 'na'])` |
| `simple` | `todo`, `done` | `z.enum(['todo', 'done'])` |
| `explicit` | `unfilled`, `yes`, `no` | `z.enum(['unfilled', 'yes', 'no'])` |

* * *

## Layer 3: Validation & Form Filling

This layer defines the rules for validating form data, computing progress state, and
manipulating forms through patches.
It covers both the constraints that must be satisfied and the mechanics of form filling.

Validation happens at two levels: Markdoc syntax validation (see
[Markdoc Validation][markdoc-validation]) and Markform semantic validation.

#### Built-in Deterministic Validation

Schema checks (always available, deterministic):

| Check | Field Kind | Constraint Source |
| --- | --- | --- |
| Required fields present | All | `required=true` attribute |
| Number parsing success | `number-field` | Built-in |
| Min/max value range | `number-field` | `min`, `max` attributes |
| Integer constraint | `number-field` | `integer=true` attribute |
| Date format validation | `date-field` | Built-in (ISO 8601 YYYY-MM-DD) |
| Min/max date range | `date-field` | `min`, `max` attributes |
| Year integer validation | `year-field` | Built-in (integer) |
| Min/max year range | `year-field` | `min`, `max` attributes |
| Pattern match | `string-field` | `pattern` attribute (JS regex) |
| Min/max length | `string-field` | `minLength`, `maxLength` attributes |
| Min/max item count | `string-list` | `minItems`, `maxItems` attributes |
| Item length constraints | `string-list` | `itemMinLength`, `itemMaxLength` attributes |
| Unique items | `string-list` | `uniqueItems=true` attribute |
| Min/max selections | `multi-select` | `minSelections`, `maxSelections` (see [JSON Schema array][json-schema-array]) |
| Exactly one selected | `single-select` | `required=true` |
| Valid checkbox states | `checkboxes` | `checkboxMode` attribute (multi: 5 states, simple: 2 states, explicit: yes/no) |
| Valid explicit states | `checkboxes` | `checkboxMode="explicit"` validates markers are `unfilled`, `yes`, or `no` |

Output: `ValidationIssue[]`

#### Required Field Semantics

The `required` attribute has specific semantics for each field kind.
This section provides normative definitions:

| Field Kind | `required=true` means | `required=false` (or omitted) means |
| --- | --- | --- |
| `string-field` | `value !== null && value.trim() !== ""` | Value may be null or empty |
| `number-field` | `value !== null` (and parseable as number) | Value may be null |
| `date-field` | `value !== null && isValidDate(value)` | Value may be null |
| `year-field` | `value !== null` (and valid integer) | Value may be null |
| `url-field` | `value !== null && isValidUrl(value)` | Value may be null |
| `url-list` | `items.length >= max(1, minItems)` | Empty array is valid (unless `minItems` constraint) |
| `string-list` | `items.length >= max(1, minItems)` | Empty array is valid (unless `minItems` constraint) |
| `single-select` | Exactly one option must be selected | Zero or one option selected (never >1) |
| `multi-select` | `selected.length >= max(1, minSelections)` | Empty selection valid (unless `minSelections` constraint) |
| `checkboxes` | See checkbox completion rules below | No completion requirement |

**Checkbox completion rules by mode:**

When `required=true`, checkboxes must reach a “completion state” based on mode:

| Mode | Completion state | Non-terminal states (invalid when required) |
| --- | --- | --- |
| `simple` | Done count ≥ `minDone` (default `-1` = all) | `todo` (if below threshold) |
| `multi` | All options in `{done, na}` | `todo`, `incomplete`, `active` |
| `explicit` | All options in `{yes, no}` (no `unfilled`) | `unfilled` |

**`simple` mode completion with `minDone`:**

- If `minDone=-1` (default): All options must be `done` (strict completion)

- If `minDone=0`: Always complete (no minimum threshold)

- If `minDone=N` (where N > 0): At least N options must be `done`

- If `minDone` exceeds option count, it’s clamped to the option count

**Note:** For `multi` mode, `incomplete` and `active` are valid workflow states during
form filling but are **not** terminal states.
A completed form must have all checkbox options resolved to either `done` or `na`.

**Field group `required` attribute:**

The `required` attribute on `group` is **not supported in MF/0.1**. Groups may
have `validate` references for custom validation, but the `required` attribute should
not be used on groups.
If present, it is ignored with a warning.

#### Hook Validators

Validators are referenced by **ID** from fields/groups/form via `validate=[...]`.

**Validate attribute syntax:**

The `validate` attribute accepts an array of validator references.
Each reference can be:

1. **String** — Simple validator ID with no parameters:
   ```md
   validate=["thesis_quality"]
   ```

2. **Object** — Validator ID with parameters (Markdoc supports JSON object syntax):
   ```md
   validate=[{id: "min_words", min: 50}]
   validate=[{id: "sum_to", target: 100, tolerance: 0.1}]
   ```

3. **Mixed** — Combine both in one array:
   ```md
   validate=["format_check", {id: "min_words", min: 25}]
   ```

**Code validators (`.valid.ts`):**

- Sidecar file with same basename: `X.form.md` → `X.valid.ts`

- Loaded at runtime via [jiti](https://github.com/unjs/jiti) (~150KB, zero dependencies)

- Exports a `validators` registry mapping `validatorId -> function`

**Validator contract:**

```ts
import type { ValidatorContext, ValidationIssue } from 'markform';

/**
 * A single validator reference from the validate attribute.
 */
type ValidatorRef = string | { id: string; [key: string]: unknown };

/**
 * Context passed to each validator function.
 */
interface ValidatorContext {
  schema: FormSchema;
  values: Record<Id, FieldValue>;
  targetId: Id;              // field/group/form ID that referenced this validator
  targetSchema: Field | FieldGroup | Form;  // schema of the target (for reading custom attrs)
  params: Record<string, unknown>;          // parameters from validate ref (empty if string ref)
}

/**
 * Sidecar file exports a validators registry.
 */
export const validators: Record<string, (ctx: ValidatorContext) => ValidationIssue[]> = {
  // Parameterized validator: min word count from params
  min_words: (ctx) => {
    const min = ctx.params.min as number;
    if (typeof min !== 'number') {
      return [{ severity: 'error', message: 'min_words requires "min" parameter', ref: ctx.targetId, source: 'code' }];
    }
    const value = ctx.values[ctx.targetId];
    if (value?.kind === 'string' && value.value) {
      const wordCount = value.value.trim().split(/\s+/).length;
      if (wordCount < min) {
        return [{
          severity: 'error',
          message: `Field requires at least ${min} words (currently ${wordCount})`,
          ref: ctx.targetId,
          source: 'code',
        }];
      }
    }
    return [];
  },

  // Simple validator with no params
  thesis_quality: (ctx) => {
    const thesis = ctx.values.thesis;
    if (thesis?.kind === 'string' && thesis.value && thesis.value.length < 50) {
      return [{
        severity: 'warning',
        message: 'Investment thesis should be more detailed',
        ref: 'thesis',
        source: 'code',
      }];
    }
    return [];
  },
};
```

**Usage examples:**

```md

<!-- Parameterized: pass min word count as parameter -->

{% field kind="string" id="thesis" label="Investment thesis" validate=[{id: "min_words", min: 50}] %}{% /field %}

<!-- Multiple validators with different params -->

{% field kind="string" id="summary" label="Summary" validate=[{id: "min_words", min: 25}, {id: "max_words", max: 100}] %}{% /field %}

<!-- Sum-to validator with configurable target -->

{% group id="scenarios" validate=[{id: "sum_to", fields: ["base_prob", "bull_prob", "bear_prob"], target: 100}] %}
```

**Runtime loading (engine):**

```ts
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);

export async function loadValidators(formPath: string): Promise<ValidatorRegistry> {
  const basePath = formPath.replace(/\.form\.md$/, '');

  for (const ext of ['.valid.ts', '.valid.js']) {
    const validatorPath = basePath + ext;
    if (await fileExists(validatorPath)) {
      try {
        const mod = await jiti.import(validatorPath);
        return mod.validators ?? {};
      } catch (err) {
        // Return error as validation issue, don't crash
        return { __load_error__: () => [{
          severity: 'error',
          message: `Failed to load validators: ${err.message}`,
          source: 'code',
        }]};
      }
    }
  }
  return {};
}
```

**Caching:** Jiti caches transpiled files in `node_modules/.cache/jiti`. First load
transpiles (~~50-100ms); subsequent loads read from cache (~~5ms).

**Error handling:**

- Syntax errors in `.valid.ts` → reported as validation issue, form still loads

- Missing `validators` export → warning, continue with empty registry

- Validator throws at runtime → catch and convert to validation issue

**LLM validators (`.valid.md`) — MF/0.2:**

- Sidecar file: `X.valid.md`

- Contains prompts keyed by validator IDs

- Executed behind a flag (`--llm-validate`) with an injected model client

- Output as structured JSON issues

- Deferred to MF/0.2 to reduce scope

#### Validation Pipeline

1. Built-ins first (fast, deterministic)

2. Code validators (via jiti)

3. LLM validators (optional; MF/0.2)

#### Validation Result Model

```ts
type Severity = 'error' | 'warning' | 'info';

// Source location types for CLI/tool integration
interface SourcePosition {
  line: number;              // 1-indexed line number
  col: number;               // 1-indexed column number
}

interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

interface ValidationIssue {
  severity: Severity;
  message: string;           // Human-readable, suitable for display
  code?: string;             // Machine-readable error code (e.g., 'REQUIRED_MISSING')
  ref?: Id;                  // Field/group ID this issue relates to
  path?: string;             // Field/group ID path (e.g., "company_info.ticker")
  range?: SourceRange;       // Source location if available from Markdoc AST
  validatorId?: string;      // Which validator produced this (for hook validators)
  source: 'builtin' | 'code' | 'llm';
}
```

**Error message guidelines:**

- Messages should be actionable: “Field ‘ticker’ is required” not “Validation failed”

- Include the field label when available for human context

- Include the field ID in `ref` for programmatic access

- Use `code` for agents to handle specific error types programmatically

**Standard error codes (built-in):**

| Code | Meaning |
| --- | --- |
| `REQUIRED_MISSING` | Required field has no value |
| `NUMBER_PARSE_ERROR` | Value cannot be parsed as number |
| `NUMBER_OUT_OF_RANGE` | Number outside min/max bounds |
| `NUMBER_NOT_INTEGER` | Number has decimal when integer required |
| `PATTERN_MISMATCH` | Value doesn't match regex pattern |
| `LENGTH_OUT_OF_RANGE` | String length outside min/max bounds |
| `ITEM_COUNT_ERROR` | String-list item count outside minItems/maxItems bounds |
| `ITEM_LENGTH_ERROR` | String-list item length outside itemMinLength/itemMaxLength bounds |
| `DUPLICATE_ITEMS` | String-list contains duplicate items when uniqueItems=true |
| `SELECTION_COUNT_ERROR` | Wrong number of selections in multi-select |
| `INVALID_CHECKBOX_STATE` | Checkbox has disallowed state (e.g., `[*]` when `checkboxMode="simple"`) |
| `EXPLICIT_CHECKBOX_UNFILLED` | Explicit checkbox has unfilled options (requires yes/no for all) |
| `INVALID_OPTION_ID` | Selected option ID doesn't exist |

#### Error Taxonomy

Markform provides a structured error hierarchy for different error scenarios.
All errors extend from `MarkformError` and include context-rich information for debugging.

**Error Hierarchy:**

```
MarkformError (base)
├── MarkformParseError      — Form syntax/structure errors
├── MarkformPatchError      — Single patch validation error
├── MarkformValidationError — Multiple patch errors
├── MarkformLlmError        — LLM/API errors
├── MarkformConfigError     — Configuration errors
└── MarkformAbortError      — Form abort errors
```

**1. MarkformError** — Base error class

Base class for all markform errors. Consumers can catch this to handle any markform error.

```ts
class MarkformError extends Error {
  readonly name: string;      // Error class name
  readonly version: string;   // Markform version for debugging
}
```

**2. MarkformParseError** — Syntax and structural errors

Parse errors occur when the markdown/Markdoc syntax is malformed or the form structure
is invalid. These are detected during parsing and prevent the form from being loaded.

Examples:

- Invalid Markdoc syntax (unclosed tags, malformed attributes)
- Missing required attributes (e.g., field without `id` or `label`)
- Duplicate IDs within the form
- Invalid field state attribute value (not 'skipped' or 'aborted')
- Malformed sentinel values in value fences

```ts
class MarkformParseError extends MarkformError {
  readonly source?: string;   // File path or form identifier
  readonly line?: number;     // Line number (1-indexed)
  readonly column?: number;   // Column number (1-indexed)
}
```

**Behavior:**

- Parse errors prevent form loading
- Thrown from `parseForm()` as exceptions
- Must be fixed before the form can be used

**3. MarkformPatchError** — Single patch validation error

Thrown when an LLM generates an invalid patch value.

```ts
class MarkformPatchError extends MarkformError {
  readonly fieldId: string;       // Target field ID
  readonly patchOperation: string; // e.g., 'set_string', 'set_checkboxes'
  readonly expectedType: string;   // Expected type description
  readonly receivedValue: unknown; // Actual value received
  readonly receivedType: string;   // Type of received value
  readonly patchIndex?: number;    // Index in batch (if applicable)
}
```

**4. MarkformValidationError** — Multiple validation errors

Aggregates multiple patch errors from a single operation.

```ts
class MarkformValidationError extends MarkformError {
  readonly issues: MarkformPatchError[];  // Individual errors
  readonly fieldIds: string[];            // All affected field IDs
}
```

**Distinction from ValidationIssue:**

`ValidationIssue` represents content validation (required fields, constraints, hook
validators) and is part of normal form filling workflow.
These issues don't prevent form operations—they guide what needs to be filled next.

`MarkformParseError` and `MarkformValidationError` represent structural problems that
prevent the form from being used at all.

**5. MarkformLlmError** — LLM/API errors

Thrown for rate limits, timeouts, invalid responses, etc.

```ts
class MarkformLlmError extends MarkformError {
  readonly provider?: string;    // e.g., 'anthropic', 'openai'
  readonly model?: string;       // Model identifier
  readonly statusCode?: number;  // HTTP status code
  readonly retryable: boolean;   // Whether error is retryable
}
```

**6. MarkformConfigError** — Configuration errors

Thrown when invalid options are passed to `fillForm`, model resolver, etc.

```ts
class MarkformConfigError extends MarkformError {
  readonly option: string;        // Config option name
  readonly expectedType: string;  // Expected type/value
  readonly receivedValue: unknown; // Actual value
}
```

**7. MarkformAbortError** — Form abort errors

Thrown when a form is explicitly aborted via `abort_form` patch.

```ts
class MarkformAbortError extends MarkformError {
  readonly reason: string;     // Abort reason
  readonly fieldId?: string;   // Field that triggered abort
}
```

**Type Guards:**

For reliable error detection in bundled environments:

```ts
isMarkformError(error)     // Any markform error
isParseError(error)        // MarkformParseError
isPatchError(error)        // MarkformPatchError
isValidationError(error)   // MarkformValidationError
isLlmError(error)          // MarkformLlmError
isConfigError(error)       // MarkformConfigError
isAbortError(error)        // MarkformAbortError
isRetryableError(error)    // LLM error with retryable=true
```

**Backward Compatibility:**

`ParseError` is exported as an alias for `MarkformParseError` for backward compatibility.
Use `MarkformParseError` in new code.

* * *

## Layer 4: Tool API & Interfaces

This layer defines how agents and humans interact with forms.
It specifies:

- **Tool operations** (inspect, apply, export) and their method signatures

- **Result types** for each operation

- **Import/export formats** for form values (JSON, YAML)

- **Priority scoring** for guiding agents on what to fill next

- **Abstract interface patterns** for console, web, and agent tools

Tool definitions follow [AI SDK tool conventions][ai-sdk-tools] and can be exposed via
MCP (Model Context Protocol) for agent integration.

#### Core Operations

| Operation | Description | Returns |
| --- | --- | --- |
| **Inspect** | Get form state summary | `InspectResult` with summaries and unified issues list |
| **Apply** | Apply patches to form values | `ApplyResult` with updated summaries and issues |
| **Export** | Get structured data | `{ schema: FormSchemaJson, values: FormValuesJson }` |
| **GetMarkdown** | Get canonical form source | Markdown string |

#### Inspect and Apply Result Types

```ts
interface InspectResult {
  structureSummary: StructureSummary;   // form structure overview
  progressSummary: ProgressSummary;     // filling progress per field
  issues: InspectIssue[];               // unified list sorted by priority (ascending, 1 = highest)
  isComplete: boolean;                  // see completion formula below
  formState: ProgressState;             // overall progress state; mirrors frontmatter form_state
}

interface ApplyResult {
  applyStatus: 'applied' | 'rejected';  // 'rejected' if structural validation failed
  structureSummary: StructureSummary;
  progressSummary: ProgressSummary;
  issues: InspectIssue[];               // unified list sorted by priority (ascending, 1 = highest)
  isComplete: boolean;                  // see completion formula below
  formState: ProgressState;             // overall progress state; mirrors frontmatter form_state
}
```

**Notes:**

- Both operations return the full summaries for client convenience

- `issues` is a single sorted list; filter by `severity: 'required'` to get blockers

- `structureSummary` is static (doesn’t change after patches) but included for
  consistency

- `progressSummary` is recomputed after each patch application

- Summaries are serialized to frontmatter on every form write

- `formState` is derived from `progressSummary.counts` (see ProgressState definitions)

**Completion formula:**

`isComplete` is true when all target-role fields are either answered or skipped, there
are no aborted fields, and there are no issues with `severity: 'required'`:

```
isComplete = (answeredFields + skippedFields == totalFields for target roles)
             AND (abortedFields == 0)
             AND (no issues with severity == 'required')
```

This formula ensures:

- Agents must actively respond to every field (either fill it or explicitly skip it)

- Aborted fields block completion (they represent failures requiring intervention)

- Skipped fields won’t have values, but they won’t block completion

**Operation availability by interface:**

| Operation | CLI | AI SDK | MCP (MF/0.2) |
| --- | --- | --- | --- |
| inspect | `markform inspect` (prints YAML report) | `markform_inspect` | `markform.inspect` |
| apply | `markform apply` | `markform_apply` | `markform.apply` |
| export | `markform export --format=json` | `markform_export` | `markform.export` |
| getMarkdown | `markform apply` (writes file) | `markform_get_markdown` | `markform.get_markdown` |
| render | `markform render` (static HTML output) | — | — |
| serve | `markform serve` (interactive web UI) | — | — |

#### Patch Schema

```ts
type Patch =
  | { op: 'set_string'; fieldId: Id; value: string | null }
  | { op: 'set_number'; fieldId: Id; value: number | null }
  | { op: 'set_string_list'; fieldId: Id; value: string[] }
  | { op: 'set_checkboxes'; fieldId: Id; value: Record<OptionId, CheckboxValue> }
  | { op: 'set_single_select'; fieldId: Id; value: OptionId | null }
  | { op: 'set_multi_select'; fieldId: Id; value: OptionId[] }
  | { op: 'set_url'; fieldId: Id; value: string | null }
  | { op: 'set_url_list'; fieldId: Id; value: string[] }
  | { op: 'set_table'; fieldId: Id; value: PatchTableRow[] }
  | { op: 'set_date'; fieldId: Id; value: string | null }
  | { op: 'set_year'; fieldId: Id; value: number | null }
  | { op: 'clear_field'; fieldId: Id }
  | { op: 'skip_field'; fieldId: Id; role: string; reason?: string }
  | { op: 'abort_field'; fieldId: Id; role: string; reason?: string }
  | { op: 'add_note'; ref: Id; role: string; text: string; state?: 'skipped' | 'aborted' }
  | { op: 'remove_note'; noteId: NoteId };

// OptionId is just the local ID within the field (e.g., "ten_k", "bullish")
// NOT the qualified form—the fieldId provides the scope
type OptionId = string;
```

**Option ID scoping in patches:**

Option IDs in patches are **local to the field** specified by `fieldId`. You do NOT use
the qualified `{fieldId}.{optionId}` form in patches—the `fieldId` already provides the
scope. For example:

- `{ op: 'set_checkboxes', fieldId: 'docs_reviewed', value: { ten_k: 'done', ten_q:
  'done' } }`

- `{ op: 'set_single_select', fieldId: 'rating', value: 'bullish' }`

**Patch semantics:**

- `set_*` with `null` value: Clears the field (equivalent to `clear_field`)

- `clear_field`: Removes all values; behavior varies by field kind:

  - **string/number fields:** Clear the value fence entirely

  - **string_list field:** Clear to empty list (no value fence)

  - **single_select field:** Reset all markers to `[ ]` (no selection)

  - **multi_select field:** Reset all markers to `[ ]` (no selections)

  - **checkboxes field:** Reset to default state based on mode:

    - simple mode: all `[ ]`

    - multi mode: all `[ ]` (todo)

    - explicit mode: all `[ ]` (unfilled)

- `set_checkboxes`: Merges provided values with existing state (only specified options
  are updated)

- `set_multi_select`: Replaces entire selection array (not additive)

- `skip_field`: Explicitly skip an optional field without providing a value.
  Used when an agent cannot or should not fill a field (e.g., information not available,
  field not applicable).
  The optional `reason` field provides context.
  The required `role` field identifies who is skipping.

  **Constraints:**

  - Can only skip **optional** fields (required fields reject with error)

  - Skipping a field clears any existing value

  - A skipped field counts toward completion but has no value

  **Behavior:**

  - Response state changes to `'skipped'` in `responsesByFieldId`

  - Skipped fields no longer appear in the issues list (not blocking completion)

  - Setting a value on a skipped field clears the skip state (field becomes answered)
    and removes any notes with `state="skipped"` for that field (general notes are
    preserved)

  - Skip state is serialized to markdown via `state="skipped"` attribute

  **Completion semantics:** Form completion requires all fields to be in a terminal
  state (`answered`, `skipped`, or `aborted` for optional fields) AND `abortedFields ==
  0`. This ensures agents actively respond to every field, even if just to skip it.

- `abort_field`: Mark a field as unable to be completed (for any reason).
  Used when a field cannot be answered and should not block form completion.
  The required `role` field identifies who is aborting.
  The optional `reason` field provides context.

  **Constraints:**

  - Can be used on both required and optional fields

  - Aborting a field clears any existing value

  - An aborted field does NOT count toward completion

  **Behavior:**

  - Response state changes to `'aborted'` in `responsesByFieldId`

  - Aborted fields appear in the issues list as blocking completion

  - Setting a value on an aborted field clears the abort state (field becomes answered)
    and removes any notes with `state="aborted"` for that field (general notes are
    preserved)

  - Abort state is serialized to markdown via `state="aborted"` attribute

  **Completion semantics:** Form completion requires `abortedFields == 0`. Any aborted
  field blocks completion, requiring manual intervention to either fill the field or
  remove the abort state.

- `add_note`: Attach a note to a field, group, or form.
  The `ref` parameter specifies the target ID. The required `role` field identifies who
  created the note. The `text` field contains markdown content.
  The optional `state` field links the note to a skip or abort action.

  **Behavior:**

  - Note is added to `ParsedForm.notes` array

  - Note ID is auto-generated (n1, n2, n3 …)

  - Notes are serialized to markdown as comment blocks with metadata

  - Multiple notes can exist for the same ref

- `remove_note`: Remove a specific note by ID.

  **Behavior:**

  - Note with matching `noteId` is removed from `ParsedForm.notes`

  - If note doesn’t exist, operation is silently ignored (idempotent)

**Patch validation layers (*required*):**

Patches go through two distinct validation phases:

**1. Structural validation (pre-apply):** Checked before any patches are applied:

- `fieldId` exists in schema

- `optionId` exists for the referenced field (for select/checkbox patches)

- Value shape matches expected type (e.g., `number` for `set_number`)

- **Unknown option IDs** (*required*): For `set_checkboxes`, `set_single_select`, and
  `set_multi_select` patches, any option ID not defined in the field’s schema produces
  an `INVALID_OPTION_ID` error.
  The entire patch batch is rejected—unknown keys are never silently dropped.

If *any* patch fails structural validation:

- *required:* Entire batch is rejected (transaction semantics)

- *required:* Form state is unchanged

- *required:* Response includes `applyStatus: "rejected"` and structural issues

**2. Semantic validation (post-apply):** Checked after all patches are applied:

- Required field constraints

- Pattern/range validation

- Selection count constraints

Semantic issues do **not** prevent patch application—they are returned as
`ValidationIssue[]` for the caller to address.
This is the normal inspect/apply/fix workflow.

**Patch conflict handling:**

- Patches are applied in array order within a single `apply` call

- Later patches to the same field overwrite earlier ones (last-write-wins)

#### Inspect Results

When `inspect` runs, it returns a **single list of `InspectIssue` objects** sorted by
priority tier (ascending, where P1 = highest priority).
Priority is computed using a tiered scoring system based on field importance and issue
type.

##### Priority Scoring System

**Field Priority Weight** (optional schema attribute, defaults to `medium`):

| Field Priority | Weight |
| --- | --- |
| `high` | 3 |
| `medium` | 2 (default) |
| `low` | 1 |

**Issue Type Score:**

| Issue Reason | Score |
| --- | --- |
| `required_missing` | 3 |
| `checkbox_incomplete` | 3 (required) / 2 (recommended) |
| `validation_error` | 2 |
| `min_items_not_met` | 2 |
| `optional_unanswered` | 1 |

**Total Score** = Field Priority Weight + Issue Type Score

**Priority Tier** mapping from total score:

| Tier | Score Threshold | Console Color |
| --- | --- | --- |
| P1 | ≥ 5 | Bold red |
| P2 | ≥ 4 | Yellow |
| P3 | ≥ 3 | Cyan |
| P4 | ≥ 2 | Blue |
| P5 | ≥ 1 | Dim/gray |

**Examples** (assuming default `medium` field priority):

| Issue Type | Field Priority | Total Score | Tier |
| --- | --- | --- | --- |
| Required field missing | medium (2) | 2 + 3 = 5 | P1 |
| Validation error | medium (2) | 2 + 2 = 4 | P2 |
| Optional field empty | medium (2) | 2 + 1 = 3 | P3 |
| Required field missing | low (1) | 1 + 3 = 4 | P2 |
| Validation error | low (1) | 1 + 2 = 3 | P3 |
| Optional field empty | low (1) | 1 + 1 = 2 | P4 |

Within each tier, issues are sorted by:

1. Severity (`required` before `recommended`)

2. Score (higher scores first)

3. Ref (alphabetically for deterministic output)

The harness config controls how many issues to return (`max_issues`).

**Completion check:** A form is complete when there are no issues with `severity:
'required'`.

#### Export Schema

The `export` operation returns a JSON object with `schema` and `values` properties.

**Schema format:**

```ts
interface ExportedSchema {
  id: string;
  title?: string;
  groups: ExportedGroup[];
}

interface ExportedGroup {
  id: string;
  title?: string;
  children: ExportedField[];
}

interface ExportedField {
  id: string;
  kind: FieldKind;
  label: string;
  required: boolean;           // Always explicit: true or false
  options?: ExportedOption[];  // For single_select, multi_select, checkboxes
}

interface ExportedOption {
  id: string;
  label: string;
}
```

**Key design decisions:**

- **`required` is always explicit:** The `required` field is always present as `true` or
  `false`, never omitted.
  This makes the schema self-documenting for external consumers without requiring
  knowledge of default values.

- **Values are typed by kind:** The `values` object maps field IDs to typed value
  objects matching the field’s `kind`.

#### Value Export Formats

Value export supports two formats: **structured** (default) and **friendly** (optional).

**Structured format (default for JSON and YAML):**

The structured format uses explicit objects for each field response, eliminating
ambiguity between actual values and sentinel strings:

```json
{
  "values": {
    "company_name": { "state": "skipped" },
    "revenue_m": { "state": "aborted" },
    "quarterly_growth": { "state": "answered", "value": 12.5 },
    "ticker": { "state": "answered", "value": "ACME" }
  },
  "notes": [
    {
      "id": "n1",
      "ref": "company_name",
      "role": "agent",
      "state": "skipped",
      "text": "Not applicable for this analysis type."
    }
  ]
}
```

**YAML equivalent:**

```yaml
values:
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
notes:
  - id: n1
    ref: company_name
    role: agent
    state: skipped
    text: Not applicable for this analysis type.
```

**Friendly format (optional, with `--friendly` flag):**

The friendly format uses sentinel strings for human readability:

```yaml
values:
  company_name: "%SKIP%"
  revenue_m: "%ABORT%"
  quarterly_growth: 12.5
  ticker: ACME
```

**Format comparison:**

| Aspect | Structured (default) | Friendly |
| --- | --- | --- |
| Ambiguity | None | Possible collision with literal values |
| Machine interchange | Recommended | Not recommended |
| Human readability | Verbose | Concise |
| Notes included | Yes | Yes (separate section) |
| CLI flag | (default) | `--friendly` |

**Import behavior:**

When importing values (from YAML or JSON):

- Structured format: Parse `state` and `value` properties from each field

- Friendly format: Recognize `%SKIP%` and `%ABORT%` sentinel strings

**Export includes notes:**

All export formats include the `notes` array with all note attributes:

- `id`: Note identifier

- `ref`: Target element ID

- `role`: Who created the note

- `state`: Optional link to skip/abort action

- `text`: Note content

* * *

## References

### Markdoc

Core documentation for the Markdoc framework that powers Markform’s syntax layer:

- [What is Markdoc?][markdoc-overview] — Philosophy and “docs-as-data” rationale

- [Tag Syntax Specification][markdoc-spec] — Formal grammar for `{% tag %}` syntax

- [Syntax Guide][markdoc-syntax] — Practical syntax reference

- [Tags][markdoc-tags] — Custom tag composition and behavior

- [Attributes][markdoc-attributes] — Attribute typing and `#id` shorthand

- [Nodes][markdoc-nodes] — Node model including `fence` and `process` attribute

- [Validation][markdoc-validation] — Built-in `Markdoc.validate()` for syntax checks

- [Frontmatter][markdoc-frontmatter] — YAML frontmatter support

- [Formatting][markdoc-format] — `Markdoc.format()` for AST canonicalization

- [Render Phases][markdoc-render] — Parse → transform → render pipeline

- [Getting Started][markdoc-getting-started] — Minimal implementation reference

- [Config Objects][markdoc-config] — Registering custom tags/nodes

- [Common Examples][markdoc-examples] — Custom tag transform patterns

- [GitHub Repository][markdoc-github] — Source and AST type definitions

- [Language Server][markdoc-language-server] — Editor tooling reference

- [FAQ][markdoc-faq] — CommonMark/GFM compatibility notes

- [GitHub Discussion #261][markdoc-process-false] — `process=false` implementation
  details

Background:

- [How Stripe builds interactive docs with Markdoc][stripe-markdoc] — Production usage
  patterns

### AI SDK (Vercel)

Tool calling and agentic loop patterns:

- [Tools Foundation][ai-sdk-tools] — Tool shape (`description`, `inputSchema`,
  `execute`)

- [Tool Calling][ai-sdk-tool-calling] — Canonical tool mechanics

- [MCP Tools][ai-sdk-mcp] — Connecting to MCP servers

- [AI SDK 5 Blog][ai-sdk-5] — `stopWhen`, `stepCountIs` for loop control

- [AI SDK 6 Blog][ai-sdk-6] — `ToolLoopAgent` and step limits

### Model Context Protocol (MCP)

Server implementation references:

- [MCP Specification][mcp-spec] — Protocol definition (JSON-RPC, tools/resources)

- [MCP SDKs Overview][mcp-sdks] — Official SDK documentation

- [TypeScript SDK][mcp-typescript-sdk] — Implementation we build on

### Checkbox/Task List Conventions

Precedent for checkbox syntax:

- [GFM Task List Spec][gfm-tasklists] — Standard `[ ]`/`[x]` definition

- [GitHub Task Lists Docs][github-tasklists] — Basic syntax reference

- [GitHub About Tasklists][github-about-tasklists] — Productized tasklist features

- [Obsidian Forum Discussion][obsidian-tasks-forum] — `[/]` for “in progress”

- [Obsidian Tasks Discussion #68][obsidian-tasks-discussion] — DOING/CANCELLED status
  mapping

- [Obsidian Tasks Guide][obsidian-tasks-guide] — Custom status UX patterns

### Schema & Validation

Type system and validation vocabulary:

- [Zod Introduction][zod] — TypeScript-first schema library

- [Zod API Reference][zod-api] — Primitives and constraints

- [zod-to-json-schema] — JSON Schema generation (note deprecation warnings)

- [JSON Schema Validation (2020-12)][json-schema-validation] — Canonical validation
  keywords

- [JSON Schema Array Reference][json-schema-array] — `minItems`/`maxItems` for
  selections

* * *

<!-- Reference Link Definitions -->



<!-- Markdoc -->

[markdoc-overview]: https://markdoc.dev/docs/overview "What is Markdoc?"
[markdoc-spec]: https://markdoc.dev/spec "Markdoc Tag Syntax Specification"
[markdoc-syntax]: https://markdoc.dev/docs/syntax "The Markdoc Syntax"
[markdoc-tags]: https://markdoc.dev/docs/tags "Markdoc Tags"
[markdoc-attributes]: https://markdoc.dev/docs/attributes "Markdoc Attributes"
[markdoc-nodes]: https://markdoc.dev/docs/nodes "Markdoc Nodes"
[markdoc-validation]: https://markdoc.dev/docs/validation "Markdoc Validation"
[markdoc-frontmatter]: https://markdoc.dev/docs/frontmatter "Markdoc Frontmatter"
[markdoc-format]: https://markdoc.dev/docs/format "Markdoc Formatting"
[markdoc-render]: https://markdoc.dev/docs/render "Markdoc Render Phases"
[markdoc-getting-started]: https://markdoc.dev/docs/getting-started "Get Started with Markdoc"
[markdoc-config]: https://markdoc.dev/docs/config "Markdoc Config Objects"
[markdoc-examples]: https://markdoc.dev/docs/examples "Markdoc Common Examples"
[markdoc-github]: https://github.com/markdoc/markdoc "markdoc/markdoc on GitHub"
[markdoc-language-server]: https://github.com/markdoc/language-server "markdoc/language-server on GitHub"
[markdoc-faq]: https://markdoc.dev/docs/faq "Markdoc FAQ"
[markdoc-process-false]: https://github.com/markdoc/markdoc/discussions/261 "process=false Discussion"
[stripe-markdoc]: https://stripe.com/blog/markdoc "How Stripe builds interactive docs with Markdoc"

<!-- AI SDK -->

[ai-sdk-tools]: https://ai-sdk.dev/docs/foundations/tools "AI SDK: Tools"
[ai-sdk-tool-calling]: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling "AI SDK: Tool Calling"
[ai-sdk-mcp]: https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools "AI SDK: MCP Tools"
[ai-sdk-5]: https://vercel.com/blog/ai-sdk-5 "AI SDK 5"
[ai-sdk-6]: https://vercel.com/blog/ai-sdk-6 "AI SDK 6"

<!-- MCP -->

[mcp-spec]: https://modelcontextprotocol.io/specification/2025-11-25 "MCP Specification"
[mcp-sdks]: https://modelcontextprotocol.io/docs/sdk "MCP SDKs"
[mcp-typescript-sdk]: https://github.com/modelcontextprotocol/typescript-sdk "MCP TypeScript SDK"

<!-- Task Lists -->

[gfm-tasklists]: https://github.github.com/gfm/#task-list-items-extension- "GFM Task List Items"
[github-tasklists]: https://docs.github.com/github/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax "GitHub Basic Formatting"
[github-about-tasklists]: https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/about-tasklists "GitHub About Tasklists"
[obsidian-tasks-forum]: https://forum.obsidian.md/t/partially-completed-tasks/53258 "Obsidian: Partially Completed Tasks"
[obsidian-tasks-discussion]: https://github.com/obsidian-tasks-group/obsidian-tasks/discussions/68 "Obsidian Tasks: Add DOING Status"
[obsidian-tasks-guide]: https://obsidian.rocks/power-features-of-tasks-in-obsidian/ "Power Features of Tasks in Obsidian"

<!-- Schema/Validation -->

[zod]: https://zod.dev/ "Zod"
[zod-api]: https://zod.dev/api "Zod API"
[zod-to-json-schema]: https://github.com/StefanTerdell/zod-to-json-schema "zod-to-json-schema"
[json-schema-validation]: https://json-schema.org/draft/2020-12/json-schema-validation "JSON Schema Validation"
[json-schema-array]: https://json-schema.org/understanding-json-schema/reference/array "JSON Schema: Array"

* * *
~~~
