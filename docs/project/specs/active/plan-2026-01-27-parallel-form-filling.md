# Plan Spec: Parallel Form Filling

## Purpose

Explore design options for parallel execution of form filling, where independent fields
or groups of fields can be processed concurrently by multiple agent instances. This is
increasingly important as Markform forms scale to dozens or hundreds of fields for
large-scale research and analysis tasks.

This document is currently at the **exploration/design options stage** — it lays out the
problem, summarizes relevant current behavior, and presents several candidate approaches
for further discussion.

## Background

### Current Execution Model

Markform's **harness loop** fills forms using a sequential, stateless turn-based model:

```
INIT → STEP → {WAIT ↔ APPLY} → COMPLETE
```

Each **turn** follows: inspect → recommend → apply patches → validate. The agent receives
the full serialized form markdown plus a filtered list of outstanding issues, and responds
with an array of patches. The form markdown itself is the single source of truth — there
is no accumulated conversation history.

**Key current characteristics:**

1. **Single-agent, sequential execution.** One agent processes one turn at a time. There
   is no concept of multiple agents working on different parts of the form simultaneously.

2. **Scope-based filtering (not dependency-based).** The harness uses `maxFieldsPerTurn`
   and `maxGroupsPerTurn` to limit how many distinct fields/groups are surfaced per turn.
   This encourages depth-first focus but is not a dependency or parallelism mechanism.

3. **Field groups are organizational only.** Groups contain fields and can have
   group-level validators, but they carry no execution semantics — no ordering, no
   dependencies, no parallelism hints.

4. **Implicit sequential dependency.** In practice, many form fields have implicit
   dependencies: later fields may reference or depend on answers to earlier fields. For
   example, a "company overview" field should be filled before "competitive analysis"
   because the latter depends on knowing which company. The current model handles this
   naturally because fields are filled sequentially.

5. **Blocking checkboxes** are the only existing dependency primitive. A checkbox field
   with `approvalMode: "blocking"` prevents subsequent fields from being filled until the
   checkbox is complete. This is a limited, linear blocking mechanism.

### Why Parallelism Matters

For large forms (50–200+ fields), sequential filling is slow. A research form about a
company might have independent sections like:

- **Financial data** (revenue, margins, growth rates)
- **Team & leadership** (founders, key hires, board)
- **Market analysis** (TAM, competitors, trends)
- **Product assessment** (features, tech stack, differentiation)

These sections are largely independent — an agent filling "team & leadership" does not
need to wait for "financial data" to complete. Parallelizing across sections could
reduce wall-clock time proportionally to the number of independent sections.

### Constraints and Considerations

1. **Default should be sequential.** Most fields in a form have implicit dependencies on
   prior context. Parallelism should be opt-in, not the default. An execution harness
   should assume fields depend on prior fields unless told otherwise.

2. **Form-as-state architecture.** The current model has one form document as the single
   source of truth. Parallel filling means multiple agents writing to the same document,
   which requires either partitioning (each agent owns disjoint fields) or merging
   (reconcile concurrent edits).

3. **Cross-field validation.** Group-level validators can reference multiple fields. If
   those fields are filled in parallel, validation must be deferred until all contributing
   fields are complete.

4. **Patch conflicts.** Two agents should never write to the same field. The design must
   ensure disjoint write sets.

5. **Context sharing.** Some parallel branches may benefit from seeing results of other
   branches (e.g., "market analysis" might be better if it knows the company's revenue
   scale). Full isolation vs. partial sharing is a design choice.

## Summary of Task

Explore and document design options for expressing and executing parallel form filling in
Markform. The goal is a spec-level design that can be discussed and refined before
implementation.

## Design Options

### Option A: Parallel Attribute on Fields and Groups (Recommended Starting Point)

Add a `parallel` attribute to **both fields and groups**. Items sharing the same
`parallel` value can be executed concurrently. Items without `parallel` are sequential
by default (depend on all prior items).

This works at both granularity levels because the attribute is on existing elements —
no new structural tags or configuration sections are needed.

