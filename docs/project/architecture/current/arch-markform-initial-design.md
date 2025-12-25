# Markform Technical Overview

Version: v0.1 (proof of concept)

## Context & Motivation

### What Markform Is

**Markform** is a system for **agent-friendly, human-readable, editable forms** stored
(`.form.md`) that support:

- **Structured context, schema, and form values in one text file** makes for easy and
  efficient context engineering for agents that must fill in forms

- **Incremental filling** (field-by-field or batch) to allow incrementally assembling
  and validating structured data via multiple channels or input modes (such as a tool or
  MCP server used by an agent, a CLI, a library used alongside other libraries like
  Vercel AI SDK tools, or in web UIs for users)

- **Flexible validation** at multiple scopes (field/group/form), including declarative
  constraints and external hooks (code or LLM-based)

- A **harness loop** ("auto-execute") that runs step-by-step loops for agents, making
  powerful agentic tools possible (like deep research agents that assemble validated
  output in a given structure)

- A **golden session testing framework** that validates end-to-end behavior across modes
  Markfrom tooling is itself easily tested end to end by agents

> **Why Markdoc?** Markdoc treats documents as structured data with an AST-first
> approach, enabling reliable programmatic manipulation while preserving human
> readability. See [What is Markdoc?][markdoc-overview] for the philosophy behind
> “docs-as-data” that Markform extends to “forms-as-data.”
> For how Stripe uses this approach at scale, see [How Stripe builds interactive docs
> with Markdoc][stripe-markdoc].

### Why It Exists

Plain Markdown checklists and ad-hoc templates are readable, but fragile to update
programmatically via LLMs or agents.
Simple to-do list tools are now commonly used by agents, but these do not extend to more
complex assembly of information.

The core idea is to allow two things that are increasingly essetial for advanced agentic
workflows:

- Keep a **readable text file format** (a `.form.md`) a form template or a partially or
  fully filled-in form and aligns well with existing Markdown, HTML, and React
  conventions and is token-friendly for LLMs and agents

- Have a clear schema (with field ids and defined tags) that allow **reliable machine
  edits** to fill in or validate a form via tools or API calls

### Example Use Cases

- Engineering task execution plans with checklists + structured outputs

- Quarterly earnings / 10-K analysis forms filled by an agent

- Incident triage / postmortem templates

- Research briefs, structured audits, compliance checklists

### Terminology

**Specification keywords:**

| Term | Definition |
| --- | --- |
| *required* | A constraint that MUST be satisfied. Enforced by engine validation; violations produce errors. |
| *recommended* | A convention that SHOULD be followed for consistency and best practices. Not enforced by the engine; violations do not produce errors. |

**Form states:**

| Term | Definition |
| --- | --- |
| **Template form** | A form with no values filled in (schema only). Starting point for filling. |
| **Incomplete form** | A form with some values but not yet complete or valid. |
| **Completed form** | A form with all required fields filled and passing validation. |

**Checkbox modes:**

| Term | Definition |
| --- | --- |
| **Simple checkbox** | Checkbox mode with 2 states: `todo` and `done`. GFM-compatible. |
| **Multi checkbox** | Checkbox mode with 5 states: `todo`, `done`, `incomplete`, `active`, `na`. Default mode. |
| **Explicit checkbox** | Checkbox mode requiring explicit `yes`/`no` answer for each option. No implicit "unchecked = no". |

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

## v0.1 Scope

### Goals

- **Parse + validate + serialize** a `.form.md` Markdoc document containing: form
  schema, current values (template/incomplete/completed), inline documentation blocks,
  and validator references

- **Round-trip safely**: `.form.md` → model → canonical `.form.md` (deterministic
  output)

- **Unified operation contract** used by CLI, AI SDK tools, and web UI (MCP server in
  v0.2)

- **Incremental filling**: agent/user fills one or many fields at a time; tool returns
  “what’s missing next” + validation issues

- A form-filling **harness loop** with current errors + top-priority next steps,
  supporting mock mode (deterministic) and live mode (LLM-driven)

- **Golden session tests**: record/replay multi-turn sessions with ops + snapshots

### Explicit Non-Goals for v0.1 (Proof of Concept)

- Security hardening for sensitive/PII content (explicitly deferred)

- Conditional sections / branching logic (designed for extensibility, not implemented)

- Perfect “preserve exact original formatting” round-tripping (v0.1 canonicalizes
  output)

- PDF generation pipeline (HTML is enough; PDF later via print CSS)

- Python validator runtime (reserved; TypeScript first)

* * *

## Core Architecture

Everything (CLI, MCP, AI SDK, web, tests) uses **one shared engine**:

**`MarkformEngine`**

- `parseForm(markdown: string): ParsedForm`

- `validate(form: ParsedForm, opts?): ValidationResult`

- `applyPatches(form: ParsedForm, patches: Patch[]): ApplyResult`

- `serialize(form: ParsedForm, opts?): string` (canonical)

- `exportJson(form: ParsedForm): { schema: FormSchemaJson; values: FormValuesJson }`

This boundary enables “one set of tests, many interfaces.”

* * *

## Architecture Layers

### Layer 1: Syntax and Schema (Markdoc)

Defines the **Markform document format** (`.form.md`) containing the form schema and
current filled-in state.
Built on [Markdoc’s tag syntax specification][markdoc-spec] and
[syntax conventions][markdoc-syntax].

#### File Format

- **Extension:** `.form.md` (*required*)

- **Frontmatter:** (*required*) YAML with a top-level `markform` object containing
  version and derived metadata (see [Markdoc Frontmatter][markdoc-frontmatter]).

**Frontmatter structure (v0.1):**

```yaml
---
markform:
  markform_version: "0.1.0"
  form_summary: { ... }    # derived: structure summary
  form_progress: { ... }   # derived: progress summary
  form_state: complete|incomplete|invalid|empty   # derived: overall progress state
---
```

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

**1. Structural IDs** (form, field-group, field):

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

- *required:* Identified by `(ref, kind)` combination, which must be unique

- When `kind` is omitted, it defaults to `'notes'`

- Duplicate `(ref, kind)` pairs are an error

- Multiple doc blocks can reference the same target with different `kind` values

- To reference an option, use qualified form: `ref="{fieldId}.{optionId}"`

**General conventions (*recommended*, not enforced):**

- IDs use `snake_case` (e.g., `company_info`, `ten_k`)

- Tag names use `kebab-case` (Markdoc convention, e.g., `string-field`)

#### Structural Tags

- `form` — the root container

- `field-group` — containers for fields or nested groups

#### Field Tags

Custom tags are defined following [Markdoc tag conventions][markdoc-tags]. See
[Markdoc Config][markdoc-config] for how to register custom tags.

| Tag | Description |
| --- | --- |
| `string-field` | String value; optional `required`, `pattern`, `minLength`, `maxLength` |
| `number-field` | Numeric value; optional `min`, `max`, `integer` |
| `string-list` | Array of strings (open-ended list); supports `minItems`, `maxItems`, `itemMinLength`, `itemMaxLength`, `uniqueItems` |
| `single-select` | Select one option from enumerated list |
| `multi-select` | Select multiple options; supports `minSelections`, `maxSelections` constraints |
| `checkboxes` | Stateful checklist; supports `checkboxMode` with values `multi` (5 states), `simple` (2 states), or `explicit` (yes/no); optional `minDone` for completion threshold |
| `url-field` | Single URL value with built-in format validation |
| `url-list` | Array of URLs (for citations, sources, references); supports `minItems`, `maxItems`, `uniqueItems` |

**Note on `pattern`:** The `pattern` attribute accepts a JavaScript-compatible regular
expression string (without delimiters).
Example: `pattern="^[A-Z]{1,5}$"` for a ticker symbol.

**Common attributes (all field types):**

| Attribute | Type | Description |
| --- | --- | --- |
| `id` | string | Required. Unique identifier (snake_case) |
| `label` | string | Required. Human-readable field name |
| `required` | boolean | Whether field must be filled for form completion |
| `role` | string | Target actor (e.g., `"user"`, `"agent"`). See role-filtered completion |

The `role` attribute enables multi-actor workflows where different fields are assigned
to different actors.
When running the fill harness with `targetRoles`, only fields matching those roles are
considered for completion.
See **Role-filtered completion** in the ProgressState Definitions section.

#### Option Syntax (Markform-specific)

Markdoc does **not** natively support GFM-style task list checkbox syntax.
The `[ ]` and `[x]` markers are **Markform-specific syntax** parsed within tag content.

All selection field types use checkbox-style markers for broad markdown renderer
compatibility:

| Field Type | Marker | Meaning | Example |
| --- | --- | --- | --- |
| `checkboxes` | `[ ]` | Unchecked / todo / unfilled | `- [ ] Item {% #item_id %}` |
| `checkboxes` | `[x]` | Checked / done | `- [x] Item {% #item_id %}` |
| `checkboxes` | `[/]` | Incomplete (multi only) | `- [/] Item {% #item_id %}` |
| `checkboxes` | `[*]` | Active (multi only) | `- [*] Item {% #item_id %}` |
| `checkboxes` | `[-]` | Not applicable (multi only) | `- [-] Item {% #item_id %}` |
| `checkboxes` | `[y]` | Yes (explicit only) | `- [y] Item {% #item_id %}` |
| `checkboxes` | `[n]` | No (explicit only) | `- [n] Item {% #item_id %}` |
| `single-select` | `[ ]` | Unselected | `- [ ] Option {% #opt_id %}` |
| `single-select` | `[x]` | Selected (exactly one) | `- [x] Option {% #opt_id %}` |
| `multi-select` | `[ ]` | Unselected | `- [ ] Option {% #opt_id %}` |
| `multi-select` | `[x]` | Selected | `- [x] Option {% #opt_id %}` |

