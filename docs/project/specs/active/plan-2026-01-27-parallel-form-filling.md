# Plan Spec: Parallel Form Filling

## Purpose

Define how Markform forms can express parallelism and fill ordering. Two new optional
attributes:

- **`parallel`** — indicates which fields or groups are independent and can be filled
  concurrently by separate agents.
- **`order`** — controls the sequence in which the harness presents fields, ensuring
  synthesis fields are filled after the fields they depend on.

Both are entirely optional: forms without these annotations behave exactly as they do
today (loose-serial mode).

**Related docs:**
- `docs/markform-spec.md` — Main specification (Layers 1–4)
- `docs/markform-reference.md` — Quick reference
- `docs/markform-apis.md` — API documentation
- `docs/project/architecture/current/arch-markform-design.md` — Architecture

**Syntax note:** This spec uses HTML comment syntax (`<!-- tag -->`) in examples, but all
Markform syntax has equivalent Markdoc tag forms. Both are always supported.

## Background

### Current Execution Model

Markform's **harness loop** fills forms using a sequential, stateless turn-based model:

```
INIT → STEP → {WAIT ↔ APPLY} → COMPLETE
```

Each **turn** follows: inspect → recommend → apply patches → validate. The agent receives
the full serialized form markdown plus a filtered list of outstanding issues, and responds
with an array of patches. The form markdown itself is the single source of truth.

**Key current characteristics:**

1. **Single-agent, sequential execution.** One agent processes one turn at a time. There
   is no concept of multiple agents working on different parts of the form simultaneously.

2. **Scope-based filtering (not dependency-based).** The harness uses `maxFieldsPerTurn`
   and `maxGroupsPerTurn` to limit how many distinct fields/groups are surfaced per turn.
   This encourages depth-first focus but is not a dependency or parallelism mechanism.

3. **Field groups are organizational only.** Groups contain fields and can have
   group-level validators, but carry no execution semantics — no ordering, no
   dependencies, no parallelism hints.

4. **Implicit sequential dependency.** In practice, many form fields have implicit
   dependencies: later fields may reference or depend on answers to earlier fields (e.g.,
   "company overview" should be filled before "competitive analysis"). The current model
   handles this naturally through sequential execution.

5. **Blocking checkboxes** are the only existing dependency primitive. A checkbox field
   with `approvalMode: "blocking"` prevents subsequent fields from being filled until
   the checkbox is complete.

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

### Key Constraints

1. **Default must be sequential.** Most fields have implicit dependencies on prior
   context. Parallelism is opt-in. An execution harness should assume fields depend on
   prior fields unless told otherwise.

2. **Form-as-state architecture.** Parallel filling means multiple agents writing to the
   same document, requiring partitioning — each agent owns disjoint fields.

3. **Cross-field validation.** Group-level validators can reference multiple fields. If
   those fields are filled in parallel, validation must be deferred until all
   contributing fields are complete.

4. **Patch conflicts.** Two agents must never write to the same field. The design
   ensures disjoint write sets by assigning each field to exactly one execution unit.

## Summary of Task

Add two new attributes to the Markform specification:

1. **`parallel`** — applied to top-level fields and groups. Items sharing the same
   `parallel` value are independent and may be executed concurrently by separate agents.
   Items without `parallel` are filled in loose-serial mode (as today).

2. **`order`** — applied to fields and groups. Controls fill sequence: lower values are
   filled first. The harness guarantees fields at different order levels are filled in
   separate turns, so higher-order fields always see completed lower-order field values.
   Default is `0`.

This is a four-phase effort:

- **Phase 1 — Spec & Design:** Define `parallel` and `order` attribute semantics, update
  the Markform specification, and document the execution model.
- **Phase 2 — TypeScript API:** Parse, validate, serialize, and expose both attributes in
  the engine types and APIs. Implement order-based issue filtering and execution plan
  computation.
- **Phase 3 — ParallelHarness (low-level):** Implement `ParallelHarness` class for
  concurrent agent orchestration — scoped filling, patch merge, concurrency limits.
- **Phase 4 — Unified fillForm() (high-level):** Integrate parallel execution into the
  existing `fillForm()` entry point as an opt-in feature, so consumers get parallel
  execution by adding `enableParallel: true` without changing their call structure.

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: MAINTAIN — both attributes are additive
- **Library APIs**: MAINTAIN — existing forms without new attributes behave identically
- **File formats**: MAINTAIN — both attributes are optional; existing forms unchanged
- **Server APIs**: N/A
- **Database schemas**: N/A

## Stage 1: Planning Stage

### Design: The `parallel` Attribute

Add a `parallel` attribute to **top-level fields and groups** (items directly under the
form tag). Items sharing the same `parallel` value can be executed concurrently by
separate agents. Items without `parallel` remain in "loose serial" mode — filled by a
single agent in whatever order it chooses.

#### Current Model: Loose Serial

Today, all forms operate in what we call **loose serial** mode: a single agent sees all
fields and fills them in whatever order it deems appropriate. There is no enforced
ordering — the agent may fill field 10 before field 3 if it wants. Dependencies between
fields are implicit (the agent uses its judgment).

This mode is preserved exactly as-is. The `parallel` attribute does not change the
behavior of any non-annotated items. It only adds the *option* for a parallel-aware
harness to spawn concurrent agents for annotated items.

#### What `parallel` Means

`parallel` is a **pure concurrency hint**. It tells the harness: "these items are
independent and can be worked on by separate agents at the same time." That is the entire
semantic — no barriers, no ordering constraints, no implicit dependencies.

Specifically:
- Items **with** `parallel` may be assigned to separate concurrent agents, one per item
  (or per batch member).
- Items **without** `parallel` remain in the default loose-serial pool, filled by the
  primary agent in whatever order it chooses.
- There is **no barrier** between parallel batches and serial items. The harness does not
  wait for parallel items to finish before the primary agent continues with serial items,
  nor vice versa.
- When all agents (primary + parallel) finish, their patches are merged into the form.
  Patches target disjoint fields by construction (each parallel agent is scoped to its
  items).

A harness that does not support parallelism simply ignores the attribute and fills
everything in loose-serial mode. All forms remain valid.

#### Syntax