**Syntax (mixed field and group level):**

```markdown
<!-- field kind="string" id="overview" label="Company Overview" -->...<!-- /field -->

<!-- field kind="string" id="revenue" label="Revenue" parallel="research" -->...<!-- /field -->
<!-- field kind="string" id="team" label="Team" parallel="research" -->...<!-- /field -->
<!-- group id="market" title="Market Analysis" parallel="research" -->
  <!-- field kind="string" id="tam" label="TAM" -->...<!-- /field -->
  <!-- field kind="string" id="competitors" label="Competitors" -->...<!-- /field -->
<!-- /group -->

<!-- field kind="string" id="synthesis" label="Synthesis" -->...<!-- /field -->
```

**Execution order:**
1. `overview` runs first (no `parallel` tag — sequential default).
2. `revenue`, `team`, and the `market` group all run concurrently (same `parallel` tag).
3. `synthesis` runs after all three complete (no tag — sequential, waits for prior items).

**Semantics:**
- Items with the same `parallel` value MAY be executed concurrently.
- Items without `parallel` are sequential — they implicitly depend on all prior items
  completing.
- A sequential item appearing after a parallel batch waits for the entire batch.
- Multiple distinct `parallel` values can coexist (e.g., `parallel="batch_1"` and
  `parallel="batch_2"` are independent batches that execute in document order relative
  to sequential items between them).
- Within a group that has `parallel`, all child fields belong to that parallel batch.
  Individual fields inside such a group do not need their own `parallel` attribute.

**Pros:**
- Simple, declarative. The form author annotates which items are independent.
- Works at both field and group level using the same mechanism.
- No new structural elements — reuses existing fields and groups.
- Safe default: untagged items are sequential, preserving backward compatibility.
- Easy to understand: "tag things that can run together with the same label."

