# External Analysis: Subform Design Space Exploration

**Source**: External agent analysis (prior research)

**Purpose**: Review and integrate insights into the main research brief

---

## Markform Today: Core Design Constraints That Matter for Subforms

Markform's current design choices are actually pretty opinionated, and they strongly shape what "subforms" can/should look like:

### 1) "Single text file" and "forms-as-context"

A .form.md document intentionally mixes:
- the instructions / process (plain Markdown),
- the schema (Markdoc-style tags like {% field … %}),
- and the values (inline inside those tags in a canonicalized representation).

This is explicitly about context engineering: everything needed to fill/validate/review is co-located and diff-friendly.

### 2) AST-friendly structure but simple ID model

- Structure uses Markdoc tags:
  - form root container
  - group containers
  - a single field tag with kind="..." (string/number/select/table/etc.)
- Structural IDs are globally unique within a document (form/group/field IDs). Option IDs are only unique within a field.
- This global-uniqueness rule is a big deal for embedded/repeated subforms.

### 3) Agent edits are patch operations, not "rewrite the doc"

The tool API centers around:
- inspect → gives progress + prioritized issues
- apply → applies typed patches (set_string, set_table, skip_field, abort_field, etc.)
- export → structured values
- get_markdown → canonical doc source

This is important because subforms must be representable in:
- the data model (schema + values),
- the patch vocabulary,
- and the inspect/issue model (so an agent knows what's next).

### 4) "Incremental filling" + validation loop

Markform expects a workflow like:
1. inspect to learn what's missing/invalid
2. patch to fill
3. inspect again
…until complete.

Subforms, if they're "real," need to participate in that completion and validation story.

### 5) Tables are supported, but they're "rows of scalars"

Tables are typed by columns, and (in the spec) a row is essentially:
`Record<ColumnId, CellValue>`.
Notably: there's no first-class row identity today (no row IDs), which matters a lot for "per-row subforms."

---

## The Subform Problem, Concretely

Two related but distinct needs:

1. **A single field that is actually another form**
   - Example: market_analysis field that is a nested form with 20 fields.

2. **A table where each row has a nested form**
   - Example: companies table with columns:
     - company
     - url
     - research_details (subform per row)

Also wanted:
- Recursive filling using sub-agents (or nested runs)
- Control over context propagation into subforms (parent form + row context)
- Potential parallelism (10 rows → 10 subagents concurrently, max concurrency, etc.)
- Consideration of where the agentic loop lives:
  - library-owned harness (Markform currently has one)
  - vs caller-owned (Claude Code / external orchestrator loops calling tools)

So we need to evaluate designs across:
- format + data model,
- identity,
- patch/edit semantics,
- validation + completion,
- orchestrator integration,
- concurrency + dependencies.

---

## Analogous Patterns from Existing Products

### Microsoft Access: "forms + subforms" on relational data

Access's subform model is basically:
- main form bound to table A
- subform bound to table B
- link via foreign key (A.id → B.a_id)

**Key takeaway**: subforms are really a UI for a relationship. The stable identity isn't "row number," it's a key. If you try to fake it with indexes, it breaks the moment the user sorts, filters, inserts, or deletes.

### Excel / Sheets: tables + "details elsewhere"

Excel users routinely model this as:
- Sheet1: summary table (companies)
- Sheet2..N: detail sheets per company
- Or: a second table keyed by company ID, with "detail rows"

**Key takeaway**: it works when you introduce a stable key column (company_id) early, and everything references it. Otherwise the "details" drift from the summary.

Also: Excel's computation model is DAG-based (dependencies), and it parallelizes well when dependencies are explicit.

### Airtable / Notion / Coda: table rows are records with a detail view ("page")

These modern tools nailed the UX:
- a table is a list of records
- each record has a "page" or expanded view with more fields
- relations exist as link-to-record fields

**Key takeaway**: the cleanest mental model is "each row is an entity," and the subform is simply "the entity's full schema." Technically, this is "table-of-objects" with stable record IDs.

### Typeform / Google Forms: weak subform story, strong piping/prefill story

Typeform's strengths are:
- conditional logic
- piping prior answers into later prompts
- hidden fields / prefill via URL

**Key takeaway**: even without subforms, context injection is a first-class feature. That maps to your need to decide how much parent context to provide to a sub-agent.

### JSON Schema / form generators (react-jsonschema-form, etc.)

These solve nested objects/arrays structurally:
- nested object fields
- arrays of objects
- stable addressing via JSON Pointer-like paths

**Key takeaway**: once you have nesting/repetition, you inevitably need path addressing or stable IDs at instance boundaries. Also, validation and partial updates become tree operations.

---

## Design Space for Markform Subforms: Four Families

### Family A: Subforms as Separate .form.md Files, Referenced from Parent

This is the "relational / linked record" approach.

**What it looks like**

Introduce a new field kind, say form_ref or subform_ref, whose value is a reference to another form document.

Example: single subform field:
```jinja
{% field kind="subform_ref" id="market_analysis" label="Market analysis" required=true %}
```value
forms/market-analysis.form.md
```
{% /field %}
```

For the table case, sub-variants:

**A1) Explicit ref column in the table**
```jinja
{% field kind="table" id="companies" label="Companies"
   columnIds=["company_id","company","url","research_form"]
   columnTypes=["string","string","url","string"] %}
| company_id | company | url | research_form |
| --- | --- | --- | --- |
| acme | Acme Inc. | https://acme.com | forms/company-acme.research.form.md |
| globex | Globex | https://globex.com | forms/company-globex.research.form.md |
{% /field %}
```