**Note:** `single-select` enforces that exactly one option has `[x]`. The distinction
between `single-select` and `multi-select` is in the tag name, not the marker syntax.

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
{% checkboxes id="optional_tasks" label="Optional tasks" required=true minDone=1 %}
- [ ] Task A {% #task_a %}
- [ ] Task B {% #task_b %}
- [ ] Task C {% #task_c %}
{% /checkboxes %}
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

#### Documentation Blocks

Documentation blocks provide contextual help attached to form elements:

```md
{% doc ref="<target_id>" kind="description|instructions|notes|examples" %}
Markdown content here...
{% /doc %}
```

- `ref` (*required*): References the ID of a form, group, field, or option

- `kind` (optional): Categorizes the documentation type

**Placement rules (v0.1):**

- Doc blocks MAY appear inside `form` and `field-group` as direct children

- *required:* Parser will reject doc blocks that appear inside field tag bodies (doc
  blocks MUST NOT be nested inside a field tag)

- For field-level docs: place immediately after the field block (as a sibling within the
  group)

- Canonical serialization places doc blocks immediately after the referenced element

This keeps parsing simple: field value extraction only needs to find the `value` fence
without filtering out nested doc blocks.

**Identification:**

- Doc blocks do not have their own IDs

- *required:* `(ref, kind)` combination must be unique

- When `kind` is omitted, it defaults to `'notes'`

- Multiple doc blocks with different `kind` values can reference the same target

#### Field Values

Values are encoded differently based on field type.
The `fence` node with `language="value"` is used for scalar values (see
[Markdoc Nodes][markdoc-nodes] for fence handling).

##### String Fields

**Empty:** Omit the body entirely:
```md
{% string-field id="company_name" label="Company name" required=true %}{% /string-field %}
```

**Filled:** Value in a fenced code block with language `value`:
```md
{% string-field id="company_name" label="Company name" required=true %}
```value
ACME Corp
```
{% /string-field %}
```

##### Number Fields

**Empty:**
```md
{% number-field id="revenue_m" label="Revenue (millions)" %}{% /number-field %}
```

**Filled:** Numeric value as string in fence (parsed to number):
```md
{% number-field id="revenue_m" label="Revenue (millions)" %}
```value
1234.56
```
{% /number-field %}
```

##### Single-Select Fields

Values are encoded **inline** via `[x]` marker—at most one option may be selected (if
`required=true`, exactly one must be selected):
```md
{% single-select id="rating" label="Rating" %}
- [ ] Bullish {% #bullish %}
- [x] Neutral {% #neutral %}
- [ ] Bearish {% #bearish %}
{% /single-select %}
```

Option IDs are scoped to the field—reference as `rating.bullish`, `rating.neutral`, etc.

##### Multi-Select Fields

Values are encoded **inline** via `[x]` markers—no separate value fence:
```md
{% multi-select id="categories" label="Categories" %}
- [x] Technology {% #tech %}
- [ ] Healthcare {% #health %}
- [x] Finance {% #finance %}
{% /multi-select %}
```

##### Checkboxes Fields

Values are encoded **inline** via state markers—no separate value fence:
```md
{% checkboxes id="tasks" label="Tasks" %}
- [x] Review docs {% #review %}
- [/] Write tests {% #tests %}
- [*] Run CI {% #ci %}
- [ ] Deploy {% #deploy %}
- [-] Manual QA {% #manual_qa %}
{% /checkboxes %}
```

For simple two-state checkboxes:
```md
{% checkboxes id="agreements" label="Agreements" checkboxMode="simple" %}
- [x] I agree to terms {% #terms %}
- [ ] Subscribe to newsletter {% #newsletter %}
{% /checkboxes %}
```

For explicit yes/no checkboxes (requires answer for each):
```md
{% checkboxes id="risk_factors" label="Risk Assessment" checkboxMode="explicit" required=true %}
- [y] Market volatility risk assessed {% #market %}
- [n] Regulatory risk assessed {% #regulatory %}
- [ ] Currency risk assessed {% #currency %}
{% /checkboxes %}
```

In this example, `risk_factors.currency` is unfilled (`[ ]`) and will fail validation
because `checkboxMode="explicit"` requires all options to have explicit `[y]` or `[n]`
answers.

##### String-List Fields

String-list fields represent open-ended arrays of user-provided strings.
Items do not have individual IDs—the field has an ID and items are positional strings.

**Empty:**
```md
{% string-list id="key_commitments" label="Key commitments" minItems=1 %}{% /string-list %}
```

**Filled:** One item per non-empty line in the value fence:
```md
{% string-list id="key_commitments" label="Key commitments" minItems=1 %}
```value
Ship v1.0 by end of Q1
Complete security audit
Migrate legacy users to new platform
```
{% /string-list %}
```

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
```
{% /string-list %}

{% doc ref="top_risks" kind="instructions" %} One risk per line.
Be specific (company- or product-specific), not generic.
Minimum 5; include more if needed.
{% /doc %}
```

**Note:** The doc block is a sibling placed after the field, not nested inside it.

##### The `process=false` Attribute

**Rule:** Only emit `process=false` when the value contains Markdoc syntax.

The `process=false` attribute prevents Markdoc from interpreting content as tags.
It is only required when the value contains Markdoc tag syntax:

- Tag syntax: `{% ... %}`

> **Note:** Markdoc uses HTML comments (`

<!-- ... -->

`), not `{# ... #}`. HTML comments in form values are plain text and don't require `process=false`.

**Detection:** Check if the value matches the pattern `/\{%/`. A simple regex check
is sufficient since false positives are harmless (adding `process=false` when not needed
has no effect, but we prefer not to clutter the output).

```ts
function containsMarkdocSyntax(value: string): boolean {
  return /\{%/.test(value);
}
```

**Example (process=false required):**
```md
{% string-field id="notes" label="Notes" %}
```value {% process=false %}
Use {% tag %} for special formatting.
```
{% /string-field %}
```

**Example (process=false not needed):**
```md
{% string-field id="name" label="Name" %}
```value
Alice Johnson
```
{% /string-field %}
```

See [GitHub Discussion #261][markdoc-process-false] for background on the attribute.

#### Example: Template Form

**Minimal frontmatter (hand-authored):**

```md
---
markform:
  markform_version: "0.1.0"
---

{% form id="quarterly_earnings" title="Quarterly Earnings Analysis" %}

{% doc ref="quarterly_earnings" kind="description" %}
Prepare an earnings-call brief by extracting key financials and writing a thesis.
{% /doc %}

{% field-group id="company_info" title="Company Info" %}
{% string-field id="company_name" label="Company name" required=true %}{% /string-field %}
{% string-field id="ticker" label="Ticker" required=true %}{% /string-field %}
{% string-field id="fiscal_period" label="Fiscal period" required=true %}{% /string-field %}
{% /field-group %}

{% field-group id="source_docs" title="Source Documents" %}
{% checkboxes id="docs_reviewed" label="Documents reviewed" required=true %}
- [ ] 10-K {% #ten_k %}
- [ ] 10-Q {% #ten_q %}
- [ ] Earnings release {% #earnings_release %}
- [ ] Earnings call transcript {% #call_transcript %}
{% /checkboxes %}
{% /field-group %}

{% field-group id="financials" title="Key Financials" %}
{% number-field id="revenue_m" label="Revenue (USD millions)" required=true %}{% /number-field %}
{% number-field id="gross_margin_pct" label="Gross margin (%)" %}{% /number-field %}
{% number-field id="eps_diluted" label="Diluted EPS" required=true %}{% /number-field %}
{% /field-group %}

{% field-group id="analysis" title="Analysis" %}
{% single-select id="rating" label="Overall rating" required=true %}
- [ ] Bullish {% #bullish %}
- [ ] Neutral {% #neutral %}
- [ ] Bearish {% #bearish %}
{% /single-select %}
{% string-field id="thesis" label="Investment thesis" required=true %}{% /string-field %}
{% /field-group %}

{% /form %}
```

**Note:** When the engine serializes this form, it will add `form_summary`,
`form_progress`, and `form_state` to the `markform` block automatically.
Hand-authored forms only need the `markform_version`.

#### Example: Incomplete Form

```md
{% field-group id="company_info" title="Company Info" %}
{% string-field id="company_name" label="Company name" required=true %}
```value
ACME Corp
```
{% /string-field %} {% string-field id="ticker" label="Ticker" required=true %}
```value
ACME
```
{% /string-field %} {% string-field id="fiscal_period" label="Fiscal period"
required=true %}{% /string-field %} {% /field-group %}

{% field-group id="source_docs" title="Source Documents" %} {% checkboxes
id="docs_reviewed" label="Documents reviewed" required=true %}

- [x] 10-K {% #ten_k %}

- [x] 10-Q {% #ten_q %}

- [/] Earnings release {% #earnings_release %}

- [ ] Earnings call transcript {% #call_transcript %} {% /checkboxes %} {% /field-group
  %}
```

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

**v0.1 scope:** Only HTML comments are guaranteed to be preserved. Do not rely on
non-Markform content surviving serialization. Future versions may support full
content preservation via raw slicing.

#### Serialization Strategy

Generate markdown string directly (not using `Markdoc.format()` due to canonicalization
requirements beyond what it provides—see [Formatting][markdoc-format]):

**v0.1 content restrictions for canonical serialization (*required*):**

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
| `process=false` | Emit only when value contains Markdoc tag syntax (`/\{%/`) |
| Option ordering | Preserved as authored (order is significant) |
| Line endings | Unix (`\n`) only |
| Doc block placement | Immediately after the referenced element |

* * *

### Layer 2: Data Model

#### Canonical TypeScript Types

```ts
type Id = string; // validated snake_case, e.g., /^[a-z][a-z0-9_]*$/

// Validator reference: simple string ID or parameterized object
type ValidatorRef = string | { id: string; [key: string]: unknown };

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
  kind: 'field_group';
  id: Id;
  title?: string;
  // Note: `required` on groups is not supported in v0.1 (ignored with warning)
  validate?: ValidatorRef[];  // validator references (string IDs or parameterized objects)
  children: Field[];          // v0.1/v0.2: fields only; nested groups deferred (future)
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
}

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

interface DocumentationBlock {
  ref: Id | QualifiedOptionRef;  // form/group/field ID, or qualified option ref
  kind: 'description' | 'instructions' | 'notes' | 'examples';  // defaults to 'notes' when omitted
  bodyMarkdown: string;
}

// IdIndexEntry: lookup entry for fast ID resolution and validation
// NOTE: Options are NOT indexed here (they are field-scoped, not globally unique)
// Use StructureSummary.optionsById for option lookup via QualifiedOptionRef
interface IdIndexEntry {
  kind: 'form' | 'group' | 'field';
  parentId?: Id;           // parent group/form ID (undefined for form)
}

// Skip state for a field (stored separately from values)
interface SkipInfo {
  skipped: boolean;
  reason?: string;
}

// ParsedForm: canonical internal representation returned by parseForm()
interface ParsedForm {
  schema: FormSchema;
  valuesByFieldId: Record<Id, FieldValue>;
  skipsByFieldId: Record<Id, SkipInfo>;   // skip state per field (runtime metadata)
  docs: DocumentationBlock[];
  orderIndex: Id[];                       // fieldIds in document order (deterministic)
  idIndex: Map<Id, IdIndexEntry>;         // fast lookup for form/group/field (NOT options)
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
  | 'optional_empty';        // Optional field with no value

// Mapping from ValidationIssue to InspectIssue:
// - ValidationIssue.severity='error' → InspectIssue.severity='required'
// - ValidationIssue.severity='warning'/'info' → InspectIssue.severity='recommended'
// - Missing optional fields → severity='recommended', reason='optional_empty'
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
  groupCount: number;           // total field-groups
  fieldCount: number;           // total fields (all types)
  optionCount: number;          // total options across all select/checkbox fields

  fieldCountByKind: Record<FieldKind, number>;  // breakdown by field type

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
// Progress state for a field or the whole form
type ProgressState = 'empty' | 'incomplete' | 'invalid' | 'complete';

interface FieldProgress {
  kind: FieldKind;             // field type
  required: boolean;           // whether field has required=true

  submitted: boolean;          // whether any value has been provided ("answered")
  state: ProgressState;        // computed progress state
  valid: boolean;              // true iff no validation issues for this field
  issueCount: number;          // count of ValidationIssues referencing this field

  skipped: boolean;            // true if explicitly skipped via skip_field patch
  skipReason?: string;         // reason provided in skip_field patch

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

  submittedFields: number;       // fields that have been submitted (have values)

  completeFields: number;        // fields in 'complete' state
  incompleteFields: number;      // fields in 'incomplete' state
  invalidFields: number;         // fields in 'invalid' state

  emptyRequiredFields: number;   // required fields with no value
  emptyOptionalFields: number;   // optional fields with no value

  answeredFields: number;        // same as submittedFields (clearer terminology)
  skippedFields: number;         // fields explicitly skipped via skip_field
}
```

##### ProgressState Definitions

The `ProgressState` is computed deterministically based on submission status, validation
result, and completeness rules:

| State | Meaning |
| --- | --- |
| `empty` | Not submitted (no value provided) |
| `incomplete` | Submitted but fails completeness rules (e.g., minItems not met, required checkbox not terminal) |
| `invalid` | Submitted but fails validation (type/pattern/range errors or hook issues) |
| `complete` | Satisfies completeness rules and passes validation |

**Submission rules (deterministic, per field kind):**

| Field Kind | Submitted when |
| --- | --- |
| `string` | `value !== null && value.trim().length > 0` |
| `number` | `value !== null` |
| `single_select` | `selected !== null` |
| `multi_select` | `selected.length > 0` |
| `string_list` | `items.length > 0` |
| `checkboxes` | At least one option state differs from initial (`todo` for multi/simple, `unfilled` for explicit) |

**Completeness rules (for required fields):**

Completeness is relevant only when `required=true`. A submitted field is complete if:

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
if not submitted:
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
if counts.submittedFields == 0:
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

| Field Type | Implicit Required When |
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

  isComplete = for all f in roleFilteredFields:
    f.state == 'complete'  OR
    f.state == 'skipped'   OR
    (!f.required && f.state == 'empty')
```

This is critical for forms where the user fills some fields first, then the agent fills
the remaining agent-role fields.
Without role filtering, the harness would incorrectly report the form as incomplete even
after all agent fields are filled, because user fields (intended for a different actor)
would still be empty.

**Field states for completion purposes:**

| State | Counts as Complete | Notes |
| --- | --- | --- |
| `complete` | Yes | Field has valid value (answered) |
| `skipped` | Yes | Explicitly skipped via `skip_field` patch (tracked in `FieldProgress.skipped`, not a `ProgressState` value) |
| `empty` (non-required) | No | Optional field left unfilled—must be answered OR skipped |
| `empty` (required) | No | Required field must be answered (cannot be skipped) |
| `incomplete` | No | Partially filled (e.g., list with fewer items than `minItems`) |
| `invalid` | No | Has validation errors |

**Note:** The completion formula requires every field to be either *answered* (has
value) or *skipped* (explicitly marked).
Simply leaving an optional field empty does NOT count toward completion—the agent must
actively skip it. This ensures agents acknowledge every field in the form.

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

const SkipInfoSchema = z.object({
  skipped: z.boolean(),
  reason: z.string().optional(),
});

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
  submitted: z.boolean(),
  state: ProgressStateSchema,
  valid: z.boolean(),
  issueCount: z.number().int().nonnegative(),
  skipped: z.boolean(),                          // true if explicitly skipped
  skipReason: z.string().optional(),             // reason from skip_field patch
  checkboxProgress: CheckboxProgressCountsSchema.optional(),
});

const ProgressCountsSchema = z.object({
  totalFields: z.number().int().nonnegative(),
  requiredFields: z.number().int().nonnegative(),
  submittedFields: z.number().int().nonnegative(),
  completeFields: z.number().int().nonnegative(),
  incompleteFields: z.number().int().nonnegative(),
  invalidFields: z.number().int().nonnegative(),
  emptyRequiredFields: z.number().int().nonnegative(),
  emptyOptionalFields: z.number().int().nonnegative(),
  answeredFields: z.number().int().nonnegative(),   // same as submittedFields
  skippedFields: z.number().int().nonnegative(),    // explicitly skipped fields
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

- `markformVersion` → `markform_version`

- `formSummary` → `form_summary`

- `formProgress` → `form_progress`

- `formState` → `form_state`

- `fieldCountByKind` → `field_count_by_kind`

- etc.

Use a `toSnakeCaseDeep()` helper for deterministic conversion at the frontmatter
boundary.

#### Comprehensive Field Type Reference

This section provides a complete mapping between Markdoc syntax, TypeScript types, and
schema representations for all field types.

##### Naming Conventions

| Layer | Convention | Example |
| --- | --- | --- |
| Markdoc tag names | kebab-case | `string-field`, `multi-select` |
| Markdoc attributes | camelCase | `minLength`, `checkboxMode`, `minItems` |
| TypeScript interfaces | PascalCase | `StringField`, `MultiSelectField` |
| TypeScript properties | camelCase | `minLength`, `checkboxMode` |
| JSON Schema keywords | camelCase | `minItems`, `maxLength`, `uniqueItems` |
| IDs (values) | snake_case | `company_name`, `ten_k`, `quarterly_earnings` |
| YAML keys (frontmatter, session transcripts) | snake_case | `markform_version`, `form_summary`, `field_count_by_kind` |
| TypeScript kind values | snake_case | `'string'`, `'single_select'` |
| Patch operations | snake_case | `set_string`, `set_single_select` |

**Rationale:** Using camelCase for Markdoc attributes aligns with JSON Schema keywords
and TypeScript conventions, eliminating translation overhead.
IDs remain snake_case as they are data values, not code identifiers.
YAML keys use snake_case for readability and consistency with common YAML conventions.

##### Field Type Mappings

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
| Patch operation | `{ op: 'set_string_list'; fieldId: Id; items: string[] }` |
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
| Patch operation | `{ op: 'set_single_select'; fieldId: Id; selected: OptionId \| null }` |
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
| Patch operation | `{ op: 'set_multi_select'; fieldId: Id; selected: OptionId[] }` |
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
| Patch operation | `{ op: 'set_checkboxes'; fieldId: Id; values: Record<OptionId, CheckboxValue> }` |
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
| Zod | `z.string().url()` |
| JSON Schema | `{ type: "string", format: "uri" }` |

**`url-list`** — Array of URLs (for citations, sources, references)

| Aspect | Value |
| --- | --- |
| Markdoc tag | `url-list` |
| TypeScript interface | `UrlListField` |
| TypeScript kind | `'url_list'` |
| Attributes | `id`, `label`, `required`, `minItems`, `maxItems`, `uniqueItems` |
| FieldValue | `{ kind: 'url_list'; items: string[] }` |
| Patch operation | `{ op: 'set_url_list'; fieldId: Id; items: string[] }` |
| Zod | `z.array(z.string().url()).min(n).max(m)` |
| JSON Schema | `{ type: "array", items: { type: "string", format: "uri" }, minItems, maxItems, uniqueItems }` |

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

### Layer 3: Validation

Validation happens at two levels: Markdoc syntax validation (see
[Markdoc Validation][markdoc-validation]) and Markform semantic validation.

#### Built-in Deterministic Validation

Schema checks (always available, deterministic):

| Check | Field Type | Constraint Source |
| --- | --- | --- |
| Required fields present | All | `required=true` attribute |
| Number parsing success | `number-field` | Built-in |
| Min/max value range | `number-field` | `min`, `max` attributes |
| Integer constraint | `number-field` | `integer=true` attribute |
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

The `required` attribute has specific semantics for each field type.
This section provides normative definitions:

| Field Type | `required=true` means | `required=false` (or omitted) means |
| --- | --- | --- |
| `string-field` | `value !== null && value.trim() !== ""` | Value may be null or empty |
| `number-field` | `value !== null` (and parseable as number) | Value may be null |
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

The `required` attribute on `field-group` is **not supported in v0.1**. Groups may have
`validate` references for custom validation, but the `required` attribute should not be
used on groups. If present, it is ignored with a warning.

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

{% string-field id="thesis" label="Investment thesis" validate=[{id: "min_words", min: 50}] %}{% /string-field %}

<!-- Multiple validators with different params -->

{% string-field id="summary" label="Summary" validate=[{id: "min_words", min: 25}, {id: "max_words", max: 100}] %}{% /string-field %}

<!-- Sum-to validator with configurable target -->

{% field-group id="scenarios" validate=[{id: "sum_to", fields: ["base_prob", "bull_prob", "bear_prob"], target: 100}] %}
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

**LLM validators (`.valid.md`) — v0.2:**

- Sidecar file: `X.valid.md`

- Contains prompts keyed by validator IDs

- Executed behind a flag (`--llm-validate`) with an injected model client

- Output as structured JSON issues

- Deferred to v0.2 to reduce scope

#### Validation Pipeline

1. Built-ins first (fast, deterministic)

2. Code validators (via jiti)

3. LLM validators (optional; v0.2)

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

* * *

### Layer 4: Tool Layer

The tool layer is the public API contract for agents and CLI. Tool definitions follow
[AI SDK tool conventions][ai-sdk-tools] with Zod schemas for `inputSchema`.

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

`isComplete` is true when all target-role fields are either answered or skipped, and
there are no issues with `severity: 'required'`:

```
isComplete = (answeredFields + skippedFields == totalFields for target roles)
             AND (no issues with severity == 'required')
```

This formula ensures agents must actively respond to every field (either fill it or
explicitly skip it) before the form is considered complete.
Skipped fields won’t have values, but they won’t block completion either.

**Operation availability by interface:**

| Operation | CLI | AI SDK | MCP (v0.2) |
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
  | { op: 'set_string_list'; fieldId: Id; items: string[] }
  | { op: 'set_checkboxes'; fieldId: Id; values: Record<OptionId, CheckboxValue> }
  | { op: 'set_single_select'; fieldId: Id; selected: OptionId | null }
  | { op: 'set_multi_select'; fieldId: Id; selected: OptionId[] }
  | { op: 'set_url'; fieldId: Id; value: string | null }
  | { op: 'set_url_list'; fieldId: Id; items: string[] }
  | { op: 'clear_field'; fieldId: Id }
  | { op: 'skip_field'; fieldId: Id; reason?: string };

// OptionId is just the local ID within the field (e.g., "ten_k", "bullish")
// NOT the qualified form—the fieldId provides the scope
type OptionId = string;
```

**Option ID scoping in patches:**

Option IDs in patches are **local to the field** specified by `fieldId`. You do NOT use
the qualified `{fieldId}.{optionId}` form in patches—the `fieldId` already provides the
scope. For example:

- `{ op: 'set_checkboxes', fieldId: 'docs_reviewed', values: { ten_k: 'done', ten_q:
  'done' } }`

- `{ op: 'set_single_select', fieldId: 'rating', selected: 'bullish' }`

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

  **Constraints:**

  - Can only skip **optional** fields (required fields reject with error)

  - Skipping a field clears any existing value

  - A skipped field counts toward completion but has no value

  **Behavior:**

  - Skip state is stored in `skipsByFieldId` on ParsedForm (runtime metadata)

  - Skipped fields no longer appear in the issues list (not blocking completion)

  - Setting a value on a skipped field clears the skip state (field becomes answered)

  - Skip state is not serialized to the form markdown file

  **Completion semantics:** Form completion requires: `answeredFields + skippedFields ==
  totalFields` (for target roles) AND no required issues.
  This ensures agents actively respond to every field, even if just to skip it.

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
| `optional_empty` | 1 |

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

* * *

### Layer 5: Execution (Harness Loop)

The harness wraps the engine with a stable “step” protocol for bite-sized actions.
**Each turn is stateless:** the agent receives the full serialized form plus remaining
issues each turn—no conversation history is maintained.
The form itself IS the state.

#### Harness State Machine

```
┌─────────┐
│  INIT   │
└────┬────┘
     │ load form
     ▼
┌─────────┐  no required   ┌──────────┐
│  STEP   │───────────────►│ COMPLETE │
└────┬────┘    issues      └──────────┘
     │ has required issues
     ▼
┌─────────┐
│  WAIT   │◄───────────────┐
└────┬────┘                │
     │ receive patches     │
     ▼                     │
┌─────────┐   revalidate   │
│  APPLY  │────────────────┘
└─────────┘
```

**Note:** v0.1 runs until completion (all required fields valid, no errors).
A default `max_turns` safety limit (e.g., 100) should be enforced to prevent runaway
loops during development and testing.
Exceeding `max_turns` results in an error state.

**Error Behavior:**

| Condition | Harness Status | CLI Exit Code |
| --- | --- | --- |
| Form completed successfully | `'complete'` | 0 |
| `max_turns` exceeded | `'max_turns_exceeded'` | 1 |
| Agent/LLM error | `'error'` | 1 |
| User cancelled | `'cancelled'` | 130 |

The harness returns a `HarnessResult` with `status` and optional `error` fields:

```ts
interface HarnessResult {
  status: 'complete' | 'max_turns_exceeded' | 'error' | 'cancelled';
  error?: Error;           // present when status is 'error'
  turnCount: number;       // total turns executed
  outputPath?: string;     // path to output file (when complete)
}
```

Integration tests can check `result.status` to verify expected outcomes without parsing
console output.

#### Harness Contract

The harness manages the form-filling loop but does not maintain session state beyond the
form itself. **The serialized form is the single source of truth.**

```ts
interface StepResult {
  structureSummary: StructureSummary;   // form structure overview (static)
  progressSummary: ProgressSummary;     // current filling progress (includes answeredFields, skippedFields)
  issues: InspectIssue[];               // unified list sorted by priority (ascending, 1 = highest)
  stepBudget: number;                   // suggested patches this turn (from config)
  isComplete: boolean;                  // true per completion formula (all fields answered/skipped, no required issues)
  turnNumber: number;
}
```

**Key behaviors:**

- `harness.step()` returns current state including summaries + issues

- `issues` is a single sorted list; filter by `severity: 'required'` to get blockers

- `stepBudget` comes from config (`max_patches_per_turn`), not computed dynamically

- Agent/user applies patches via `harness.apply(patches)`

- Harness revalidates and returns next `StepResult` with updated `progressSummary`

- Summaries allow agents/UIs to quickly display progress without parsing the full form

**Form-as-state principle:**

The harness does not track conversation history or accumulate context across turns.
Instead:

- Each turn, the agent receives the full serialized form (current state) + issues

- This is structurally equivalent to `markform inspect` output

- After patches are applied, the form is re-serialized with updated values

- The next turn sees the updated form, not a diff or delta

This design keeps turns short and controlled, enables easy debugging (any turn can be
replayed from its form snapshot), and avoids context window growth in long sessions.

#### Mocked Mode

- Uses a completed mock file: `X.mock.filled.form.md`

- Mock agent parses completed mock values and on each harness step picks recommended
  fields and applies patches using those values

- Deterministic and perfect for golden tests

- No LLM calls required

#### Stateless Turn Context Design

A key architectural decision is that **each agent turn is stateless**. The agent does
not maintain conversation history across turns.
Instead, the full form context is provided fresh each turn:

**Turn Context = Full Form Markdown + Remaining Issues**

This mirrors what `markform inspect` outputs, making each turn self-contained:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Turn N Context (User Prompt)                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ # Current Form State                                                         │
│                                                                              │
│ Below is the complete form with all currently filled values.                 │
│ Fields marked with `[ ]` or empty values still need to be filled.            │
│                                                                              │
│ ```markdown                                                                  │
│ ---                                                                          │
│ markform:                                                                    │
│   markform_version: "0.1.0"                                                  │
│   form_state: incomplete                                                     │
│   ...                                                                        │
│ ---                                                                          │
│ {% form id="example" %}                                                      │
│ {% string-field id="name" label="Name" %}                                    │
│ ```value                                                                     │
│ Alice                                                                        │
│ ```                                                                          │
│ {% /string-field %}                                                          │
│ {% string-field id="email" label="Email" %}{% /string-field %}              │
│ ...                                                                          │
│ {% /form %}                                                                  │
│ ```                                                                          │
│                                                                              │
│ # Remaining Issues                                                           │
│                                                                              │
│ - **email** (field): Required field 'Email' has no value                     │
│   Severity: required, Priority: P1                                           │
│   Type: string                                                               │
│ ...                                                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Why stateless turns?**

1. **The form IS the state** — All filled values, progress, and structure are encoded in
   the serialized form markdown.
   No separate state tracking needed.

2. **Simpler implementation** — No conversation history management, memory limits, or
   context window concerns across turns.

3. **Debuggable** — Each turn’s context is complete and self-contained.
   You can replay any turn by providing its form snapshot.

4. **Consistent with inspect** — The turn context is structurally identical to what
   `markform inspect` outputs, enabling agents to understand form state the same way
   humans do via CLI.

5. **Token efficient for iterative fills** — While each turn includes the full form,
   this is typically smaller than accumulated conversation history for multi-turn
   sessions.

**Implementation:**

The agent receives the serialized form (via `serialize(form)`) plus the remaining issues
list as its prompt each turn.
After generating patches, the harness applies them, revalidates, and provides the
updated form for the next turn.

#### Live Mode (AI SDK)

Uses [AI SDK tool calling][ai-sdk-tool-calling] with agentic loop control from
[AI SDK 5][ai-sdk-5] and [AI SDK 6][ai-sdk-6]:

- Each turn is stateless—the agent sees the full form markdown + remaining issues

- The form itself carries all state (filled values, validation status, progress)

- No conversation history is accumulated between turns

- Define a `generatePatches` tool using AI SDK `tool({ inputSchema: zod })`

- Control multi-step behavior with `stopWhen: stepCountIs(k)` for “1–3 tool calls per
  turn” (see [AI SDK 5][ai-sdk-5] for `stepCountIs`)

- Agent analyzes form state and issues, then calls `generatePatches` with patches

- Harness applies patches, revalidates, serializes updated form

- Next turn receives fresh context with updated form state

- Repeat until complete (no required issues remaining)

**Turn flow:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Turn N                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   1. Harness serializes current form state                                  │
│      └─► Full markdown with frontmatter, values, structure                  │
│                                                                             │
│   2. Harness provides context prompt                                        │
│      └─► Form markdown + remaining issues (like `inspect` output)           │
│                                                                             │
│   3. LLM analyzes context, calls generatePatches tool                       │
│      └─► Returns array of Patch objects                                     │
│                                                                             │
│   4. Harness applies patches to form                                        │
│      └─► Updates values, revalidates, computes new progress                 │
│                                                                             │
│   5. Check completion                                                       │
│      └─► If no required issues: DONE                                        │
│      └─► Otherwise: Go to Turn N+1 with updated form                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

* * *

### Layer 6: Testing Framework (Golden Sessions)

Provides a unified testing approach covering parsing/serialization, tool operations,
validation behavior, harness behavior, and all adapters.

#### Golden Session Format

A golden test is a YAML file containing:

- Initial artifacts (`.form.md` and validators)

- Sequence of steps/turns with operations, issues, and resulting form snapshot/diff

#### Session Transcript Schema

Session transcripts record the form state at each turn, not conversation history.
Since each turn is stateless, the transcript captures the form snapshot (or hash) and
patches applied at each step.

```yaml
session_version: 0.1
mode: mock  # mock | live (see explanation below)
form:
  path: examples/earnings-analysis/earnings-analysis.form.md
validators:
  code: examples/earnings-analysis/earnings-analysis.valid.ts  # optional
mock:
  completed_mock: examples/earnings-analysis/earnings-analysis.mock.filled.form.md

harness:
  max_issues: 5              # max issues to return per turn
  max_patches_per_turn: 3    # stepBudget value
  max_turns: 100             # safety limit (default: 100)

turns:
  - turn: 1
    # Form state at start of turn (what agent sees)
    form_state: incomplete          # from frontmatter form_state
    required_issues_before: 5       # count of severity: required issues
    # Patches generated by agent
    patches:
      - { op: set_string, fieldId: company_name, value: "ACME Corp" }
    # State after patches applied
    after:
      required_issues_remaining: 4
      form_state: incomplete
      markdown_sha256: "..."        # for deterministic verification
    # Optional: LLM stats for live sessions
    stats:
      input_tokens: 1234
      output_tokens: 456
      tool_calls: 1

final:
  expect_complete: true
  expected_completed_form: examples/earnings-analysis/earnings-analysis.mock.filled.form.md
```

**Mode field semantics:**

| Mode | Purpose | `turns` field | Reproducible |
| --- | --- | --- | --- |
| `mock` | CI testing with deterministic values | Pre-recorded, replayed exactly | ✅ Yes |
| `live` | Development logging of real LLM sessions | Recorded during execution | ❌ No |

For `mode: live`, the session transcript is an **output** (recorded log), not an input
for replay. Live sessions are useful for debugging but not for CI assertions.

**Note on stateless recording:** Since each turn is stateless (agent receives full form
each time), the transcript does not need to record conversation messages.
The form markdown at each turn can be reconstructed by applying patches sequentially
from the initial template, or by storing the `markdown_sha256` for verification.

#### Test Modes

**A) Mocked mode (CI-friendly):**

- Check in: `X.form.md` (template), `X.mock.filled.form.md` (completed mock),
  `X.session.yaml`

- Mock agent reads completed mock and plays back values by issuing tool calls

- Final assertion: resulting completed form matches completed mock exactly

**B) Live mode (developer workflow):**

- Run harness with a real model

- Produces session transcript

- Useful for exploratory testing, not strict CI

* * *

## Interfaces

### CLI Commands (v0.1)

Thin wrapper around the tool contract:

**Core commands (required for v0.1):**

- `markform inspect <file.form.md>` — parse + run validators, print full report as YAML
  (structure summary, progress summary, form state, and all issues in priority order).
  This is the canonical way to check form status at any time.

- `markform apply <file.form.md> --patch <json>` — apply patches, write canonical file

- `markform export <file.form.md> --format=json` — print `{schema, values}`

- `markform render <file.form.md> [-o <file.html>]` — render form as static HTML output:

  - Default output: same stem with `.form.html` extension (e.g., `simple.form.md` →
    `simple.form.html`)

  - Use `-o` / `--output` to specify custom output path

  - Shares rendering logic with serve command

  - Useful for sharing/archiving forms without running a server

- `markform serve [<file.form.md>]` — start a local web UI for interactive form editing:

  - Opens browser automatically (use `--no-open` to disable)

  - Interactive HTML form elements for all field types

  - Save writes to a new versioned filename (never overwrites the source)

  - Version naming: if the stem ends with a version pattern (e.g., `-v1`, `_v2`, ` v3`),
    extract and increment the number; otherwise append `-v1`

  - Examples:

    - `earnings-analysis.form.md` → `quarterly-v1.form.md` → `quarterly-v2.form.md`

    - `report_v5.form.md` → `report_v6.form.md`

    - `draft v12.form.md` → `draft v13.form.md`

- `markform fill <file.form.md> --mock --mock-source <file>` — fill form using mock
  agent, write session transcript

- `markform fill <file.form.md> --model=anthropic/claude-sonnet-4-5` — fill form using
  live LLM agent

**Deferred to v0.2:**

- **Validation in serve** — Run engine validation from the UI with a “Validate” button.
  Requires deciding on validator execution strategy (see Future Considerations for
  research on server-executed vs baked validators).

- **JSON endpoints** — Expose inspect/apply/export as HTTP endpoints for programmatic
  clients.

- **Harness controls** — Step through the harness loop from the UI.

### Web UI (serve)

The v0.1 “serve” command provides an interactive web UI for editing and saving forms:

- Opens browser automatically (use `--no-open` to disable)

- Renders all field types as interactive HTML form elements:

  - String fields → `<input type="text">` with minLength/maxLength

  - Number fields → `<input type="number">` with min/max/step

  - String list fields → `<textarea>` with one item per line

  - Single-select → `<select>` dropdown with options

  - Multi-select → checkboxes for each option

  - Checkboxes (simple mode) → HTML checkboxes (checked/unchecked)

  - Checkboxes (multi mode) → select dropdowns with 5 states
    (todo/done/active/incomplete/na)

  - Checkboxes (explicit mode) → select dropdowns with yes/no/unfilled

- Pre-fills current values from the form file

- Form submission via POST /save:

  - Applies patches from form data to the in-memory form state

  - Canonicalizes and writes to a new versioned filename (never overwrites original)

  - Version naming: if stem ends with `-vN`, `_vN`, or ` vN`, increment N; otherwise
    append `-v1`

  - Returns JSON response with success status and output path

- CSS styling provides clean, readable form layout

**Deferred to v0.2:**

- Validation in serve (run engine validation from UI with a “Validate” button)

- JSON endpoints for programmatic access

- Harness controls (step through the harness loop from the UI)

Use `markform inspect <file>` from the CLI at any time to get a full report (YAML with
summaries, form state, and prioritized issues).

### AI SDK Integration

Helper: `createMarkformTools({ sessionStore, validatorRegistry, ... })`

Returns an AI SDK `ToolSet` with:

- `markform_inspect`

- `markform_apply`

- `markform_export`

- `markform_get_markdown` (optional)

### MCP Server Integration (v0.2)

Built on the [Model Context Protocol Specification][mcp-spec] using the
[official TypeScript SDK][mcp-typescript-sdk]. See [MCP SDKs overview][mcp-sdks] for
client/server patterns.

Tools correspond to the same operations:

- `markform.inspect`

- `markform.apply`

- `markform.export`

- `markform.get_markdown`

**Transport:** stdio for local CLI integration (see MCP transports documentation).

**AI SDK interop:** Use [AI SDK MCP tools][ai-sdk-mcp] to connect AI SDK agents to the
Markform MCP server.

* * *

## NPM Package

First release as **`markform`** on npm.

v0.1 includes:

- Core library

- CLI binary

- Golden test runner

**Key dependencies:**

- `@markdoc/markdoc` — parsing and AST

- `zod` — schema validation

- `jiti` — runtime TypeScript loading for `.valid.ts` validators

- `yaml` — YAML parsing/serialization for frontmatter and CLI output

Future split into `markform-cli`, `markform-ai-sdk`, etc.
is optional later.

* * *

## Golden Example Set for v0.1

### Example 1: `quarterly_earnings_analysis` (mocked)

Files:

- `examples/earnings-analysis/earnings-analysis.form.md` (template form)

- `examples/earnings-analysis/earnings-analysis.mock.filled.form.md` (completed mock
  with checkbox states and values)

- `examples/earnings-analysis/earnings-analysis.valid.ts` (code validators)

- `examples/earnings-analysis/earnings-analysis.session.yaml` (session transcript)

### Example 2: Small smoke test form

A tiny form for fast debugging:

- One group, one checkbox set, one string field

- A session with 2 turns

These validate: parsing, serialization stability, checkbox multi-state handling, select
parsing, tool patches, harness logic.

* * *

## Implementation Order

### 1) Core Zod schemas + TypeScript types

`FormSchema`, `Field`, `Values`, `DocumentationBlock`, `Patch`, `ValidationIssue`,
`SessionYaml`, `StructureSummary`, `ProgressSummary`, `MarkformFrontmatter`

Deliverable: `engine/types.ts` + `engine/schemas.ts`

### 2) Markdoc parsing to canonical model

Frontmatter parsing, AST walk, extract tags/options/values, semantic validation

Deliverable: `engine/parse.ts`

### 3) Canonical serialization

Deterministic output, omit empty value fences, `#id` annotations.
Include `form_summary` and `form_progress` in frontmatter (computed during serialize).

Deliverable: `engine/serialize.ts`

### 4) Built-in validation + inspect heuristic + summaries

Required, numeric, select constraints, completion stats, issue prioritization.
Implement `computeStructureSummary(schema)` and `computeProgressSummary(schema, values,
issues)`.

Deliverable: `engine/validate.ts` + `engine/inspect.ts` + `engine/summaries.ts`

### 5) Patch application

Apply patches, validate correctness, return updated `ParsedForm`

Deliverable: `engine/apply.ts`

### 6) Harness

Step protocol, mocked agent mode, live agent mode interface

Deliverable: `harness/harness.ts` + `harness/mockAgent.ts`

### 7) Golden session runner

Record: run harness, emit session transcript + final form.
Replay: load session, replay patches, verify snapshots.

Deliverable: `tests/goldenRunner.ts`

### 8) CLI

`inspect`, `apply`, `export`, `render`, `serve`, `fill`

Deliverable: `cli/commands/*`

### 9) AI SDK tools

Tool set using AI SDK `tool()` + Zod input schemas

Deliverable: `integrations/ai-sdk.ts`

### 10) MCP server mode (v0.2)

MCP tools for inspect/apply/export using TS SDK, stdio transport

Deliverable: `integrations/mcp.ts`

**Note:** Deferred to v0.2 to reduce v0.1 scope.
Full specification included above.

* * *

## What “Done” Looks Like for v0.1

1. Write `earnings-analysis.form.md` (template) and
   `earnings-analysis.mock.filled.form.md` (completed mock)

2. Run:

   - `markform inspect examples/earnings-analysis/earnings-analysis.form.md` — prints
     YAML report with structure summary, progress summary, form state, and all issues in
     priority order

   - `markform serve examples/earnings-analysis/earnings-analysis.form.md` — open the
     browser, browse the form; Save to confirm output path (defaults to
     `quarterly-v1.form.md`); run `markform inspect` separately at any time to check
     status

   - `markform fill examples/earnings-analysis/earnings-analysis.form.md --mock
     --mock-source examples/earnings-analysis/earnings-analysis.mock.filled.form.md
     --record examples/earnings-analysis/earnings-analysis.session.yaml`

3. Run tests:

   - Replay the session transcript

   - Confirm same patches applied, same digests after each turn

   - Final completed form matches expected file exactly

* * *

## Future Extensions

### v0.2 Targets

Specified in this document but deferred from v0.1 proof of concept:

- **MCP server integration** — Full spec included above; deferred to reduce v0.1 scope

- **Radio button syntax** — `( )` / `(x)` markers for `single-select` as visual
  differentiation from multi-select (currently both use `[ ]` for markdown
  compatibility)

- **Max iteration limits** — Configurable `max_turns` for harness safety/cost control

- **Repeating groups** — Array of structured objects for when list items need structure
  (e.g., a risk entry with description, severity, likelihood, mitigation, owner).
  Maps to JSON Schema `type: "array"` with `items: { type: "object" }`. Instance IDs are
  auto-generated with sequential suffixes: `{base_id}_1`, `{base_id}_2`.
  ```md
  {% repeat ref="risk_entry" minItems=5 %}
    {% field-group id="risk_entry" title="Risk entry template" %}
    ...
    {% /field-group %}
  {% /repeat %}
  ```

- **string-list enhancements:**

  - `itemPattern` — Regex validation per item

  - `trimMode` — Attribute to control whitespace handling

  - Item-level patch operations (insert/remove/reorder)

- **`allowOther` attribute for select fields** — Enable “Other: ____” free-text option
  for `single-select` and `multi-select` fields.
  When `allowOther=true`, users can provide a custom value not in the predefined option
  list.

  ```md
  {% single-select id="delivery_type" label="Delivery type" allowOther=true %}
  - [ ] Physical {% #physical %}
  - [ ] Digital {% #digital %}
  - [ ] Hybrid {% #hybrid %}
  {% /single-select %}
  ```

  Schema additions:

  - `SingleSelectField.allowOther?: boolean`

  - `MultiSelectField.allowOther?: boolean`

  - `FieldValue` gains `otherValue?: string` property for select types

  The reserved option ID `_other` is used when the user selects “Other”.
  Serialization: `- [x] Other: Custom value here {% #_other %}`

- **`date-field` type** — Dedicated field type for date values with built-in parsing and
  validation. Supports ISO 8601 format by default.

  ```md
  {% date-field id="deadline" label="Deadline" required=true %}{% /date-field %}
  {% date-field id="fiscal_year_end" label="Fiscal year end" format="MM-DD" %}{% /date-field %}
  ```

  Attributes:

  - `format`: Date format string (default: `YYYY-MM-DD` / ISO 8601)

  - `min`: Minimum date constraint

  - `max`: Maximum date constraint

  TypeScript types:
  ```ts
  interface DateField extends FieldBase {
    kind: 'date';
    format?: string;           // default: 'YYYY-MM-DD'
    min?: string;              // minimum date in same format
    max?: string;              // maximum date in same format
  }
  
  // FieldValue
  | { kind: 'date'; value: string | null }  // stored in normalized ISO format
  
  // Patch
  | { op: 'set_date'; fieldId: Id; value: string | null }
  ```

  FieldKind enum gains `'date'` value.

### Later Versions

Documented but not required for v0.1 or v0.2:

- **Nested field groups** — v0.1/v0.2 support only flat field groups (groups contain
  fields, not other groups).
  Nested groups for hierarchical organization deferred to a future version.
  Use flat groups with descriptive IDs like `pricing_structure`, `pricing_margin_cost`
  for now.

- **`requiredIf` conditional validation** — Declarative attribute to make a field
  required based on another field’s value.
  For now, use code validators for conditional requirements (see Custom Validator
  Patterns section). A declarative `requiredIf` attribute may be added later for common
  patterns.

- Conditional enable/disable of groups/fields based on earlier answers

- Section-level grouping with conditional activation

- Rich numeric types (currency, percent, units, precision, tolerances)

- “Report-quality rendering” (templates, charts), PDF export

- More advanced UI schema/layout options

- Stronger LLM validator security model and redaction policies

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

## Design Decisions

This section documents design decisions made during architecture planning.
All items are resolved unless explicitly marked as open questions in the final
subsection.

### Core Field Behavior (v0.1)

1. **String field whitespace handling** — Whitespace-only values are equivalent to empty
   values for all purposes: `value.trim() === ""` means “no value provided.”
   For required fields, this means whitespace-only fails validation.
   For optional fields, whitespace-only is treated as empty (valid but unfilled).
   A `trimMode` attribute to customize this behavior is deferred to post-v0.2.

2. **Labels required on fields** — The `label` attribute is required on all field types
   (`label: string` in `FieldBase`). Missing label produces a parse error.
   Group/form titles remain optional.
   See Parsing Strategy (semantic validation).

3. **Option ID scoping** — Option IDs are **field-scoped** (unique within field, not
   globally). This allows reusing common patterns like `[ ] 10-K {% #ten_k %}` across
   multiple fields. When referencing options externally (doc blocks), use qualified form
   `{fieldId}.{optionId}`. In patches and FieldValue, options are already scoped by the
   field context. This is compatible with Markdoc since `{% #id %}` just sets an
   attribute—Markdoc doesn’t enforce uniqueness.

4. **Unknown option IDs handled strictly** — Option ID handling is fully specified:

   - Parse time: Missing `{% #id %}` annotation on options → parse error

   - Parse time: Duplicate option IDs within a field → parse error

   - Patch time: Unknown option ID in patch → `INVALID_OPTION_ID` error, batch rejected

   See Parsing Strategy (semantic validation) and Patch validation layers sections.

5. **Checkbox `simple` mode completion semantics** — The `minDone` attribute (integer,
   default `-1`) controls completion threshold.
   When `minDone=-1` (default), all options must be `done`. Setting `minDone=1` allows
   “at least one done” semantics, and `minDone=0` makes the field effectively optional.
   This flexible approach avoids needing separate modes like `simple_strict` vs
   `simple_optional`.

6. **Skip field semantics** — The `skip_field` patch operation provides a way for agents
   to explicitly skip optional fields without providing a value.
   Key design decisions:

   - **Only optional fields can be skipped:** Required fields reject `skip_field` with a
     validation error. This ensures critical data is always provided.

   - **Skip state is runtime metadata, not persisted to markdown:** Skipped fields
     remain empty in the serialized form.
     The skip state is tracked in `ParsedForm.skipsByFieldId` and reflected in
     `FieldProgress.skipped` and `ProgressCounts.skippedFields`.

   - **Completion formula:** `isComplete = (answeredFields + skippedFields ==
     totalFields)` AND no required issues.
     This requires agents to actively respond to every field.

   - **Skip clears existing value:** Skipping a field that already has a value clears
     the value. The field transitions from answered → skipped.

   - **Setting value clears skip:** Applying a value patch to a skipped field removes
     the skip state. The field transitions from skipped → answered.

   - **Agent visibility in stateless turns:** While skipped fields appear empty in
     markdown, agents see their state via the issues list (skipped fields removed from
     issues) and progress counts (skippedFields count).
     This provides implicit feedback that skipping was successful.

### string-list Field (v0.1)

6. **Empty string handling** — Empty strings (after trimming) are silently discarded.
   If users need explicit empty entries, that’s a different data modeling need.

7. **Whitespace handling** — Always trim leading/trailing whitespace from items;
   preserve internal whitespace.
   A `trimMode` attribute to customize this behavior is deferred to v0.2+.

8. **Item-level patterns** — `itemPattern` (regex validation per item) is deferred to
   v0.2+. v0.1 focuses on cardinality constraints only.

9. **Patch operations** — `set_string_list` performs full array replacement.
   Item-level insert/remove/reorder operations are deferred to v0.2+.

### Internal Representation (v0.1)

10. **`ParsedForm` internal shape** — The canonical internal representation returned by
    `parseForm()` is explicitly defined (see `ParsedForm` interface in Layer 2: Data
    Model). Includes `schema`, `valuesByFieldId`, `docs`, `orderIndex` (for deterministic
    ordering), and `idIndex` (for fast lookup/validation).

11. **Source location data in validation issues** — `ValidationIssue` includes optional
    `path` (field/group ID path) and `range` (source position from Markdoc AST) fields
    for CLI and tool integration.
    See `SourcePosition` and `SourceRange` types.

12. **FieldKind type location** — `FieldKind` is used in both `Field` types (as the
    `kind` discriminant) and in summary types.
    Define once, export from types module.

### Summary Types (v0.1)

13. **CheckboxProgressCounts unified type** — The `CheckboxProgressCounts` interface
    includes fields for both multi mode (`todo`, `done`, `incomplete`, `active`, `na`)
    and explicit mode (`unfilled`, `yes`, `no`). At runtime, only the states valid for
    the field’s `checkboxMode` will have non-zero values.
    Using a single unified type for simplicity, with unused fields set to zero.

14. **Group-level progress tracking** — The `ProgressSummary` tracks field progress
    only. Group-level validation issues (from hook validators) that don’t reference a
    specific field ID appear in `ValidationIssue[]` but don’t increment any field’s
    `issueCount`. May need `ProgressSummary.groupIssueCount` or similar in future
    versions.

15. **Golden test frontmatter handling** — Since `form_summary` and `form_progress` are
    recomputed on every serialize, golden test fixtures include these summaries.
    The test runner compares the full serialized file including summaries to validate
    that summary computation is deterministic.

### Repeating Groups (v0.2+)

16. **Instance ID generation** — Repeating group instances will use auto-generated
    sequential suffixes: `{base_id}_1`, `{base_id}_2`, etc.
    This keeps IDs predictable and readable while maintaining uniqueness.
    Reordering may cause ID reassignment (acceptable for v0.2 scope).

17. **Patch operations for repeating groups** — Full array replacement initially, with
    item-level operations (insert/remove/reorder) and field-level patches within
    instances as potential future enhancements.

### Open Questions

*No open questions at this time.
All design decisions for v0.1 have been resolved.*

* * *

## Future Considerations

### Resolved Clarifications (serve)

- Filesystem scope: Default saves go to the same directory as the opened file.

- Save always canonicalizes: “Save” always rewrites canonical form and derived
  summaries.

- No auto-reload: The server does not watch files for changes or auto-reload.

- Local defaults: Bind to localhost with typical local CLI defaults; no directory
  listing; minimal security posture consistent with local dev CLIs.

- Versioned save naming: Always save to a new versioned filename.
  If stem ends with a version pattern (`-vN`, `_vN`, ` vN`), increment the number;
  otherwise append `-v1`.

### Resolved: Code Validator Execution

Code validators (`.valid.ts`) are loaded at runtime via **jiti** (~150KB, zero
dependencies). This provides:

- Seamless TypeScript execution without bundling `tsx` or `ts-node`

- Caching of transpiled files for fast subsequent loads

- Works in CLI (`markform inspect`) and will work in serve when validation is added

When validation is added to serve in v0.2, the same jiti-based loading will be used
server-side.
A future “bake validators” command could pre-compile for static hosting, but
this is not needed for typical local workflows.

### Potential Improvements (v0.2+)

- Add validation to serve (see Validator Execution research above).

- Add inline editing and patch application in the UI; reflect issues as the user edits.

- Expose harness controls in serve (step/apply/validate loop).

- Render documentation blocks with a toggle/accordion for better readability.

- Offer a “Browse Forms” view with quick filter and recent files list.

- Provide “Save As Completed” shortcut that validates completion before enabling save.

* * *

## Enhancements Identified from Company Analysis Form

This section documents enhancements identified while converting the complex
`earnings-analysis-draft-form.md` to proper Markform syntax.
The form exercises many advanced patterns and serves as a comprehensive test case for
the framework.

### Framework-Level Enhancements (v0.1 or v0.2)

These require changes to the Markform schema, parser, or serializer:

#### 1. `allowOther` Attribute for Select Fields

**Problem:** Many real forms include “Other: ____” options where users can specify a
custom value not in the predefined list.

**Current workaround:** Add a separate `string-field` sibling for “Other” values.

**Proposed solution:** Add `allowOther` attribute to `single-select` and `multi-select`:

```md
{% single-select id="delivery_type" label="Delivery type" allowOther=true %}
- [ ] Physical {% #physical %}
- [ ] Digital {% #digital %}
- [ ] Hybrid {% #hybrid %}
{% /single-select %}
```

**Schema changes:**

```ts
interface SingleSelectField extends FieldBase {
  kind: 'single_select';
  options: Option[];
  allowOther?: boolean;        // NEW: enables "Other" free-text option
}

interface MultiSelectField extends FieldBase {
  kind: 'multi_select';
  options: Option[];
  minSelections?: number;
  maxSelections?: number;
  allowOther?: boolean;        // NEW: enables "Other" free-text option
}
```

**FieldValue changes:**

```ts
// Updated FieldValue for single_select when allowOther=true
| { kind: 'single_select'; selected: OptionId | null; otherValue?: string }
// Updated FieldValue for multi_select when allowOther=true
| { kind: 'multi_select'; selected: OptionId[]; otherValue?: string }
```

**Patch operation changes:**

```ts
| { op: 'set_single_select'; fieldId: Id; selected: OptionId | null; otherValue?: string }
| { op: 'set_multi_select'; fieldId: Id; selected: OptionId[]; otherValue?: string }
```

**Serialization:** When `allowOther=true`, an “Other” option is implicitly available.
If `otherValue` is set, serialize as:

```md
- [x] Other: Custom value here {% #_other %}
```

The `#_other` ID is reserved for the “Other” option when `allowOther=true`.

**Naming rationale:** `allowOther` aligns with common form library conventions (e.g.,
Ant Design’s `allowOther`, Google Forms’ “Other” option pattern).

#### 2. Date/Time Field Types (v0.2+)

**Problem:** Dates appear frequently (deadlines, as-of dates, fiscal periods).

**Current workaround:** Use `string-field` with `pattern` for validation.

**Proposed solution:** Add `date-field` with built-in parsing and format options:

```md
{% date-field id="deadline" label="Deadline" format="YYYY-MM-DD" %}{% /date-field %}
```

**Attributes:**

- `format`: Date format string (ISO 8601 default)

- `min`, `max`: Date range constraints

- `allowRelative`: Allow relative dates like “next quarter” (optional, v0.3+)

**Alternative:** Keep as `string-field` with well-documented patterns.
Date parsing is complex and may not warrant a dedicated type in v0.1.

### Custom Validator Patterns

These patterns should be implemented as code validators (`.valid.ts`), not as
framework-level features.
This keeps the core framework simple while enabling rich validation through code.

All validators receive parameters via `ctx.params`, allowing reusable validators with
configurable thresholds.

#### 1. Word Count Validation

Validate minimum/maximum word counts for text fields using parameterized validators:

```ts
// In X.valid.ts
export const validators = {
  // Parameterized: reads min/max from ctx.params
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

  max_words: (ctx) => {
    const max = ctx.params.max as number;
    if (typeof max !== 'number') {
      return [{ severity: 'error', message: 'max_words requires "max" parameter', ref: ctx.targetId, source: 'code' }];
    }
    const value = ctx.values[ctx.targetId];
    if (value?.kind === 'string' && value.value) {
      const wordCount = value.value.trim().split(/\s+/).length;
      if (wordCount > max) {
        return [{
          severity: 'error',
          message: `Field exceeds ${max} word limit (currently ${wordCount})`,
          ref: ctx.targetId,
          source: 'code',
        }];
      }
    }
    return [];
  },
};
```

**Usage in form:**

```md
{% string-field id="thesis" label="Investment thesis" required=true validate=[{id: "min_words", min: 50}] %}{% /string-field %}

{% string-field id="summary" label="Brief summary" validate=[{id: "min_words", min: 25}, {id: "max_words", max: 100}] %}{% /string-field %}
```

#### 2. Sum-To Validation for Percentage Fields

Validate that a group of fields sums to a target using parameterized validators:

```ts
export const validators = {
  // Generic sum-to validator with configurable fields and target
  sum_to: (ctx) => {
    const fields = ctx.params.fields as string[];
    const target = (ctx.params.target as number) ?? 100;
    const tolerance = (ctx.params.tolerance as number) ?? 0.1;

    if (!Array.isArray(fields)) {
      return [{ severity: 'error', message: 'sum_to requires "fields" array parameter', ref: ctx.targetId, source: 'code' }];
    }

    const values = fields.map(fieldId => {
      const val = ctx.values[fieldId];
      return val?.kind === 'number' ? (val.value ?? 0) : 0;
    });
    const sum = values.reduce((a, b) => a + b, 0);

    if (sum > 0 && Math.abs(sum - target) > tolerance) {
      return [{
        severity: 'error',
        message: `Fields must sum to ${target}% (currently ${sum.toFixed(1)}%)`,
        ref: fields[0],
        source: 'code',
      }];
    }
    return [];
  },

  // Sum-to for string-list with "Label: XX%" format
  sum_to_percent_list: (ctx) => {
    const target = (ctx.params.target as number) ?? 100;
    const value = ctx.values[ctx.targetId];

    if (value?.kind === 'string_list' && value.items.length > 0) {
      const percentages = value.items.map(item => {
        const match = item.match(/:\s*(\d+(?:\.\d+)?)\s*%/);
        return match ? parseFloat(match[1]) : 0;
      });
      const sum = percentages.reduce((a, b) => a + b, 0);

      if (Math.abs(sum - target) > 0.1) {
        return [{
          severity: 'warning',
          message: `Items should sum to ${target}% (currently ${sum.toFixed(1)}%)`,
          ref: ctx.targetId,
          source: 'code',
        }];
      }
    }
    return [];
  },
};
```

**Usage in form:**

```md

<!-- Validate three number fields sum to 100% -->

{% field-group id="scenarios" validate=[{id: "sum_to", fields: ["base_probability", "bull_probability", "bear_probability"], target: 100}] %}

<!-- Validate string-list entries sum to 100% -->

{% string-list id="revenue_segments" label="Revenue segments (Name: X%)" validate=[{id: "sum_to_percent_list", target: 100}] %}{% /string-list %}
```

#### 3. Conditional Requirement Validation

Validate that a field has a value when another field meets a condition:

```ts
export const validators = {
  // Generic: require target field when trigger field has value
  required_if: (ctx) => {
    const triggerField = ctx.params.when as string;
    const targetField = ctx.params.then as string ?? ctx.targetId;

    if (!triggerField) {
      return [{ severity: 'error', message: 'required_if requires "when" parameter', ref: ctx.targetId, source: 'code' }];
    }

    const trigger = ctx.values[triggerField];
    const target = ctx.values[targetField];

    const triggerHasValue =
      (trigger?.kind === 'string' && trigger.value?.trim()) ||
      (trigger?.kind === 'number' && trigger.value != null) ||
      (trigger?.kind === 'multi_select' && trigger.selected.length > 0);

    const targetEmpty =
      !target ||
      (target.kind === 'string' && !target.value?.trim()) ||
      (target.kind === 'number' && target.value == null);

    if (triggerHasValue && targetEmpty) {
      return [{
        severity: 'error',
        message: `This field is required when ${triggerField} has a value`,
        ref: targetField,
        source: 'code',
      }];
    }
    return [];
  },
};
```

**Usage in form:**

```md

<!-- Require explanation when moat factors are selected -->

{% string-field id="moat_explanation" label="Moat explanation" validate=[{id: "required_if", when: "moat_diagnosis"}] %}{% /string-field %}

<!-- Require evidence when whisper values provided -->

{% string-field id="whisper_evidence" label="Evidence" validate=[{id: "required_if", when: "whisper_revenue"}, {id: "required_if", when: "whisper_eps"}] %}{% /string-field %}
```

**Variant: `required_if_equals`**

Require field when another field equals a specific value:

```ts
export const validators = {
  required_if_equals: (ctx) => {
    const triggerField = ctx.params.when as string;
    const expectedValue = ctx.params.equals as string;

    if (!triggerField || expectedValue === undefined) {
      return [{ severity: 'error', message: 'required_if_equals requires "when" and "equals" parameters', ref: ctx.targetId, source: 'code' }];
    }

    const trigger = ctx.values[triggerField];
    const target = ctx.values[ctx.targetId];

    // Check if trigger equals expected value
    const triggerMatches =
      (trigger?.kind === 'single_select' && trigger.selected === expectedValue) ||
      (trigger?.kind === 'string' && trigger.value === expectedValue);

    const targetEmpty =
      !target ||
      (target.kind === 'string' && !target.value?.trim()) ||
      (target.kind === 'number' && target.value == null);

    if (triggerMatches && targetEmpty) {
      return [{
        severity: 'error',
        message: `This field is required when ${triggerField} is "${expectedValue}"`,
        ref: ctx.targetId,
        source: 'code',
      }];
    }
    return [];
  },
};
```

**Usage:**

```md

<!-- Require details when "Yes" is selected -->

{% string-field id="price_change_details" label="Price change details" validate=[{id: "required_if_equals", when: "price_changes_recently", equals: "yes"}] %}{% /string-field %}
```

#### 4. Format Validation

Validate that list items match expected formats:

```ts
export const validators = {
  // Validate each item matches a pattern
  item_format: (ctx) => {
    const pattern = ctx.params.pattern as string;
    const example = ctx.params.example as string ?? '';

    if (!pattern) {
      return [{ severity: 'error', message: 'item_format requires "pattern" parameter', ref: ctx.targetId, source: 'code' }];
    }

    const value = ctx.values[ctx.targetId];
    if (value?.kind === 'string_list') {
      const regex = new RegExp(pattern);
      const malformed = value.items.filter(item => !regex.test(item));
      if (malformed.length > 0) {
        const hint = example ? ` Expected format: "${example}"` : '';
        return [{
          severity: 'warning',
          message: `${malformed.length} item(s) don't match expected format.${hint}`,
          ref: ctx.targetId,
          source: 'code',
        }];
      }
    }
    return [];
  },
};
```

**Usage in form:**

```md

