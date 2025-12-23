# Markform Technical Overview

Version: v0.1 (proof of concept)

## Context & Motivation

### What Markform Is

**Markform** is a system for **agent-friendly, human-readable, editable forms** stored
(`.form.md`) that support:

- **Structured schema + form values in the same file** (template, incomplete, or
  completed), which makes for easy and efficient context engineering

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
  so that Markfrom itself is easily tested end to end via agentic coding

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
| **Multi checkbox** | Checkbox mode with 5 states: `todo`, `done`, `in_progress`, `active`, `na`. Default mode. |
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

### Explicit Non-Goals

- Security hardening for sensitive/PII content (explicitly deferred)

- Conditional sections / branching logic (designed for extensibility, not implemented)

- Perfect “preserve exact original formatting” round-tripping (v0.1 canonicalizes
  output)

- PDF generation pipeline (HTML is enough; PDF later via print CSS)

- Python validator runtime (reserved; TypeScript first)

* * *

## Core Architecture: The Shared Engine

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

- **Extension:** `.form.md`

- **Frontmatter:** YAML with `markform_version: "0.1"` (see
  [Markdoc Frontmatter][markdoc-frontmatter])

#### ID Conventions

- **IDs are globally unique** across the entire document (fields, groups, fields,
  options, documentation blocks).
  Enforced by engine validation.

- IDs use **snake_case** (recommended convention)

- Tag names use **kebab-case** (Markdoc convention)

- Option IDs use [Markdoc’s annotation shorthand][markdoc-attributes] `{% #my_id %}`
  after list items

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
| `checkboxes` | Stateful checklist; supports `checkboxMode` with values `multi` (5 states), `simple` (2 states), or `explicit` (yes/no) |

**Note on `pattern`:** The `pattern` attribute accepts a JavaScript-compatible regular
expression string (without delimiters).
Example: `pattern="^[A-Z]{1,5}$"` for a ticker symbol.

#### Option Syntax (Markform-specific)

Markdoc does **not** natively support GFM-style task list checkbox syntax.
The `[ ]` and `[x]` markers are **Markform-specific syntax** parsed within tag content.

All selection field types use checkbox-style markers for broad markdown renderer
compatibility:

| Field Type | Marker | Meaning | Example |
| --- | --- | --- | --- |
| `checkboxes` | `[ ]` | Unchecked / todo / unfilled | `- [ ] Item {% #item_id %}` |
| `checkboxes` | `[x]` | Checked / done | `- [x] Item {% #item_id %}` |
| `checkboxes` | `[/]` | In progress (multi only) | `- [/] Item {% #item_id %}` |
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
| `[/]` | in_progress | Work started but not finished. Obsidian convention ([discussion][obsidian-tasks-discussion]) |
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

- `checkboxMode="simple"` — 2 states for GFM compatibility

- `checkboxMode="explicit"` — Requires explicit yes/no, validates all options answered

**Distinction between `in_progress` and `active`:**

- `in_progress` (`[/]`): Work has started on this item (may be paused)

- `active` (`[*]`): This item is the current focus right now (useful for showing where
  an agent is in a multi-step workflow)

#### Documentation Blocks

Documentation blocks provide contextual help attached to form elements:

```md
{% doc ref="<target_id>" kind="description|instructions|notes|examples" %}
Markdown content here...
{% /doc %}
```

- `ref` (required): References the ID of a form, group, field, or option

- `kind` (optional): Categorizes the documentation type

**Note:** Documentation blocks themselves do **not** require unique IDs—they are
identified by their `ref` + `kind` combination.
Multiple doc blocks with different `kind` values can reference the same target.

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