```markdown
<!-- form id="company_research" title="Company Research" -->

<!-- group id="overview" title="Context" -->
  <!-- field kind="string" id="company_name" label="Company Name" required=true -->
  <!-- /field -->
  <!-- field kind="string" id="company_overview" label="Company Overview" -->
  <!-- /field -->
<!-- /group -->

<!-- group id="financials" title="Financial Data" parallel="deep_research" -->
  <!-- field kind="number" id="revenue" label="Annual Revenue ($M)" --><!-- /field -->
  <!-- field kind="string" id="margins" label="Margin Analysis" --><!-- /field -->
<!-- /group -->

<!-- field kind="string" id="team" label="Team & Leadership" parallel="deep_research" -->
<!-- /field -->

<!-- group id="market" title="Market Analysis" parallel="deep_research" -->
  <!-- field kind="string" id="tam" label="TAM" --><!-- /field -->
  <!-- field kind="string" id="competitors" label="Competitors" --><!-- /field -->
<!-- /group -->

<!-- group id="synthesis" title="Synthesis" -->
  <!-- field kind="string" id="overall" label="Overall Assessment" --><!-- /field -->
<!-- /group -->

<!-- /form -->
```

#### Execution Model

In this example, a parallel-aware harness would:

1. **Primary agent** starts filling the form in loose-serial mode. It handles `overview`,
   `synthesis`, and any other untagged items in whatever order it chooses.
2. **Parallel agents** are spawned for the `deep_research` batch. Each agent is scoped
   to one item: one fills `financials`, one fills `team`, one fills `market`. They run
   concurrently with each other and with the primary agent.
3. When all agents finish, patches are merged. Each agent wrote to disjoint fields, so
   no conflicts occur.

There are no barriers. The primary agent does not wait for parallel agents (or vice
versa). If the primary agent reaches `synthesis` before the parallel agents finish the
research fields, that's fine — it fills what it can with the context available, just as
it would in today's loose-serial mode.

#### Semantics

1. **Parallel batches.** Items with the same `parallel` value form a *parallel batch*.
   All items in a batch MAY be executed concurrently by separate agents.

2. **Loose serial default.** Items without `parallel` are filled by the primary agent in
   loose-serial mode — no enforced ordering, no barriers. This is identical to today's
   behavior.

3. **No barriers.** There is no implicit dependency between parallel and non-parallel
   items. The `parallel` attribute says "this can run concurrently," not "this must
   complete before the next thing starts." If a harness wants barrier semantics, that
   would be expressed via a future `dependsOn` attribute (see Future Directions).

4. **Multiple batches.** Multiple distinct `parallel` values can coexist. Each batch is
   a separate set of concurrent agents. Example:

   ```markdown
   <!-- field id="a" label="A" --><!-- /field -->                    <!-- loose serial -->
   <!-- field id="b" label="B" parallel="batch_1" --><!-- /field -->  <!-- batch_1 agent -->
   <!-- field id="c" label="C" parallel="batch_1" --><!-- /field -->  <!-- batch_1 agent -->
   <!-- field id="d" label="D" --><!-- /field -->                    <!-- loose serial -->
   <!-- field id="e" label="E" parallel="batch_2" --><!-- /field -->  <!-- batch_2 agent -->
   <!-- field id="f" label="F" parallel="batch_2" --><!-- /field -->  <!-- batch_2 agent -->
   ```

   The primary agent handles `{a, d}` in loose-serial mode. Batch 1 agents handle
   `{b, c}` concurrently. Batch 2 agents handle `{e, f}` concurrently. All run
   simultaneously — no ordering between batches or between batches and serial items.

5. **Top-level only.** `parallel` applies to top-level items: fields directly under the
   form tag, and groups directly under the form tag. A group with `parallel` is the
   execution unit — all its child fields are filled by one agent as a unit. Fields
   *inside* a group MUST NOT have a `parallel` attribute (parse error). If you want
   field-level parallelism, place those fields at the top level or in separate
   single-field groups.

6. **Hint, not mandate.** The attribute expresses *permission* for concurrency, not a
   requirement. A harness that doesn't support parallelism ignores it and fills
   everything in loose-serial mode.

7. **Disjoint writes.** Each parallel item is assigned to exactly one agent. No two
   concurrent agents write to the same field.

8. **Same role.** All items in a parallel batch MUST have the same effective `role`
   (parse error otherwise). For this rule, an unset `role` is equivalent to the default
   `"agent"` role. This ensures all items in a batch are filled by the same type of
   actor — mixing user-role and agent-role items in a single concurrent batch would be
   incoherent.

9. **Deferred validation.** Cross-field validators (group-level `validate`) that
   reference fields across parallel items are evaluated after all agents complete, not
   incrementally.

#### Attribute Rules

| Rule | Detail |
| --- | --- |
| Attribute name | `parallel` |
| Value type | String (arbitrary identifier, recommended `snake_case`) |
| Applies to | Top-level `field` tags and `group` tags (directly under `form`) |
| Default | Absent (loose serial) |
| Uniqueness | Not unique — same value used on multiple items to form a batch |
| Nesting | NOT allowed on fields inside groups (parse error) |

#### Error Conditions

| Condition | Error |
| --- | --- |
| Field inside a group has `parallel` attribute | `Field '${fieldId}' has parallel='${fieldVal}' but is inside group '${groupId}'. The parallel attribute is only allowed on top-level fields and groups.` |
| Items in a parallel batch have different effective `order` values | `Parallel batch '${batchId}' has items with different order values (${orderValues}). All items in a parallel batch must have the same order.` |
| Items in a parallel batch have different effective `role` values | `Parallel batch '${batchId}' has items with different roles (${roles}). All items in a parallel batch must have the same role.` |

### Scope

**In scope:**

- `parallel` attribute on top-level `field` and `group` tags
- `order` attribute on `field` and `group` tags
- Parse, validate, and serialize both attributes
- Expose `parallel` and `order` on `FieldBase` and `FieldGroup` TypeScript types
- Execution plan computation: given a parsed form, compute loose-serial pool and
  parallel batches
- Order-based issue filtering in the harness: only surface issues for the current
  (lowest incomplete) order level
- Parallel harness that spawns concurrent agent instances for each batch item
- AI SDK integration for parallel agent execution

**Not in scope:**