**A2) A dedicated subform_ref column type**
Extend table columnTypes to include subform_ref, and make the cell value a reference that tooling understands.

**How patching works**
- Parent form patches still use set_table to update table cells.
- Subforms are edited via separate inspect/apply sessions per file.

This fits cleanly with the existing patch model because you're not trying to patch deep nested structures through a single fieldId.

**Validation & completion semantics**
- Option A (strict): if a subform_ref field is required, then it is only "complete" if the referenced form is complete.
- Option B (loose): parent only validates that the reference is non-empty / exists; completion of subforms is tracked separately.

**Context propagation**
This model makes context propagation an orchestrator concern.

**Parallelism**
This is very easy to parallelize—each referenced subform is an independent unit of work.

**Pros**
- Plays nicely with Markform's global-unique ID rule (each file is its own namespace).
- Very compatible with the existing tool API (inspect/apply/export per form).
- Scales to "10 rows → 10 subforms" without making one file enormous.
- Avoids inventing table-row identity inside Markform itself.

**Cons / risks**
- You lose some of the "everything in one file" context advantage.
- Humans reviewing might need to jump between files.
- Requires a convention for file naming + lifecycle.
- For caller-owned orchestration, you need a notion of "workspace" (multiple forms).

---

### Family B: Embedded Subforms Inside One Markform Document

This is the "single file contains the whole tree" approach.

**What it looks like**
Introduce a new structural container, or allow nested {% form %} blocks.

```jinja
{% field kind="subform" id="market_analysis" label="Market analysis" required=true %}
  {% form id="market_analysis_form" %}
    {% field kind="string" id="tam" label="TAM" role="agent" required=true %}{% /field %}
    {% field kind="string_list" id="competitors" label="Competitors" role="agent" %}{% /field %}
  {% /form %}
{% /field %}
```

**The big problem: ID scoping + repetition**
Markform currently requires all structural IDs to be unique across the entire document. Embedded subforms immediately create pressure to have reusable schemas.

If you embed 10 identical company research subforms, you either:
- rename every field ID with a prefix (e.g. acme_revenue, globex_revenue), or
- change the spec to allow local scopes and path addressing.

Changing the ID model is a major shift because:
- patch operations currently take fieldId: Id (simple string)
- inspection issues reference ref: Id

If IDs become non-unique, you need fully-qualified paths (like JSON Pointer or dot paths), and that cascades through patches, issue references, doc blocks, and derived metadata.

**Pros**
- Strongly preserves "single file = full context"
- Great for human review (one artifact)
- Export is straightforward (tree is already present)

**Cons / risks**
- Forces a redesign of ID scoping and patch addressing if you want repetition.
- The document can become huge and unwieldy fast.
- The canonicalization/serialization complexity goes up.
- Your table+subform-per-row desire is awkward inside Markdown tables.

This is possible, but it's "big spec changes" territory.