<!-- Validate KPIs have "Name: reason" format -->

{% string-list id="key_kpis" label="Key KPIs" validate=[{id: "item_format", pattern: "^.+:.+$", example: "Revenue Growth: tracks core business momentum"}] %}{% /string-list %}

<!-- Validate sources have expected format -->

{% string-list id="sources" label="Sources" validate=[{id: "item_format", pattern: "^\\d{4}-\\d{2}-\\d{2}\\s*\\|", example: "2024-01-15 | SEC Filing | 10-K | ..."}] %}{% /string-list %}
```

### Patterns Requiring Repeating Groups (v0.2)

The following patterns from the company analysis form require repeating groups, already
specified for v0.2:

1. **Offering families** — Each offering has: name, value prop, delivery type, revenue
   type, KPIs. Currently modeled as a single instance with note to add more.

2. **Pricing structures** — Per-offering pricing details.

3. **Driver model** — Multiple drivers with the same structure.
   Currently modeled as Driver 1, Driver 2, Driver 3 with optional third.

4. **Expert/analyst table** — Structured rows with multiple columns.

5. **Sourcing log** — Date, source, type, link, takeaways per entry.

When repeating groups are implemented, these will be converted to:

```md
{% repeat id="offering_families" label="Offering Families" minItems=1 %}
  {% field-group id="offering_family" title="Offering Family" %}
    {% string-field id="name" label="Offering family name" required=true %}{% /string-field %}
    {% string-field id="value_prop" label="Value proposition" required=true %}{% /string-field %}
    {% single-select id="delivery" label="Delivery type" required=true %}
      - [ ] Physical {% #physical %}
      - [ ] Digital {% #digital %}
      - [ ] Hybrid {% #hybrid %}
    {% /single-select %}
    ...
  {% /field-group %}
{% /repeat %}
```

### Test Coverage from Company Analysis Form

The `company-analysis.form.md` exercises the following Markform features:

| Feature | Coverage |
| --- | --- |
| `string-field` with `required` | ✅ Extensive |
| `string-field` with `pattern` | ✅ Dates, fiscal periods |
| `string-field` with `minLength`/`maxLength` | ✅ Word count proxies |
| `number-field` with `min`/`max` | ✅ Percentages 0-100 |
| `number-field` for currency | ✅ Financial metrics |
| `string-list` with `minItems`/`maxItems` | ✅ Ranked lists, KPIs |
| `single-select` basic | ✅ Many instances |
| `multi-select` with `minSelections` | ✅ Business model, moats |
| `checkboxes` with `checkboxMode="simple"` | ✅ Source checklists |
| `field-group` (flat) | ✅ Many groups |
| `doc` blocks with `kind` | ✅ Instructions throughout |
| Code validators | ⏳ Planned in `.valid.ts` |

### Recommended Implementation Order

1. **v0.1 Core:** Implement all current spec features—sufficient for basic form.

2. **v0.1 Enhancement:** Add `allowOther` attribute (high value, moderate effort).

3. **v0.2:** Implement repeating groups—unlocks offering families, driver model.

4. **v0.2:** Add `date-field` type for date values with built-in validation.

Note: Conditional validation (e.g., “field X required if field Y has value”) is handled
via code validators.
See the Custom Validator Patterns section for examples of `moat_explanation_required`,
`whisper_evidence_required`, etc.