Values are encoded **inline** via `[x]` marker—exactly one option must be selected:
```md
{% single-select id="rating" label="Rating" %}
- [ ] Bullish {% #bullish %}
- [x] Neutral {% #neutral %}
- [ ] Bearish {% #bearish %}
{% /single-select %}
```

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
- [y] Market volatility risk assessed {% #market_risk %}
- [n] Regulatory risk assessed {% #regulatory_risk %}
- [ ] Currency risk assessed {% #currency_risk %}
{% /checkboxes %}
```

In this example, `currency_risk` is unfilled (`[ ]`) and will fail validation because
`checkboxMode="explicit"` requires all options to have explicit `[y]` or `[n]` answers.

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
```value {% process=false %}
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
- Always use `process=false` on the fence
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

{% doc ref="top_risks" kind="instructions" %}
One risk per line. Be specific (company- or product-specific), not generic.
Minimum 5; include more if needed.
{% /doc %}

```value {% process=false %}
Supply chain disruption from single-source vendor
Key engineer departure risk (bus factor = 1)
Regulatory changes in EU market
Competitor launching similar feature in Q2
Customer concentration risk (top 3 = 60% revenue)
```
{% /string-list %}
```

##### The `process=false` Attribute

Only required when the value contains Markdoc syntax (e.g., `{% ... %}` or `{# ... #}`).
See [GitHub Discussion #261][markdoc-process-false] for implementation details:

```md
{% string-field id="notes" label="Notes" %}
```value {% process=false %}
Use {% tag %} for special formatting.
```
{% /string-field %}
```

#### Example: Template Form

```md
---
markform_version: 0.1
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

- Option IDs use Markdoc annotation shorthand `#id`

- Checkbox states: `[ ]` todo, `[x]` done, `[/]` in progress, `[-]` n/a

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
   - Globally-unique IDs across all elements
   - `ref` resolution (doc blocks reference valid targets)
   - Checkbox mode enforcement (`checkboxMode="simple"` restricts to 2 states)
   - Option marker parsing (`[ ]`, `( )`, etc.)

#### Serialization Strategy

Generate markdown string directly (not using `Markdoc.format()` due to canonicalization
requirements beyond what it provides—see [Formatting][markdoc-format]):

**Canonical formatting rules:**

| Rule | Specification |
|------|---------------|
| Attribute ordering | Alphabetical within each tag |
| Indentation | 0 spaces for top-level, no nested indentation |
| Blank lines | One blank line between field-groups, none between fields |
| Value fences | Omit entirely for empty fields |
| `process=false` | Only emit when value contains `{% ... %}` or `{# ... #}` |
| Option ordering | Preserved as authored (order is significant) |
| Line endings | Unix (`\n`) only |

* * *

### Layer 2: Data Model

#### Canonical TypeScript Types

```ts
type Id = string; // validated snake_case, e.g., /^[a-z][a-z0-9_]*$/

// Multi-checkbox states (checkboxMode="multi", default)
type MultiCheckboxState = 'todo' | 'done' | 'in_progress' | 'active' | 'na';

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
  | MultiSelectField;

interface FormSchema {
  id: Id;
  title?: string;
  groups: FieldGroup[];
}

interface FieldGroup {
  kind: 'field_group';
  id: Id;
  title?: string;
  required?: boolean;
  validate?: string[];       // validator IDs
  children: Array<FieldGroup | Field>;
}

interface FieldBase {
  id: Id;
  label: string;
  required?: boolean;
  validate?: string[];       // validator IDs
}

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
  checkboxMode?: CheckboxMode;  // default: 'multi'
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

type FieldValue =
  | { kind: 'string'; value: string | null }
  | { kind: 'number'; value: number | null }
  | { kind: 'string_list'; items: string[] }
  | { kind: 'checkboxes'; values: Record<Id, CheckboxValue> }
  | { kind: 'single_select'; selected: Id | null }
  | { kind: 'multi_select'; selected: Id[] };

interface DocumentationBlock {
  ref: Id;                   // references a form/group/field/option ID
  kind?: 'description' | 'instructions' | 'notes' | 'examples';
  bodyMarkdown: string;
}
```

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

#### Comprehensive Field Type Reference

This section provides a complete mapping between Markdoc syntax, TypeScript types, and
schema representations for all field types.

##### Naming Conventions

| Layer | Convention | Example |
| --- | --- | --- |
| Markdoc tag names | kebab-case | `string-field`, `multi-select` |
| Markdoc attributes | camelCase | `minLength`, `checkboxMode`, `minItems` |
| IDs (values) | snake_case | `company_name`, `ten_k`, `quarterly_earnings` |
| TypeScript interfaces | PascalCase | `StringField`, `MultiSelectField` |
| TypeScript properties | camelCase | `minLength`, `checkboxMode` |
| TypeScript kind values | snake_case | `'string'`, `'single_select'` |
| Patch operations | snake_case | `set_string`, `set_single_select` |
| JSON Schema keywords | camelCase | `minItems`, `maxLength`, `uniqueItems` |

**Rationale:** Using camelCase for Markdoc attributes aligns with JSON Schema keywords
and TypeScript conventions, eliminating translation overhead.
IDs remain snake_case as they are data values, not code identifiers.

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
| FieldValue | `{ kind: 'single_select'; selected: Id \| null }` |
| Patch operation | `{ op: 'set_single_select'; fieldId: Id; selected: Id \| null }` |
| Zod | `z.enum([...optionIds])` |
| JSON Schema | `{ type: "string", enum: [...optionIds] }` |

**`multi-select`** — Select multiple options from enumerated list

| Aspect | Value |
| --- | --- |
| Markdoc tag | `multi-select` |
| TypeScript interface | `MultiSelectField` |
| TypeScript kind | `'multi_select'` |
| Attributes | `id`, `label`, `required`, `minSelections`, `maxSelections` + inline `options` |
| FieldValue | `{ kind: 'multi_select'; selected: Id[] }` |
| Patch operation | `{ op: 'set_multi_select'; fieldId: Id; selected: Id[] }` |
| Zod | `z.array(z.enum([...optionIds])).min(n).max(m)` |
| JSON Schema | `{ type: "array", items: { enum: [...optionIds] }, minItems, maxItems }` |

**`checkboxes`** — Stateful checklist with configurable checkbox modes

| Aspect | Value |
| --- | --- |
| Markdoc tag | `checkboxes` |
| TypeScript interface | `CheckboxesField` |
| TypeScript kind | `'checkboxes'` |
| Attributes | `id`, `label`, `required`, `checkboxMode` (`multi`/`simple`/`explicit`) + inline `options` |
| FieldValue | `{ kind: 'checkboxes'; values: Record<Id, CheckboxValue> }` |
| Patch operation | `{ op: 'set_checkboxes'; fieldId: Id; values: Record<Id, CheckboxValue> }` |
| Zod | `z.record(z.enum([...states]))` |
| JSON Schema | `{ type: "object", additionalProperties: { enum: [...states] } }` |

##### Checkbox Mode State Values

| Mode | States | Zod Enum |
| --- | --- | --- |
| `multi` (default) | `todo`, `done`, `in_progress`, `active`, `na` | `z.enum(['todo', 'done', 'in_progress', 'active', 'na'])` |
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
| All options answered | `checkboxes` | `checkboxMode="explicit"` requires no `unfilled` values |

Output: `ValidationIssue[]`

#### Hook Validators

Validators are referenced by **ID** from fields/groups/form via `validate=["..."]`.

**Code validators (`.valid.ts`):**

- Sidecar file with same basename: `X.form.md` → `X.valid.ts`

- Exports a registry mapping `validatorId -> function`

- Functions receive context: `{ schema, values, targetId }`

**LLM validators (`.valid.md`):**

- Sidecar file: `X.valid.md`

- Contains prompts keyed by validator IDs

- Executed behind a flag (`--llm-validate`) with an injected model client

- Output as structured JSON issues

#### Validation Pipeline

1. Built-ins first (fast, deterministic)

2. Code validators

3. LLM validators (optional; may be slow/costly)

#### Validation Result Model

```ts
type Severity = 'error' | 'warning' | 'info';

interface ValidationIssue {
  severity: Severity;
  message: string;           // Human-readable, suitable for display
  code?: string;             // Machine-readable error code (e.g., 'REQUIRED_MISSING')
  ref?: Id;                  // Field/group ID this issue relates to
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
| **Inspect** | Get form state summary | Completion stats, ordered issues, next recommendations, optional schema |
| **Apply** | Apply patches to form values | Updated form state, new issues, new recommendations |
| **Validate** | Run all validators (including hooks) | `ValidationIssue[]` |
| **Export** | Get structured data | `{ schema: FormSchemaJson, values: FormValuesJson }` |
| **GetMarkdown** | Get canonical form source | Markdown string |

**Operation availability by interface:**

| Operation | CLI | AI SDK | MCP (v0.2) |
| --- | --- | --- | --- |
| inspect | `markform inspect` | `markform_inspect` | `markform.inspect` |
| apply | `markform apply` | `markform_apply` | `markform.apply` |
| validate | `markform validate` | via inspect | via inspect |
| export | `markform export --json` | `markform_export` | `markform.export` |
| getMarkdown | `markform apply` (writes file) | `markform_get_markdown` | `markform.get_markdown` |
| render | `markform render` | — | — |
| serve | `markform serve` | — | — |

#### Patch Schema

```ts
type Patch =
  | { op: 'set_string'; fieldId: Id; value: string | null }
  | { op: 'set_number'; fieldId: Id; value: number | null }
  | { op: 'set_string_list'; fieldId: Id; items: string[] }
  | { op: 'set_checkboxes'; fieldId: Id; values: Record<Id, CheckboxValue> }
  | { op: 'set_single_select'; fieldId: Id; selected: Id | null }
  | { op: 'set_multi_select'; fieldId: Id; selected: Id[] }
  | { op: 'clear_field'; fieldId: Id };
```

**Patch semantics:**

- `set_*` with `null` value: Clears the field (equivalent to `clear_field`)

- `clear_field`: Removes all values; serializes as empty tag (no value fence)

- `set_checkboxes`: Merges provided values with existing state (only specified options
  are updated)

- `set_multi_select`: Replaces entire selection array (not additive)

**Patch conflict handling:**

- Patches are applied in array order within a single `apply` call

- Later patches to the same field overwrite earlier ones (last-write-wins)

- Invalid `fieldId` or `optionId` produces a validation error in the response

- Patches are atomic: all succeed or all fail (transaction semantics)

#### “Next Steps” Heuristic

When `inspect` runs, it computes recommended next actions (in priority order):

1. **Validation errors** — Fields with errors that must be fixed

2. **Missing required fields** — Required fields with no value

3. **Incomplete checkbox sets** — Required checkboxes with items in `todo` state

4. **Underfilled string-lists** — Required string-lists with `items.length < minItems`

5. **Optional-but-empty fields** — Lowest priority, suggested for completeness

Returns a list of `{ fieldId, reason, priority }` recommendations.
The harness config controls how many to return (`max_recommended`).

**Reason codes for string-list fields:**

- `minItemsNotMet` — List has fewer items than `minItems` requires

* * *

### Layer 5: Execution (Harness Loop)

The harness wraps the engine with a stable “step” protocol for bite-sized actions.

#### Harness State Machine

```
┌─────────┐
│  INIT   │
└────┬────┘
     │ load form
     ▼
┌─────────┐    all valid   ┌──────────┐
│  STEP   │───────────────►│ COMPLETE │
└────┬────┘                └──────────┘
     │ has recommendations
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
Max iteration limits for safety/cost control are a v0.2+ consideration.

#### Harness Contract

```ts
interface StepResult {
  issues: ValidationIssue[];
  recommendations: Array<{ fieldId: Id; reason: string; priority: number }>;
  stepBudget: number;        // suggested patches this turn (from config)
  isComplete: boolean;
  turnNumber: number;
}
```

- `harness.step()` returns current state + recommendations

- `stepBudget` comes from config (`max_patches_per_turn`), not computed dynamically

- Agent/user applies patches via `harness.apply(patches)`

- Harness revalidates and returns next `StepResult`

This keeps turns short and controlled for long-lived sessions.

#### Mocked Mode

- Uses a completed mock file: `X.mock.filled.form.md`

- Mock agent parses completed mock values and on each harness step picks recommended
  fields and applies patches using those values

- Deterministic and perfect for golden tests

- No LLM calls required

#### Live Mode (AI SDK)

Uses [AI SDK tool calling][ai-sdk-tool-calling] with agentic loop control from
[AI SDK 5][ai-sdk-5] and [AI SDK 6][ai-sdk-6]:

- Define Markform tools using AI SDK `tool({ inputSchema: zod, execute })`

- Control multi-step behavior with `stopWhen: stepCountIs(k)` for “1–3 actions per
  iteration” (see [AI SDK 5][ai-sdk-5] for `stepCountIs`)

- Harness builds the “user message” (current state + next steps)

- Call `streamText`/`generateText` with tools enabled

- Execute tool calls (apply patches)

- Repeat until complete

* * *

### Layer 6: Testing Framework (Golden Sessions)

Provides a unified testing approach covering parsing/serialization, tool operations,
validation behavior, harness behavior, and all adapters.

#### Golden Session Format

A golden test is a YAML file containing:

- Initial artifacts (`.form.md` and validators)

- Sequence of steps/turns with operations, validation issues, “next fields”
  recommendations, and resulting form snapshot/diff

#### Session Transcript Schema

```yaml
session_version: 0.1
mode: mock  # mock | live (see explanation below)
form:
  path: examples/quarterly/quarterly.form.md
validators:
  code: examples/quarterly/quarterly.valid.ts
  llm: examples/quarterly/quarterly.valid.md
mock:
  completed_mock: examples/quarterly/quarterly.mock.filled.form.md

harness:
  max_recommended: 5         # max fields to suggest per turn
  max_patches_per_turn: 3    # stepBudget value
  prioritize_errors: true    # errors before missing fields
  # max_turns: 50            # v0.2+: optional safety limit

turns:
  - turn: 1
    inspect:
      issues: []
      next:
        - id: company_name
          reason: required_missing
    apply:
      patches:
        - { op: set_string, fieldId: company_name, value: "ACME Corp" }
    after:
      issue_count: 0
      markdown_sha256: "..."

final:
  expect_complete: true
  expected_completed_form: examples/quarterly/quarterly.mock.filled.form.md
```

**Mode field semantics:**

| Mode | Purpose | `turns` field | Reproducible |
| --- | --- | --- | --- |
| `mock` | CI testing with deterministic values | Pre-recorded, replayed exactly | ✅ Yes |
| `live` | Development logging of real LLM sessions | Recorded during execution | ❌ No |

For `mode: live`, the session transcript is an **output** (recorded log), not an input
for replay. Live sessions are useful for debugging but not for CI assertions.

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

- `markform validate <file.form.md>` — parse + run validators, print issues

- `markform inspect <file.form.md>` — print summary + next recommended IDs

- `markform apply <file.form.md> --patch <json>` — apply patches, write canonical file

- `markform export <file.form.md> --json` — print `{schema, values}`

- `markform run <file.form.md> --mock --completed-mock <file>` — run harness end-to-end,
  write session transcript

- `markform render <file.form.md> --out <file.html>` — produce clean HTML/CSS

- `markform serve <file.form.md>` — local web UI with JSON endpoints for inspect/apply

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

Future split into `markform-cli`, `markform-ai-sdk`, etc.
is optional later.

* * *

## Golden Example Set for v0.1

### Example 1: `quarterly_earnings_analysis` (mocked)

Files:

- `examples/quarterly/quarterly.form.md` (template form)

- `examples/quarterly/quarterly.mock.filled.form.md` (completed mock with checkbox
  states and values)

- `examples/quarterly/quarterly.valid.ts` (deterministic checks)

- `examples/quarterly/quarterly.valid.md` (LLM validator prompt)

- `examples/quarterly/quarterly.session.yaml` (session transcript)

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
`SessionYaml`

Deliverable: `engine/types.ts` + `engine/schemas.ts`

### 2) Markdoc parsing to canonical model

Frontmatter parsing, AST walk, extract tags/options/values, semantic validation

Deliverable: `engine/parse.ts`

### 3) Canonical serialization

Deterministic output, omit empty value fences, `#id` annotations

Deliverable: `engine/serialize.ts`

### 4) Built-in validation + inspect heuristic

Required, numeric, select constraints, completion stats, next recommendations

Deliverable: `engine/validate.ts` + `engine/inspect.ts`

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

`validate`, `inspect`, `apply`, `export`, `render`, `run --mock`

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

1. Write `quarterly.form.md` (template) and `quarterly.mock.filled.form.md` (completed
   mock)

2. Run:

   - `markform validate examples/quarterly/quarterly.form.md`

   - `markform inspect examples/quarterly/quarterly.form.md`

   - `markform run examples/quarterly/quarterly.form.md --mock --completed-mock
     examples/quarterly/quarterly.mock.filled.form.md --record
     examples/quarterly/quarterly.session.yaml`

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

### Later Versions

Documented but not required for v0.1 or v0.2:

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

## Outstanding Questions

### string-list Design Decisions (v0.1)

1. **Empty string handling** — Empty strings (after trimming) are silently discarded.
   If users need explicit empty entries, that’s a different data modeling need.

2. **Whitespace handling** — Always trim leading/trailing whitespace from items;
   preserve internal whitespace.
   A `trimMode` attribute to customize this behavior is deferred to v0.2+.

3. **Item-level patterns** — `itemPattern` (regex validation per item) is deferred to
   v0.2+. v0.1 focuses on cardinality constraints only.

4. **Patch operations** — `set_string_list` performs full array replacement.
   Item-level insert/remove/reorder operations are deferred to v0.2+.

### Repeating Groups (v0.2+)

5. **Instance ID generation** — Repeating group instances will use auto-generated
   sequential suffixes: `{base_id}_1`, `{base_id}_2`, etc.
   This keeps IDs predictable and readable while maintaining uniqueness.
   Reordering may cause ID reassignment (acceptable for v0.2 scope).

6. **Patch operations for repeating groups** — Full array replacement initially, with
   item-level operations (insert/remove/reorder) and field-level patches within
   instances as potential future enhancements.