**Cons:**
- Cannot express dependencies *between* parallel batches (e.g., "batch B depends on
  batch A but not on the sequential item before A"). For this, Option B's `dependsOn`
  would be needed.
- Implicit ordering rules (sequential unless annotated) require understanding the
  convention, though it matches natural reading order.

### Option B: Explicit Dependency Graph via `dependsOn`

Add a `dependsOn` attribute to fields and/or groups, referencing IDs of fields or groups
that must be completed first. No `dependsOn` means the field/group is independent and
can start immediately.

**Syntax (field-level):**

```markdown
<!-- field kind="string" id="company_overview" label="Company Overview" -->...<!-- /field -->
<!-- field kind="string" id="financials" label="Financial Data" dependsOn="company_overview" -->...<!-- /field -->
<!-- field kind="string" id="team" label="Team" dependsOn="company_overview" -->...<!-- /field -->
<!-- field kind="string" id="synthesis" label="Synthesis" dependsOn="financials,team" -->...<!-- /field -->
```

**Syntax (group-level):**

```markdown
<!-- group id="overview" title="Overview" -->...<!-- /group -->
<!-- group id="financials" title="Financials" dependsOn="overview" -->...<!-- /group -->
<!-- group id="team" title="Team" dependsOn="overview" -->...<!-- /group -->
<!-- group id="synthesis" title="Synthesis" dependsOn="financials,team" -->...<!-- /group -->
```

**Semantics:**
- A field/group with `dependsOn` cannot begin until all referenced IDs are in `answered`
  state.
- Fields/groups with no `dependsOn` and no prior sequential context are immediately
  available.
- The execution harness builds a DAG and schedules concurrently where possible.

**Pros:**
- Maximum expressiveness. Can represent any dependency structure.
- Works at both field and group level.
- Explicit — no implicit ordering assumptions beyond what's declared.

**Cons:**
- Verbose for large forms. Every independent field needs explicit `dependsOn` or the
  absence of it must be meaningful.
- Requires form authors to think about the full dependency graph, which is nontrivial.
- **The default-independence problem:** If no `dependsOn` is specified, is the field
  independent (can run in parallel) or sequential (depends on all prior)? Both defaults
  have problems:
  - Default-independent: Breaks most forms where fields are implicitly ordered.
  - Default-sequential: Requires explicit opt-in for every parallel field, which is
    verbose.

### Option C: Execution Phases (Ordered Layers)

Divide the form into ordered **phases** (or "waves"). All fields/groups within a phase
can execute in parallel. Phases execute sequentially — phase 2 starts only after phase 1
is complete.

**Syntax (frontmatter-based):**

```yaml
---
markform:
  spec: MF/0.1
  execution:
    phases:
      - id: context
        groups: [overview]
      - id: research
        groups: [financials, team, market, product]
      - id: synthesis
        groups: [synthesis, recommendations]
---
```

**Alternative syntax (inline attribute):**

```markdown
<!-- group id="overview" title="Overview" phase="1" -->...<!-- /group -->
<!-- group id="financials" title="Financials" phase="2" -->...<!-- /group -->
<!-- group id="team" title="Team" phase="2" -->...<!-- /group -->
<!-- group id="synthesis" title="Synthesis" phase="3" -->...<!-- /group -->
```

**Semantics:**
- Phases are ordered numerically or by declaration order.
- All groups/fields within a phase are independent and can run concurrently.
- Phase N+1 begins only when all fields in phase N are complete.
- Fields not assigned to a phase default to a final sequential phase.

**Pros:**
- Simple mental model — "layers" or "waves" of work.
- Easy to reason about: everything in a phase is independent, phases are ordered.
- Natural fit for research forms that have "gather context → deep research → synthesize"
  structure.
- No complex DAG reasoning required from form authors.

**Cons:**
- Less expressive than full DAG. Cannot express "field X in phase 2 depends specifically
  on field Y in phase 1 but not field Z in phase 1."
- Phase boundaries are strict — if one field in a phase is slow, all of phase N+1 waits.
- Somewhat redundant with groups (phases are essentially meta-groups).

### Option D: Hybrid — Default Sequential with Parallel Annotation

Keep the default assumption that fields are sequential (depend on all prior fields), but
allow explicit `parallel` annotations to mark groups of fields that can execute
concurrently. This combines the safety of Option A with the simplicity of not requiring
a full dependency graph.

**Syntax:**

```markdown
<!-- group id="overview" title="Overview" -->...<!-- /group -->

<!-- parallel -->
  <!-- group id="financials" title="Financials" -->...<!-- /group -->
  <!-- group id="team" title="Team" -->...<!-- /group -->
  <!-- group id="market" title="Market" -->...<!-- /group -->
<!-- /parallel -->

<!-- group id="synthesis" title="Synthesis" -->...<!-- /group -->
```

**Semantics:**
- By default, groups/fields are sequential (top-to-bottom ordering implies dependency).
- `<!-- parallel -->` blocks explicitly mark enclosed groups as concurrently executable.
- Everything before a parallel block must complete before the block starts.
- Everything after a parallel block waits for all items within it to complete.
- Parallel blocks can be nested (for sub-parallelism within a branch).

**Pros:**
- Safe default (sequential). No existing forms break.
- Explicit and visually clear — the parallel block is a structural element in the
  markdown.
- No need for dependency IDs or phase numbers.
- Composable — parallel blocks can appear anywhere in the form.

**Cons:**
- New structural element (`parallel` tag) adds complexity to the syntax.
- Cannot express partial dependencies within a parallel block (e.g., "A and B are
  parallel, but C depends only on A").
- May not compose well with nested groups (future feature).

### Option E: Harness-Level Parallelism (No Schema Changes)

Rather than adding parallelism to the form schema, add it to the **harness
configuration**. The harness would analyze the form and determine parallelism
automatically or via config hints.

**Syntax (harness config in frontmatter):**

```yaml
---
markform:
  spec: MF/0.1
  harness_config:
    parallel_groups:
      - [financials, team, market]
      - [product, tech_stack]
    max_parallel_agents: 4
---
```

**Semantics:**
- The form schema is unchanged — no new attributes on fields or groups.
- The harness config specifies which groups can run in parallel.
- The harness spawns multiple agent instances, each given a subset of the form.
- Each agent sees the full form context but is instructed to fill only its assigned
  groups/fields.

**Pros:**
- No schema changes. Existing forms and parsers are unaffected.
- Parallelism is a runtime concern, not a structural one.
- Easy to experiment with different parallelism strategies without changing the form.
- Harness config is already an established concept.

**Cons:**
- Parallelism intent is separated from the form content, reducing readability.
- Form authors must maintain two things (form structure + harness config) that must agree.
- Less portable — a different harness implementation might not honor the config.
- Cannot express field-level parallelism, only group-level.

## Comparison Matrix

| Criterion | A: Parallel Attr | B: DependsOn | C: Phases | D: Parallel Block | E: Harness Config |
|---|---|---|---|---|---|
| Schema changes | Minimal | Moderate | Moderate | Moderate | None |
| Expressiveness | Medium | High | Medium | Medium | Low |
| Authoring complexity | Low | High | Low | Low | Low |
| Default safety | Good | Depends | Good | Good | Good |
| Granularity | Field + Group | Field or Group | Group | Group | Group |
| Visual clarity | Medium | Low | Medium | High | Low |
| Backward compatible | Yes | Yes | Yes | Yes | Yes |
| Implementation complexity | Low | High | Medium | Medium | Low |

## Recommendation

**Option A (parallel attribute on fields and groups)** is the strongest starting point:

- It works at both field and group granularity with a single, simple attribute.
- The sequential-by-default behavior is safe and backward compatible.
- No new structural elements — it extends existing fields and groups.
- It covers the most common case: "these sections are independent, run them together."

**Option B (dependsOn)** could be added later as an orthogonal enhancement if users need
fine-grained inter-batch dependencies. The two attributes compose naturally: `parallel`
for grouping concurrent work, `dependsOn` for expressing specific prerequisites.

**Option E (harness config)** remains useful as a prototyping vehicle — the harness can
interpret `parallel` attributes, but the config could also override or extend them at
runtime without schema changes.

**Suggested phased approach:**
- **Phase 1:** Implement Option A (`parallel` attribute) in schema + harness.
- **Phase 2:** Add Option B (`dependsOn`) if DAG-level control is needed.
- **Phase 3:** Consider Option E (harness config overrides) for runtime tuning.

## Open Questions

- [ ] Should parallel agents see each other's partial results, or work in full isolation
  until merge?
- [ ] How should cross-group validators work when their constituent fields are filled in
  parallel? (Likely: defer validation until all contributing fields complete.)
- [ ] Should the form author or the harness decide the degree of parallelism
  (max agents)?
- [ ] Can we auto-detect independence? (e.g., groups with no shared validator references
  are independent.) This could reduce annotation burden.
- [ ] How does parallelism interact with the `role` system? (e.g., user-role fields
  filled interactively while agent-role fields fill in parallel.)
- [ ] What is the merge strategy when parallel agents complete? Simple field-disjoint
  merge (each agent owns disjoint fields) seems safest.
- [ ] Should we support field-level parallelism within a group, or is group-level
  sufficient for the foreseeable use cases?

## Appendix: Execution Model Sketch

Regardless of which schema option is chosen, the parallel harness execution would
roughly work as:

```
1. Parse form, identify parallelizable units (groups/fields)
2. Build execution graph (DAG of units with dependencies)
3. Identify "ready" units (no unmet dependencies)
4. For each ready unit, spawn an agent instance:
   a. Agent receives: full form markdown + instructions to fill only assigned fields
   b. Agent returns: patches for its assigned fields only
5. Apply patches from completed agents (disjoint fields, no conflicts)
6. Re-validate form
7. Identify newly ready units (dependencies now met)
8. Repeat 4-7 until all units complete or max turns exceeded
```

**Key constraint:** Each field is assigned to exactly one agent. No two agents write to
the same field. This eliminates merge conflicts by construction.