---

### Family C: Represent "table + per-row subform" as Array of Objects (Repeatable Groups)

This is the "JSON schema style" approach, but in Markform's Markdown/Markdoc idiom.

**What it looks like**
Introduce a new container tag like repeat (or a group attribute) that means "array of group instances."

```jinja
{% group id="companies" label="Companies" repeat=true itemLabel="Company" %}
- {% group id="acme" label="Acme Inc." %}
    {% field kind="string" id="company" label="Company" %}…{% /field %}
    {% field kind="url" id="url" label="URL" %}…{% /field %}

    {% group id="research" label="Research details" %}
      {% field kind="string" id="summary" label="Summary" role="agent" required=true %}{% /field %}
      {% field kind="single_select" id="rating" label="Rating" role="agent" %}…{% /field %}
    {% /group %}
  {% /group %}
- {% group id="globex" label="Globex" %}…{% /group %}
{% /group %}
```

Notice: this gives every company a stable ID (acme, globex) and then the nested research form is just structure.

Family C almost always implies:
- scoped IDs and path addressing, OR
- each repeated instance is itself a separate form (which collapses back to Family A).

**Pros**
- Models your domain accurately: companies are objects, not table rows.
- Stable identity is natural (instance ID).
- Easy to attach nested structures (subform per object) without tables.

**Cons / risks**
- Requires either scoped IDs or multiple files.
- Harder for quick "glanceable" summary editing than a table.
- You'd likely want tooling to project a summary table automatically.

---

### Family D: Hybrid—Keep the Table, but Define First-Class Row Identity + Subform Map

This is the "Airtable in a text file" approach.

**D1) Require an explicit row_id column**
- first column is row identity
- Markform tooling can enforce uniqueness of row_id
- subform instances are keyed to it

**D2) Extend table syntax to support row annotations**
E.g., allow per-row Markdoc annotations—but Markdown tables don't naturally support this.

**D3) Store row IDs in derived metadata**
The parser could assign row IDs and store them in frontmatter—but that breaks the moment a human edits the table manually.

Realistically D1 is the viable hybrid: a stable key column is explicit in the source.

**Pros**
- Preserves "table editing experience"
- Introduces stability needed for row-attached subforms
- Lets you build nice UIs (table + "open details")

**Cons / risks**
- You're effectively requiring users to think in IDs / keys
- Still need to decide where subform data lives (single file vs multi-file)
- More spec surface area (row identity rules, uniqueness, etc.)

---

## Agent Harness: Library-Owned Recursion vs Caller-Owned Orchestration

### Model 1: Library-owned harness (Markform continues to "own the loop")

Extend the existing harness to:
1. fill the parent form until it reaches a "subform frontier"
2. spawn sub-agents for each subform
3. optionally come back to fill parent fields that depend on subform results

**Pros**
- Consistent prompt/tooling patterns (important for reliability)
- Markform can do best-practice scheduling (like "fill keys first, then parallelize subforms")
- Can hide complexity from callers

**Cons**
- Callers who already have an orchestrator may want control
- "Two orchestrators fighting" is a real integration risk

### Model 2: Caller-owned orchestration (Markform is a tool provider, not a runner)

Markform remains:
- a parser/serializer
- a validator/inspector
- a patch applier
- an exporter

The caller loop decides what to fill next, whether to run subagents in parallel, how to pass context.

**Pros**
- Maximum flexibility
- Plays well with Claude Code / MCP / custom agent frameworks
- Easier to integrate with production systems (observability, quotas)

**Cons**
- Every caller must reinvent good policies unless Markform provides them as reusable "planner" helpers
- You risk fragmentation in behavior and quality

### A pragmatic "both" design

Keep a library-owned default harness, but make it "headless and composable":
- Markform exposes a planner primitive like:
  - inspect → already returns prioritized issues
  - optionally next_actions() → returns actionable "fill tasks," including "fill this subform ref"
- The default harness simply consumes that planner.
- External orchestrators can also consume the same planner, but keep control.

---

## Ordering + Dependencies + "What Context Does the Sub-Agent Get?"

### The simplest viable ordering for v1