- Dependency DAG (`dependsOn`) — future enhancement
- Auto-detection of independent fields — future enhancement
- Nested groups — not yet supported in MF/0.1
- Inter-batch context sharing (each parallel agent sees the form state as of batch
  start; they do not see each other's partial results)

### Acceptance Criteria

1. Forms without `parallel` or `order` behave identically to today (all existing tests pass)
2. `parallel` attribute is parsed from both HTML comment and Markdoc tag syntax
3. `parallel` is round-tripped through parse → serialize
4. `parallel` appears on `FieldBase` and `FieldGroup` types as `parallel?: string`
5. Execution plan correctly identifies loose-serial items and parallel batches
6. Error on `parallel` attribute on a field inside a group
8. `order` attribute is parsed from both syntaxes; defaults to `0` when absent
9. `order` is round-tripped through parse → serialize
10. `order` appears on `FieldBase` and `FieldGroup` types as `order?: number`
11. Harness only surfaces issues for the current (lowest incomplete) order level
12. Fields at different order levels are always filled in separate turns
13. Error on field inside a group specifying a different `order` than the group
14. Error on parallel batch items with different effective `order` values
15. Error on parallel batch items with different effective `role` values
16. Parallel harness can spawn concurrent agents per batch item
17. Parallel harness correctly merges patches from all agents

### Design Decisions

1. **String value, not boolean.** Using a string (batch name) rather than `parallel=true`
   allows multiple independent parallel batches in the same form. A boolean would only
   support "parallel or not" without distinguishing batches.

2. **Loose serial default.** Safest choice — existing forms and new forms without
   annotation work exactly as they do today. Authors opt in to parallelism explicitly.

3. **Hint, not mandate.** A harness that doesn't support parallelism simply ignores the
   attribute. This keeps the attribute purely additive.

4. **No barriers.** The `parallel` attribute is purely about concurrency, not ordering.
   We deliberately avoid implicit dependency semantics (e.g., "serial items before a
   batch must complete first") because the current model has no enforced ordering either.
   Barriers and dependencies are a separate concern, reserved for a future `dependsOn`
   attribute.

5. **Top-level only.** Restricting `parallel` to top-level items (not fields inside
   groups) keeps the execution model simple: each top-level item is either in the
   loose-serial pool or in a parallel batch. Sub-parallelism within groups is a future
   enhancement.

6. **`parallel` and `order` are orthogonal.** `parallel` controls *concurrency* (can
   these items run at the same time?). `order` controls *sequencing* (which items are
   presented first?). They compose but serve different purposes. A parallel batch runs
   at a single order level; `order` determines *when* the batch runs relative to other
   items, while `parallel` determines that batch items run *concurrently*.

### Design: The `order` Attribute

Add an `order` attribute to fields and groups that controls the **fill sequence** —
which fields the harness presents to the agent first. This addresses the common need
for synthesis/summary fields that should be filled after other fields provide context.

#### What `order` Means

`order` is a **numeric attribute** that controls issue prioritization in the harness.
Fields with lower `order` values are surfaced to the agent before fields with higher
values. The harness **guarantees** that fields at different order levels are filled in
separate turns, so the agent filling higher-order fields always sees the completed
values of lower-order fields in the form markdown.

#### Syntax

```markdown
<!-- form id="company_research" title="Company Research" -->

<!-- field kind="string" id="company_name" label="Company Name" required=true -->
<!-- /field -->

<!-- field kind="string" id="revenue" label="Revenue" -->
<!-- /field -->

<!-- field kind="string" id="team" label="Team & Leadership" -->
<!-- /field -->

<!-- field kind="string" id="executive_summary" label="Executive Summary" order=99 -->
<!-- /field -->

<!-- /form -->
```

Here `company_name`, `revenue`, and `team` all have the default `order=0`. They are
filled in whatever order the agent chooses (loose serial). The `executive_summary` has
`order=99`, so the harness will not surface its issues until all `order=0` fields are
complete. When the agent finally sees `executive_summary`, the form markdown will
already contain the filled-in values for all the other fields.

#### Semantics

1. **Numeric value.** `order` accepts any numeric value (integer or float). Lower values
   are filled first.

2. **Default is `0`.** Fields and groups without `order` default to `0`. This means all
   existing forms are unaffected — everything is at the same level, filled in loose-serial
   order as today.

3. **Turn separation guarantee.** The harness MUST NOT surface issues for fields at
   `order=N` until all fields at `order<N` are complete (answered, skipped, or aborted).
   This means fields at different order levels are always filled in separate agent turns.

4. **Loose serial within a level.** Fields sharing the same `order` value are filled in
   loose-serial mode — the agent chooses the order within that level.

5. **Applies to fields and groups.** When `order` is on a group, all fields in that group
   are at the group's order level. A field inside a group MUST NOT specify a different
   `order` value (parse error). For this rule, an unset `order` is equivalent to
   `order=0` — so a field with no `order` inside a group with `order=0` (or no `order`)
   is valid, but a field with no `order` inside a group with `order=5` is an error. If
   you need fields at different order levels, place them in separate groups. This is
   consistent with `parallel` — both attributes are set on the execution unit (field or
   group) with no child-level overrides.

6. **Composes with `parallel`.** All items in a parallel batch MUST have the same
   effective `order` value (parse error otherwise). Since unset defaults to `0`, a batch
   where no item specifies `order` is valid (all at `0`). This keeps the execution model
   simple: a batch runs at a single order level, and the harness doesn't need to
   sequence items within a batch.

7. **Implemented via issue filtering.** The harness already filters issues per turn
   (`maxFieldsPerTurn`, `maxGroupsPerTurn`, `maxIssuesPerTurn`). The `order` attribute
   adds one more filter: only surface issues for the current (lowest incomplete) order
   level. This requires no new execution machinery — it works within the existing
   step/apply harness loop.

#### Attribute Rules

| Rule | Detail |
| --- | --- |
| Attribute name | `order` |
| Value type | Number (integer or float) |
| Applies to | `field` tags and `group` tags |
| Default | `0` |
| Nesting | Field inside a group with `order` MUST NOT specify a different `order` (parse error) |

#### Examples

**Simple "fill last":**

```markdown
<!-- field kind="string" id="details" label="Detailed Analysis" --><!-- /field -->
<!-- field kind="string" id="summary" label="Executive Summary" order=99 --><!-- /field -->
```

`details` (order=0) is filled first. `summary` (order=99) is filled in a later turn
after `details` is complete.

**Three-phase research form:**

```markdown
<!-- group id="context" title="Context" order=-1 -->
  <!-- field kind="string" id="company" label="Company Name" required=true --><!-- /field -->
  <!-- field kind="string" id="overview" label="Overview" --><!-- /field -->
<!-- /group -->

<!-- group id="financials" title="Financials" parallel="research" -->
  <!-- field kind="number" id="revenue" label="Revenue" --><!-- /field -->
<!-- /group -->

<!-- group id="team" title="Team" parallel="research" -->
  <!-- field kind="string" id="founders" label="Founders" --><!-- /field -->
<!-- /group -->

<!-- group id="synthesis" title="Synthesis" order=10 -->
  <!-- field kind="string" id="assessment" label="Overall Assessment" --><!-- /field -->
<!-- /group -->
```

Execution:
1. `context` group (order=-1) is filled first — the agent gets company name and overview.
2. `financials` and `team` groups (order=0, parallel="research") run concurrently.
3. `synthesis` group (order=10) is filled last — the agent sees all prior fields completed.

**Negative values for "fill first":**

```markdown
<!-- field kind="string" id="context" label="Context" order=-10 --><!-- /field -->
<!-- field kind="string" id="main" label="Main Content" --><!-- /field -->
<!-- field kind="string" id="summary" label="Summary" order=10 --><!-- /field -->
```

Order: `context` (-10) → `main` (0) → `summary` (10).

## Stage 2: Architecture Stage

### Phase 1: Spec & Design

Update the Markform specification documents to define `parallel` and `order`.

**Tasks:**

- [ ] Add `parallel` attribute to Layer 1 (Syntax) in `docs/markform-spec.md`
  - Add to field tag attribute table
  - Add to group tag attribute table
  - Add new subsection "Parallel Execution Hints"
- [ ] Add `order` attribute to Layer 1 (Syntax) in `docs/markform-spec.md`
  - Add to field tag attribute table
  - Add to group tag attribute table
  - Add new subsection "Fill Order"
- [ ] Add execution plan semantics to Layer 3 (Validation & Form Filling)
  - Define execution plan (loose-serial pool + parallel batches)
  - Define order-based issue filtering
  - Define deferred validation for cross-batch validators
- [ ] Update `docs/markform-reference.md` with `parallel` and `order` attributes
- [ ] Add examples showing parallel and ordered forms to examples directory

**Spec additions to `docs/markform-spec.md`:**

#### Layer 1 addition: Parallel Execution Hints

> ##### Parallel Execution Hints
>
> Top-level fields and groups MAY include a `parallel` attribute to indicate that they
> can be filled concurrently with other items sharing the same value.
>
> ```markdown
> <!-- field kind="string" id="a" label="A" parallel="batch_1" --><!-- /field -->
> <!-- field kind="string" id="b" label="B" parallel="batch_1" --><!-- /field -->
> ```
>
> **Rules:**
> - `parallel` value is an arbitrary string identifier (recommended: `snake_case`)
> - Items with the same `parallel` value form a *parallel batch*
> - Items without `parallel` remain in loose-serial mode (single agent, no enforced
>   ordering) — identical to current behavior
> - `parallel` MUST NOT appear on fields inside groups (parse error) — only on
>   top-level fields and groups
> - All items in a parallel batch MUST have the same effective `role` (parse error)
> - `parallel` is a hint — a harness MAY ignore it and fill everything in
>   loose-serial mode
>
> **Execution model:**
> ```
> Without parallel: All items filled by one agent in loose-serial mode (current behavior).
>
> With parallel: Items are partitioned into two pools:
>   1. Loose-serial pool: items without `parallel`, filled by primary agent
>   2. Parallel batches: items with `parallel`, each item filled by a separate agent
> All agents (primary + parallel) run concurrently. No barriers between them.
> ```

#### Layer 1 addition: Fill Order

> ##### Fill Order
>
> Fields and groups MAY include an `order` attribute (numeric) that controls the
> sequence in which the harness presents fields to the agent.
>
> ```markdown
> <!-- field kind="string" id="details" label="Details" --><!-- /field -->
> <!-- field kind="string" id="summary" label="Summary" order=99 --><!-- /field -->
> ```
>
> **Rules:**
> - `order` is a number (integer or float). Default: `0`.
> - Lower `order` values are filled first. Fields at the same order level are
>   filled in loose-serial order (agent chooses).
> - The harness MUST NOT surface issues for `order=N` fields until all fields at
>   `order<N` are complete (answered, skipped, or aborted).
> - Fields at different order levels are always filled in separate agent turns.
> - A field inside a group with `order` MUST NOT specify a different `order`
>   (parse error). Use separate groups for different order levels.
> - `order` composes with `parallel`: all items in a parallel batch MUST have the
>   same effective `order` value (parse error otherwise).

#### Layer 3 addition: Execution Plan

> ##### Execution Plan
>
> An **execution plan** partitions top-level form items into a loose-serial pool and
> zero or more parallel batches:
>
> ```typescript
> interface ExecutionPlan {
>   /** Items without `parallel` — filled by primary agent in loose-serial mode */
>   looseSerial: Array<{ itemId: Id; itemType: 'field' | 'group' }>;
>
>   /** Parallel batches — each item filled by a separate concurrent agent */
>   parallelBatches: Array<{
>     batchId: string;
>     items: Array<{ itemId: Id; itemType: 'field' | 'group' }>;
>   }>;
> }
> ```
>
> **Computation:** Walk top-level items (fields and groups) in document order:
> - If item has no `parallel`: add to the loose-serial pool
> - If item has `parallel`: add to the batch with that ID (create batch if new)
>
> Note: `parallel` is only valid on top-level fields and groups. A field inside a
> group that sets `parallel` produces a parse error (see validation rules below),
> so the planner only needs to inspect top-level items.
>
> **Execution:** The primary agent fills loose-serial items. For each parallel batch,
> one agent per item is spawned. All agents (primary + batch agents) run concurrently.
> When all complete, patches are merged and validation runs.

### Phase 2: TypeScript API Changes

Parse, validate, serialize, and expose `parallel` and `order` through the engine.

**Tasks:**

- [ ] Add `parallel?: string` to `FieldBase` interface in `coreTypes.ts`
- [ ] Add `parallel?: string` to `FieldGroup` interface in `coreTypes.ts`
- [ ] Add `order?: number` to `FieldBase` interface in `coreTypes.ts`
- [ ] Add `order?: number` to `FieldGroup` interface in `coreTypes.ts`
- [ ] Add `parallel` and `order` to `FieldBaseSchema` and `FieldGroupSchema` Zod schemas
- [ ] Update parser (`parse.ts` / `parseFields.ts`) to extract `parallel` and `order`
  attributes from field and group tags
- [ ] Add validation: field inside a group with `order` must not specify a different `order`
- [ ] Add validation: `parallel` on field inside group is a parse error
- [ ] Add validation: parallel batch items with differing `order` values
- [ ] Add validation: parallel batch items with differing `role` values
- [ ] Update serializer to emit `parallel` and `order` attributes on field and group tags
- [ ] Add `computeExecutionPlan(form: ParsedForm): ExecutionPlan` function
- [ ] Export `ExecutionPlan` type and `computeExecutionPlan` from public API
- [ ] Update `InspectResult` to include execution plan (optional, for tooling)
- [ ] Add unit tests for parsing `parallel` and `order` (both syntaxes)
- [ ] Add unit tests for `order` on groups and conflicting field `order` error
- [ ] Add unit tests for validation errors
- [ ] Add unit tests for `computeExecutionPlan`
- [ ] Add golden tests for round-trip with `parallel` and `order`
- [ ] Implement order-based issue filtering in `filterIssuesByScope()`:
  - Effective order for a top-level item is `item.order ?? 0` (fields inside groups
    use the group's order; child overrides are already a parse error)
  - Only include issues for fields at the current (lowest incomplete) order level
  - "Complete" for order gating means: all fields at that level are answered, skipped,
    or aborted
- [ ] Implement `markform plan` CLI command (see below)
- [ ] Add sample forms with `parallel` and `order` to examples directory
- [ ] Add session tests that run `markform plan` on sample forms and validate output

**Key type changes:**

```typescript
// coreTypes.ts
interface FieldBase {
  // ... existing fields
  parallel?: string;  // Parallel batch identifier (top-level only)
  order?: number;     // Fill order (default: 0). Lower = filled first.
}

interface FieldGroup {
  // ... existing fields
  parallel?: string;  // Parallel batch identifier
  order?: number;     // Fill order (default: 0). Applies to all child fields.
}

// New: Execution plan types
interface ExecutionPlanItem {
  itemId: Id;
  itemType: 'field' | 'group';
}

interface ParallelBatch {
  batchId: string;
  items: ExecutionPlanItem[];
}

interface ExecutionPlan {
  looseSerial: ExecutionPlanItem[];
  parallelBatches: ParallelBatch[];
  /** Distinct order levels found in the form, sorted ascending */
  orderLevels: number[];
}

// New function
function computeExecutionPlan(form: ParsedForm): ExecutionPlan;
// Note: effective order is simply `item.order ?? 0` — no helper needed.
```

**Parser changes (`parseFields.ts`):**

```typescript
// In parseField():
const parallel = getStringAttr(node, 'parallel');
// Add to field object: parallel

// In group parsing:
const groupParallel = getStringAttr(groupNode, 'parallel');
// Validate no field inside a group has parallel
for (const field of group.children) {
  if (field.parallel) {
    throw new MarkformParseError(
      `Field '${field.id}' has parallel='${field.parallel}' but is inside ` +
      `group '${group.id}'. The parallel attribute is only allowed on ` +
      `top-level fields and groups.`
    );
  }
}
```

**`markform plan` CLI command:**

A new command that computes the **idealized execution plan** — the most efficient
schedule given the form's `parallel`, `order`, and `role` constraints — without actually
filling anything. It shows what the harness *would* do if agents filled fields in
exactly the order requested. In practice, an agent may fill fewer fields per turn or
choose a different order within a level, but the plan represents the optimal expected
sequence. This is valuable for:

- **Debugging** `parallel` and `order` attributes during form authoring
- **Validating** plan logic in Phase 2 before wiring up parallel execution in Phase 3
- **Session tests** that assert the plan output matches expectations for sample forms

```
markform plan <file> [options]
  --format <format>    Output format: console (default), json
  --roles <roles>      Target roles (default: agent)
  --max-fields <n>     maxFieldsPerTurn override
  --max-groups <n>     maxGroupsPerTurn override
```

**Example output (console format):**

```
Plan: company_research (Company Research)

Order level 0 (4 items):
  Loose serial (primary agent):
    - overview [group: Context]
        company_name (Company Name) — required, unanswered
        company_overview (Company Overview) — unanswered
  Parallel batch "deep_research" (3 items, 3 agents):
    - financials [group: Financial Data]
        revenue (Annual Revenue) — unanswered
        margins (Margin Analysis) — unanswered
    - team (Team & Leadership) — unanswered
    - market [group: Market Analysis]
        tam (TAM) — unanswered
        competitors (Competitors) — unanswered

Order level 10 (1 item):
  Loose serial (primary agent):
    - synthesis [group: Synthesis]
        overall (Overall Assessment) — unanswered

Summary: 2 order levels, 1 parallel batch, 5 turns minimum
```

**Example output (json format):**

```json
{
  "formId": "company_research",
  "orderLevels": [
    {
      "order": 0,
      "looseSerial": [
        { "itemId": "overview", "itemType": "group", "fields": ["company_name", "company_overview"] }
      ],
      "parallelBatches": [
        {
          "batchId": "deep_research",
          "items": [
            { "itemId": "financials", "itemType": "group", "fields": ["revenue", "margins"] },
            { "itemId": "team", "itemType": "field" },
            { "itemId": "market", "itemType": "group", "fields": ["tam", "competitors"] }
          ]
        }
      ]
    },
    {
      "order": 10,
      "looseSerial": [
        { "itemId": "synthesis", "itemType": "group", "fields": ["overall"] }
      ],
      "parallelBatches": []
    }
  ]
}
```

**Implementation:** The command parses the form and validates it — if the form has parse
or validation errors, `plan` exits with an error (the form must be structurally valid
before planning). The form may be empty or partially filled; the plan reflects the
*remaining* work — only unanswered/incomplete fields appear in the plan output. A fully
filled form produces an empty plan.

After validation, the command calls `computeExecutionPlan()` and runs `inspect()` to
determine which fields still need work. It groups remaining items by order level and
renders the plan. No agents are invoked — this is pure computation.

**Session tests:** Add sample forms to `examples/` that exercise `parallel` and `order`
(e.g., `examples/parallel/parallel-research.md`). Session tests run `markform plan` on
each sample form and snapshot the JSON output, similar to how `sessionReplay.test.ts`
snapshots fill sessions. This validates the plan logic end-to-end without needing mock
agents.

### Phase 3: Harness & AI SDK Implementation

Implement parallel execution in the harness and live agent.

**Tasks:**

- [ ] Add `ParallelHarness` class (or extend `FormHarness`) that uses execution plan
  - Note: order-based issue filtering is implemented in Phase 2; since all items in a
    parallel batch share the same order, order-gating operates at the batch level —
    a batch either runs or waits
- [ ] Implement concurrent agent spawning for parallel batches
- [ ] Each parallel agent receives:
  - Full form markdown (read-only context for all fields)
  - Instructions to fill only its assigned fields/groups
  - The filtered issue list scoped to its assigned fields
- [ ] Implement patch merge: collect patches from all parallel agents, validate disjoint
  field sets, apply all patches in one `applyPatches` call
- [ ] Implement deferred validation: run cross-batch validators after batch completes
- [ ] Add `maxParallelAgents?: number` to `HarnessConfig` (default: unbounded / batch size)
- [ ] Update `LiveAgent` to support scoped filling (fill only specified fields)
- [ ] Update `fillForm()` API to use parallel harness when execution plan has batches
- [ ] Add `parallel` support to `FillCallbacks` (e.g., `onBatchStart`, `onBatchComplete`)
- [ ] Add session transcript support for parallel turns (multiple agents per step)
- [ ] Add integration tests with mock agents
- [ ] Add golden test for parallel fill session

**Key harness changes:**

```typescript
// New harness config options
interface HarnessConfig {
  // ... existing fields
  maxParallelAgents?: number;  // Max concurrent agents (default: batch size)
}

// Scoped agent invocation
interface ScopedFillRequest {
  form: ParsedForm;           // Full form for context
  targetFieldIds: Id[];       // Fields this agent should fill
  targetGroupIds: Id[];       // Groups this agent should fill
  issues: InspectIssue[];     // Issues scoped to target fields
}
```

**Parallel execution flow:**

```
1. computeExecutionPlan(form) → { looseSerial, parallelBatches }
2. Start all agents concurrently:
   a. Primary agent: runs existing harness loop on looseSerial items
   b. For each parallel batch, for each item:
      - Create ScopedFillRequest
      - Spawn agent (up to maxParallelAgents total)
3. Await all agents
4. Merge patches from all agents (disjoint fields by construction)
5. Apply merged patches
6. Run full validation pass on complete form
```

**AI SDK integration (`liveAgent.ts`):**

```typescript
// Add scope parameter to fillFormTool
fillFormTool(
  issues: InspectIssue[],
  form: ParsedForm,
  maxPatches: number,
  previousRejections?: PatchRejection[],
  scope?: { fieldIds: Id[]; groupIds: Id[] }  // NEW: limit agent's focus
): Promise<AgentResponse>
```

The system prompt would include scope instructions:

```
You are filling a subset of this form. Focus ONLY on the following fields:
- revenue (Annual Revenue)
- margins (Margin Analysis)

Do NOT provide patches for any other fields.
```

### Phase 4: Unified fillForm() with Parallel Execution

Integrate parallel execution into the existing `fillForm()` high-level API so consumers
get parallel execution by adding a single flag — no rewiring required.

**Design principle: serial by default, parallel opt-in.** Parallel execution is
significantly more complex than serial (multiple agents, concurrent state, error
handling). The `parallel` attribute in the form markup only declares *permission* for
parallelism — the harness must still be explicitly told to use it. This keeps the default
behavior predictable and avoids surprising consumers.

#### The Problem

After Phase 3, two separate code paths exist:

| | `fillForm()` (serial) | `ParallelHarness` (parallel) |
|---|---|---|
| **Abstraction** | High (markdown in → result out) | Low (parsed form + agent) |
| **Model resolution** | Built-in | Manual |
| **Input context** | Built-in | Manual |
| **Turn loop** | Multi-turn with retry | Single-pass per order level |
| **Rejection feedback** | Yes (`previousRejections`) | No |
| **AbortSignal** | Yes | No |
| **Session transcript** | Full (stats, wire format) | No |
| **Callbacks** | `FillCallbacks` | `ParallelHarnessConfig` (partial overlap) |
| **Result type** | `FillResult` | `ParallelRunResult` (different shape) |

A consumer using `fillForm()` gets everything for free. Switching to `ParallelHarness`
means reimplementing model resolution, input context, agent creation, and session capture.

#### Solution: Unified fillForm()

`fillForm()` gains a single new option:

```typescript
const result = await fillForm({
  form: markdown,
  model: 'anthropic/claude-sonnet-4-5',
  enableParallel: true,          // NEW: opt-in to parallel execution
  maxParallelAgents: 8,          // optional (default: 4, from harness config)
  callbacks: {
    // existing callbacks still work
    onTurnStart, onTurnComplete,
    // parallel callbacks also work
    onBatchStart, onBatchComplete,
    onOrderLevelStart, onOrderLevelComplete,
  },
});
```

When `enableParallel: false` (default), `fillForm()` behaves exactly as today — even
if the form has `parallel` attributes, they are ignored and everything runs in serial.
The `order` attribute still applies (it affects issue filtering, which is Phase 2 logic
already active in the serial path).

When `enableParallel: true`, `fillForm()` checks `computeExecutionPlan()`. If the plan
has parallel batches, it uses the parallel execution path internally. If no parallel
batches exist (all loose serial), it falls back to the serial path automatically.

#### Execution Flow (enableParallel: true)

```
fillForm(options)
  1. Parse form (same as today)
  2. Resolve model (same as today)
  3. Apply input context (same as today)
  4. Check plan = computeExecutionPlan(form)
     - If no parallel batches: serial path (same as today, unchanged)
     - If parallel batches: parallel path (below)

Parallel path:
  for each orderLevel (sorted ascending):
    a. Serial items at this level:
       - Run existing multi-turn harness loop (step → agent → apply → retry)
       - Uses primaryAgent with rejection feedback, maxTurns, etc.
       - Loop until all serial items at this level are complete or maxTurns hit
    b. Parallel batch items at this level:
       - Spawn one agent per batch item (up to maxParallelAgents)
       - Each agent gets scoped issues + full form context
       - Each agent runs a multi-turn loop for its scoped fields
       - Collect patches from all agents, merge, apply in one call
       - Retry incomplete items up to configured turn limit
    c. After all serial + parallel items at this level complete:
       - Re-inspect form, advance to next order level
  5. Return FillResult (same shape as serial — consumer doesn't know the difference)
```

**Key difference from Phase 3 `ParallelHarness`:** Each batch item runs a *multi-turn
loop*, not a single agent call. If an agent doesn't fill all its fields on the first try
(or produces rejected patches), it retries — same as the serial path does today. Phase 3's
`ParallelHarness.runOrderLevel()` did one agent call per item with no retry; Phase 4
wraps that in the same multi-turn discipline as `fillForm()`.

#### API Changes

```typescript
// FillOptions additions
interface FillOptions {
  // ... existing fields unchanged

  /** Enable parallel execution for forms with parallel batches (default: false) */
  enableParallel?: boolean;

  /** Max concurrent agents for parallel batches (default: 4, from harness config) */
  maxParallelAgents?: number;  // already added in Phase 3 config work
}
```

No new types. No new entry points. `FillResult` shape is unchanged.

#### Agent Creation for Parallel Items

When `enableParallel` is true and the plan has parallel batches, `fillForm()` needs to
create multiple `LiveAgent` instances — one per concurrent batch item. Each agent:

1. Uses the same model (resolved once, shared)
2. Gets a scoped system prompt addition: "Focus on these fields: [field list]"
3. Receives scoped issues (only issues for its assigned fields)
4. Runs the same multi-turn loop as the serial path

The `agentFactory` from `ParallelHarnessConfig` becomes an internal implementation detail.
`fillForm()` creates agents using the same `createLiveAgent()` it already uses for the
primary agent, just with different scope instructions.

#### What Stays Internal vs Public

| Component | Visibility | Rationale |
|---|---|---|
| `fillForm({ enableParallel })` | **Public API** | The entry point consumers use |
| `ParallelHarness` | **Public, advanced** | For custom orchestration (SDK users who need full control) |
| `computeExecutionPlan()` | **Public** | For tooling, `markform plan`, debugging |
| `scopeIssuesForItem()` | **Public** | Useful for custom harness implementations |
| Agent creation/scoping | **Internal** | Handled by `fillForm()` automatically |
| `runWithConcurrency()` | **Internal** | Implementation detail |

#### Tasks

- [x] Add `enableParallel?: boolean` to `FillOptions` (default: `false`)
- [x] In `fillForm()`, after parse + model resolve + input context:
  - If `!enableParallel`: existing serial path (unchanged)
  - If `enableParallel`: compute execution plan, dispatch to parallel path
- [x] Implement parallel path in `fillForm()`:
  - Order-level loop (for each order level, ascending)
  - Serial items: existing multi-turn harness loop
  - Parallel batch items: spawn agents, multi-turn per agent, merge patches
- [x] Multi-turn loop for parallel agents:
  - Each parallel agent gets its own turn loop (scoped to its fields)
  - Retry with rejection feedback (same as serial)
  - Respect `maxTurnsThisCall` and `AbortSignal`
- [x] Agent factory inside `fillForm()`:
  - Reuse resolved model + provider
  - Create `LiveAgent` with scoped system prompt
  - Pass through `enableWebSearch`, `additionalTools`, `callbacks`
- [x] Unified callbacks:
  - `FillCallbacks.onBatchStart/Complete` fire during parallel batches
  - `FillCallbacks.onOrderLevelStart/Complete` fire at level transitions
  - `onTurnStart/Complete` fire for each agent's turns (serial and parallel)
- [ ] Session transcript support for parallel turns (follow-up: mf-04p6)
- [ ] `FillResult` includes parallel execution metadata (follow-up: mf-quxk):
  - Number of parallel agents used
  - Per-level breakdown of serial vs parallel patches
- [x] Tests:
  - [x] `fillForm({ enableParallel: false })` ignores parallel attributes (serial)
  - [x] `fillForm({ enableParallel: true })` with parallel form → concurrent execution
  - [x] `fillForm({ enableParallel: true })` with serial form → falls back to serial
  - [ ] Multi-turn retry works for parallel agents (rejected patches → retry) (follow-up: mf-1l3y)
  - [ ] `maxParallelAgents` limits concurrency through `fillForm()` (follow-up: mf-cocf)
  - [x] `AbortSignal` cancels parallel agents
  - [x] Callbacks fire correctly in parallel mode
  - [x] `FillResult` shape is identical for serial and parallel
- [x] Integration test: mock agents, parallel form, verify complete fill
- [x] Update `docs/markform-apis.md` with `enableParallel` documentation

#### Design Decisions

1. **`enableParallel: false` by default.** Parallel execution is complex — multiple
   agents, concurrent state, harder debugging. Serial is predictable, well-tested, and
   sufficient for most forms. Consumers opt in when they need the performance.

2. **Same `FillResult` shape.** The consumer doesn't need to know whether parallel
   execution was used. The result is the same: a filled form, turn count, patch count,
   status. This means switching between serial and parallel is a one-line change.

3. **`order` still applies in serial mode.** Even without `enableParallel`, the `order`
   attribute controls issue filtering — synthesis fields still wait for earlier fields.
   This is Phase 2 logic, orthogonal to parallelism.

4. **Multi-turn retry per batch item.** Phase 3's single-call-per-item was a simplification.
   Real agents need retries — they may produce rejected patches, miss fields, or hit
   context limits. Each parallel agent runs the same robust turn loop as the serial path.

5. **Model resolved once, shared.** All agents (primary + parallel) use the same model.
   We resolve it once and create multiple `LiveAgent` instances from the same
   `LanguageModel`. This avoids redundant API calls and keeps costs predictable.

6. **`ParallelHarness` stays public for advanced use.** The low-level harness is still
   useful for SDK consumers who need custom orchestration (e.g., different models per
   batch, custom agent factories, non-standard turn loops). `fillForm()` is the
   recommended path; `ParallelHarness` is the escape hatch.

## Stage 3: Refine Architecture

### Reusable Components

- **Existing `FormHarness`**: The sequential harness loop is reused for each execution
  unit. Parallel execution is orchestration *around* the existing step/apply loop, not a
  replacement.

- **Existing `LiveAgent`**: The agent already receives a form + issues and returns
  patches. Adding a scope filter to the issue list and system prompt is a small change.

- **Existing `applyPatches`**: Patches from parallel agents are merged into a single
  array and applied in one call. No changes to apply semantics needed.

- **Existing scope filtering**: `maxFieldsPerTurn` and `maxGroupsPerTurn` already
  filter issues by scope. The parallel harness uses a similar mechanism to scope each
  agent.

### Simplifications

- **No merge conflicts by construction.** Each field is assigned to exactly one agent.
  Patches from different agents target disjoint fields, so no conflict resolution is
  needed.

- **No new state machine.** The parallel harness orchestrates sequential units and
  parallel batches. Each individual agent still uses the existing step/apply loop.

- **Progressive enhancement.** A harness that doesn't understand `parallel` simply
  ignores it. All forms remain valid and fillable sequentially.

## Stage 4: Validation

### Final Checklist

- [ ] All existing tests pass (no regressions)
- [ ] `parallel` attribute parses correctly in both syntaxes
- [ ] `parallel` round-trips through parse → serialize
- [ ] `parallel` on field inside group produces parse error
- [ ] `order` attribute parses correctly in both syntaxes
- [ ] `order` round-trips through parse → serialize
- [ ] `order` defaults to `0` when absent
- [ ] `order` on field inside group with different value produces parse error
- [ ] Harness only surfaces issues for current (lowest incomplete) order level
- [ ] Fields at different order levels always filled in separate turns
- [ ] Parallel batch with mixed roles produces parse error
- [ ] `computeExecutionPlan` returns correct plan
- [ ] Parallel harness spawns concurrent agents correctly
- [ ] Patches from parallel agents merge without conflicts
- [ ] Cross-batch validators execute after all agents complete
- [ ] Session transcripts record parallel execution
- [ ] `fillForm({ enableParallel: false })` ignores parallel attributes (serial default)
- [ ] `fillForm({ enableParallel: true })` with parallel form → concurrent execution
- [ ] `fillForm({ enableParallel: true })` with serial form → falls back to serial
- [ ] Multi-turn retry works for parallel agents (rejection → retry)
- [ ] `maxParallelAgents` limits concurrency through `fillForm()`
- [ ] `AbortSignal` cancels parallel agents
- [ ] `FillResult` shape identical for serial and parallel paths
- [ ] Harness config `max_parallel_agents` YAML key works end-to-end
- [ ] Spec documentation complete in `markform-spec.md`
- [ ] API reference complete in `markform-apis.md`
- [ ] `pnpm precommit` passes

### Verification Commands

```bash
# Run all tests
pnpm precommit

# Test parallel attribute parsing
echo '---
markform:
  spec: MF/0.1
---
<!-- form id="test" title="Test" -->
<!-- field kind="string" id="a" label="A" --><!-- /field -->
<!-- field kind="string" id="b" label="B" parallel="batch" --><!-- /field -->
<!-- field kind="string" id="c" label="C" parallel="batch" --><!-- /field -->
<!-- field kind="string" id="d" label="D" --><!-- /field -->
<!-- /form -->' | pnpm markform inspect -

# Verify parallel appears in serialized output
# Verify execution plan shows: looseSerial=[a,d], parallelBatches=[{batch: [b,c]}]
```

---

## Future Directions

The following approaches were considered during design and are documented here as
potential future enhancements. The `parallel` attribute was chosen for concurrency and
the `order` attribute for fill sequencing; the alternatives below remain available if
more advanced scheduling is needed.

### Explicit Dependency Graph (`dependsOn`)

Add `dependsOn` attribute referencing IDs of prerequisite fields/groups. This enables
full DAG scheduling but is verbose and requires form authors to reason about the
complete dependency graph. Could compose with `parallel`: use `parallel` for batch
grouping and `dependsOn` for fine-grained inter-batch prerequisites.

```markdown
<!-- field kind="string" id="overview" label="Overview" --><!-- /field -->
<!-- field kind="string" id="financials" label="Financials" dependsOn="overview" --><!-- /field -->
<!-- field kind="string" id="team" label="Team" dependsOn="overview" --><!-- /field -->
<!-- field kind="string" id="synthesis" label="Synthesis" dependsOn="financials,team" --><!-- /field -->
```

### Fill-Order Hints (`fillAfter`)

**Note:** This section documents the `fillAfter` option that was considered but replaced
by the `order` attribute design (see main spec above). Kept for historical context.

A `fillAfter` attribute with special values like `fillAfter="all"` (fill last) and
`fillAfter="some_id"` (fill after that item). Concise for the common "fill last" case
but less flexible than numeric ordering — cannot express "fill second" or "fill before
this other thing." Also introduces a special keyword (`"all"`) that doesn't compose as
cleanly as a numeric system.

`fillAfter` is a strict subset of `dependsOn` — if full DAG dependencies are added
later, `fillAfter="x"` is equivalent to `dependsOn="x"`, and `fillAfter="all"` is
syntactic sugar for "depends on everything else."

### Execution Phases

Divide the form into numbered phases/waves. All items in a phase run concurrently;
phases execute sequentially. Simpler than DAG but less flexible than `parallel` batches
(strict phase boundaries mean one slow field blocks the entire next phase).

### Harness Config Overrides

Specify parallelism in `harness_config` frontmatter rather than on individual fields.
Useful for runtime tuning without modifying form structure, but separates intent from
content.

### Auto-Detection of Independence

Analyze the form to infer which groups have no shared validators or cross-references and
could safely run in parallel without explicit annotation. Would reduce authoring burden
but risks incorrect parallelization when implicit dependencies exist in field content.

### Sub-Parallelism Within Groups

Allow `parallel` on fields inside groups to enable hierarchical parallelism. A group
with `parallel="research"` would run as a unit in the research batch, but internally
its fields could be further parallelized with `parallel="financial_detail"`. This would
require agents to spawn sub-agents, adding scheduling complexity. Deferred to keep the
initial model simple: a group is an atomic execution unit.

### Inter-Batch Context Sharing

Allow parallel agents to see partial results from other agents in the same batch. This
would improve quality (e.g., market analysis benefits from knowing revenue) but adds
complexity to the merge model.

---

## Open Questions

- [ ] Should parallel agents see each other's partial results, or work in full isolation
  until merge?
- [ ] How should cross-group validators work when their constituent fields are filled in
  parallel? (Current proposal: defer validation until batch completes.)
- [ ] Should the form author or the harness decide the degree of parallelism
  (max agents)?
- [ ] How does parallelism interact with the `role` system? (e.g., user-role fields
  filled interactively while agent-role fields fill in parallel.)
- [ ] What should happen if a parallel agent aborts a field? Should the entire batch
  fail, or should other agents in the batch continue?