For "companies table + research subforms" case:
1. Fill parent "index" fields first (anything that defines the set of subforms)
2. Materialize subform instances (create files or embedded blocks)
3. Fill subforms (parallelizable)
4. Fill any parent summary fields that depend on subforms

This is exactly how humans work: create list → research each → summarize.

### Making dependencies explicit (optional but powerful)

Add a dependsOn schema attribute:

```jinja
{% field kind="subform_ref" id="research" dependsOn=["company","url"] %}…{% /field %}
```

Or for computed summary fields:

```jinja
{% field kind="string" id="overall_findings" dependsOn=["companies.*.research"] %}…{% /field %}
```

### Context propagation policy knobs

Likely want these "modes":
- **minimal**: row context only (company + url)
- **parent**: entire parent form markdown
- **parent_values**: exported parent values JSON (smaller, less noise)
- **workspace**: include other completed subforms (expensive)

A nice pattern: default to parent_values + row_context; allow override per subform field or harness config.

---

## Parallelization: Where to Encode What?

The clean separation is:
- **Spec encodes dependencies** (what must come first)
- **Executor encodes concurrency limits** (how many workers, batching, retries)

### Useful semantic hints (low risk)

- dependsOn (enables safe parallelism and correct ordering)
- independent=true (explicitly states no cross-item dependencies; mostly documentation)
- priority=low|medium|high (Markform already has priority weights conceptually)

### Executor-owned knobs (highly variable)

- maxConcurrency
- batchSize
- retry/backoff
- per-model rate limiting
- cost budgets

These should live in harness config or caller orchestrator config.

---

## Export Semantics: Nested Values or References?

### Export option 1: references only (cheap)

Parent export includes table rows, subform refs as strings/paths.

Pros: simple
Cons: caller must load N more files to get full data

### Export option 2: inline subform values (logical tree export)

Parent export recursively reads subforms and returns nested JSON.

Pros: what most users want
Cons: requires filesystem/workspace notion and recursion rules

### Export option 3: dual: inline + provenance

Return both nested values AND source pointers / form paths for traceability.

Very helpful in agent workflows (trace which file produced which piece of data).

---

## Pros/Cons Summary by Family

| Family | Best When | Main Risk |
| --- | --- | --- |
| **A (separate files)** | Need repetition (per-row subforms); want minimal spec disruption; care about parallel execution | Fragmentation of context unless you standardize context injection |
| **B (embedded)** | Truly want "one artifact" and subforms are few (not repeated) | ID scoping + patch addressing gets complicated fast |
| **C (repeatable groups)** | Want native hierarchical schema model like JSON Schema | Requires scoped IDs or multi-file anyway, plus tooling |
| **D (table + row IDs)** | Strongly want "spreadsheet table feel" in source format | Evolving Markform toward relational features (scope increase) |

---

## Recommendations After Exploring the Space

### Phase 1: External subforms + explicit row IDs (Family A + D1)

- Keep Markform core mostly unchanged.
- Standardize a pattern for table-of-entities:
  - require a *_id column as the stable key (company_id)
  - include a research_form column that is a path/ref (string or url)
- Add harness logic:
  1. fill the table (or at least the company_id/company/url columns)
  2. generate missing subform files from a template
  3. spawn subagents to fill those files in parallel (max concurrency configurable)
  4. optionally return to parent for summary fields

This gives you: stable identity, parallelism, no redesign of field IDs or patch addressing, clean separation between parent and subform lifecycles.

### Phase 2: Make "workspace" first-class in the tool API

For recursive subforms, you'll want either:
- a WorkspaceStore that can hold multiple forms keyed by path/id, or
- a harness that spawns separate sessions per form, plus a higher-level "workspace inspect" operation.

Even without changing the patch schema, having a workspace-level "what's next?" is very useful for caller-owned loops.

### Phase 3: Optional dependency semantics (dependsOn)

Add dependsOn as a schema attribute. Don't overbuild scheduling; just use it to:
- improve context passed into subagents
- avoid premature filling
- enable safe parallel execution decisions

### Phase 4 (only if needed): true embedded/scoped subforms

If later you want single-file nested forms with repetition, that likely forces:
- scoped IDs + path addressing in patches/issues
- or a different mechanism for repeated instances

That's a bigger evolution—don't do it until Phase 1–2 prove the real workflows.
