# Plan Spec: Parallel Form Filling

## Purpose

Define how Markform forms can express parallelism — which fields or groups of fields are
independent and can be filled concurrently. This is entirely optional: forms without
parallelism annotations behave exactly as they do today (sequential). Authors who want
faster filling of large forms can add `parallel` attributes to indicate independent work.

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

Add a `parallel` attribute to the Markform specification that can be applied to both
fields and groups. Items sharing the same `parallel` value are independent and may be
executed concurrently by a parallel-aware harness. Items without `parallel` are
sequential by default.

This is a three-phase effort:

- **Phase 1 — Spec & Design:** Define the `parallel` attribute semantics, update the
  Markform specification, and document the execution model.
- **Phase 2 — TypeScript API:** Parse, validate, serialize, and expose `parallel` in the
  engine types and APIs.
- **Phase 3 — Harness & AI SDK:** Implement parallel execution in the harness and the
  AI SDK live agent integration.

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: MAINTAIN — `parallel` is additive
- **Library APIs**: MAINTAIN — existing forms without `parallel` behave identically
- **File formats**: MAINTAIN — `parallel` attribute is optional; existing forms unchanged
- **Server APIs**: N/A
- **Database schemas**: N/A

## Stage 1: Planning Stage

### Design: The `parallel` Attribute

Add a `parallel` attribute to **both fields and groups**. Items sharing the same
`parallel` value can be executed concurrently. Items without `parallel` are sequential
by default (depend on all prior items completing).

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

#### Execution Order

1. **`overview` group** runs first (no `parallel` — sequential default).
2. **`financials` group, `team` field, `market` group** all run concurrently (same
   `parallel="deep_research"` value).
3. **`synthesis` group** runs after all three complete (no `parallel` — sequential,
   waits for all prior items).

#### Semantics

1. **Parallel batches.** Items with the same `parallel` value form a *parallel batch*.
   All items in a batch MAY be executed concurrently.

2. **Sequential default.** Items without `parallel` are sequential — they implicitly
   depend on all prior items (including any preceding parallel batch) completing before
   they begin.

3. **Batch boundaries.** A sequential item appearing after a parallel batch waits for
   the entire batch. A sequential item appearing before a parallel batch must complete
   before the batch starts.

4. **Multiple batches.** Multiple distinct `parallel` values can coexist. They execute
   in document order relative to sequential items between them. Example:

   ```markdown
   <!-- field id="a" label="A" --><!-- /field -->                    <!-- sequential: runs first -->
   <!-- field id="b" label="B" parallel="batch_1" --><!-- /field -->  <!-- batch_1 -->
   <!-- field id="c" label="C" parallel="batch_1" --><!-- /field -->  <!-- batch_1 -->
   <!-- field id="d" label="D" --><!-- /field -->                    <!-- sequential: waits for batch_1 -->
   <!-- field id="e" label="E" parallel="batch_2" --><!-- /field -->  <!-- batch_2: waits for d -->
   <!-- field id="f" label="F" parallel="batch_2" --><!-- /field -->  <!-- batch_2 -->
   ```

   Execution: `a` → `{b, c}` → `d` → `{e, f}`

5. **Group inheritance.** Within a group that has `parallel`, all child fields belong to
   that parallel batch. Individual fields inside such a group do not need their own
   `parallel` attribute. A field inside a `parallel` group MUST NOT have a different
   `parallel` value (parse error).

6. **Parallel is a hint.** The attribute expresses *permission* for concurrency, not a
   requirement. A sequential harness MAY ignore `parallel` and fill everything in
   document order. A parallel-aware harness SHOULD use it to optimize.

7. **Disjoint writes.** Each field is assigned to exactly one execution unit. No two
   concurrent agents write to the same field.

8. **Deferred validation.** Cross-field validators (group-level `validate`) that
   reference fields in a parallel batch are evaluated after the entire batch completes,
   not incrementally.

#### Attribute Rules

| Rule | Detail |
| --- | --- |
| Attribute name | `parallel` |
| Value type | String (arbitrary identifier, recommended `snake_case`) |
| Applies to | `field` tags and `group` tags |
| Default | Absent (sequential) |
| Uniqueness | Not unique — same value used on multiple items to form a batch |
| Nesting | Field inside a `parallel` group inherits; conflicting value is an error |

#### Error Conditions

| Condition | Error |
| --- | --- |
| Field has `parallel` that conflicts with its parent group's `parallel` | `Field '${fieldId}' has parallel='${fieldVal}' but is inside group '${groupId}' with parallel='${groupVal}'. Fields inherit their group's parallel value.` |
| Same `parallel` value used in non-contiguous positions (interleaved with sequential items or different batches) | `Parallel batch '${value}' is not contiguous. All items with the same parallel value must be adjacent.` |

### Scope

**In scope:**

- `parallel` attribute on `field` and `group` tags
- Parse, validate, and serialize `parallel`
- Expose `parallel` on `FieldBase` and `FieldGroup` TypeScript types
- Execution plan computation: given a parsed form, compute the ordered list of
  execution units (sequential items and parallel batches)
- Parallel harness that spawns concurrent agent instances for each batch item
- AI SDK integration for parallel agent execution

**Not in scope:**

- Dependency DAG (`dependsOn`) — future enhancement
- Auto-detection of independent fields — future enhancement
- Nested groups — not yet supported in MF/0.1
- Inter-batch context sharing (each parallel agent sees the form state as of batch
  start; they do not see each other's partial results)

### Acceptance Criteria

1. Forms without `parallel` behave identically to today (all existing tests pass)
2. `parallel` attribute is parsed from both HTML comment and Markdoc tag syntax
3. `parallel` is round-tripped through parse → serialize
4. `parallel` appears on `FieldBase` and `FieldGroup` types as `parallel?: string`
5. Execution plan computation correctly identifies sequential items and parallel batches
6. Error on conflicting `parallel` between field and parent group
7. Error on non-contiguous parallel batch
8. Parallel harness can spawn concurrent agent instances per batch item
9. Parallel harness correctly merges results and proceeds to next execution unit

### Design Decisions

1. **String value, not boolean.** Using a string (batch name) rather than `parallel=true`
   allows multiple independent parallel batches in the same form. A boolean would only
   support "parallel or not" without distinguishing batches.

2. **Contiguity requirement.** Items in the same parallel batch must be adjacent in the
   document. This prevents confusing interleaving like
   `parallel="a"`, sequential, `parallel="a"` which would have ambiguous execution order.

3. **Sequential default.** Safest choice — existing forms and new forms without
   annotation work correctly. Authors opt in to parallelism explicitly.

4. **Hint, not mandate.** A harness that doesn't support parallelism simply ignores the
   attribute. This keeps the attribute purely additive.

## Stage 2: Architecture Stage

### Phase 1: Spec & Design

Update the Markform specification documents to define `parallel`.

**Tasks:**

- [ ] Add `parallel` attribute to Layer 1 (Syntax) in `docs/markform-spec.md`
  - Add to field tag attribute table
  - Add to group tag attribute table
  - Add new subsection "Parallel Execution Hints"
- [ ] Add execution plan semantics to Layer 3 (Validation & Form Filling)
  - Define "execution unit" (sequential item or parallel batch)
  - Define execution plan computation algorithm
  - Define deferred validation for cross-batch validators
- [ ] Update `docs/markform-reference.md` with `parallel` attribute
- [ ] Add examples showing parallel forms to examples directory

**Spec additions to `docs/markform-spec.md`:**

#### Layer 1 addition: Parallel Execution Hints

> ##### Parallel Execution Hints
>
> Fields and groups MAY include a `parallel` attribute to indicate that they can be
> filled concurrently with other items sharing the same value.
>
> ```markdown
> <!-- field kind="string" id="a" label="A" parallel="batch_1" --><!-- /field -->
> <!-- field kind="string" id="b" label="B" parallel="batch_1" --><!-- /field -->
> ```
>
> **Rules:**
> - `parallel` value is an arbitrary string identifier (recommended: `snake_case`)
> - Items with the same `parallel` value form a *parallel batch*
> - Items without `parallel` are sequential (depend on all prior items completing)
> - Items in a parallel batch MUST be contiguous in document order
> - A field inside a group with `parallel` inherits the group's value; specifying a
>   different value is a parse error
> - `parallel` is a hint — sequential execution is always valid
>
> **Execution model:**
> ```
> Form items are processed in document order as a sequence of execution units:
>
> 1. Sequential item: single field or group, depends on all prior units completing
> 2. Parallel batch: set of adjacent items with same `parallel` value, all may
>    execute concurrently. The batch as a whole depends on all prior units.
> ```

#### Layer 3 addition: Execution Plan

> ##### Execution Plan
>
> An **execution plan** is an ordered list of **execution units** derived from the form's
> fields and groups:
>
> ```typescript
> type ExecutionUnit =
>   | { kind: 'sequential'; itemId: Id; itemType: 'field' | 'group' }
>   | { kind: 'parallel'; batchId: string; items: Array<{ itemId: Id; itemType: 'field' | 'group' }> }
> ```
>
> **Computation:** Walk top-level items (fields and groups) in document order:
> - If item has no `parallel`: emit a sequential unit
> - If item has `parallel`: accumulate into current batch (same value) or start new batch
> - When a different `parallel` value or sequential item is encountered, close the current
>   batch and emit it
>
> **Execution:** Process units in order. For sequential units, fill the item then proceed.
> For parallel batches, fill all items concurrently, wait for all to complete, then
> proceed to the next unit.

### Phase 2: TypeScript API Changes

Parse, validate, serialize, and expose `parallel` through the engine.

**Tasks:**

- [ ] Add `parallel?: string` to `FieldBase` interface in `coreTypes.ts`
- [ ] Add `parallel?: string` to `FieldGroup` interface in `coreTypes.ts`
- [ ] Add `parallel` to `FieldBaseSchema` and `FieldGroupSchema` Zod schemas
- [ ] Update parser (`parse.ts` / `parseFields.ts`) to extract `parallel` attribute
  from field and group tags
- [ ] Add validation: conflicting `parallel` between field and parent group
- [ ] Add validation: non-contiguous parallel batch
- [ ] Update serializer to emit `parallel` attribute on field and group tags
- [ ] Add `computeExecutionPlan(form: ParsedForm): ExecutionUnit[]` function
- [ ] Export `ExecutionUnit` type and `computeExecutionPlan` from public API
- [ ] Update `InspectResult` to include execution plan (optional, for tooling)
- [ ] Add unit tests for parsing `parallel` (both syntaxes)
- [ ] Add unit tests for validation errors
- [ ] Add unit tests for `computeExecutionPlan`
- [ ] Add golden tests for round-trip with `parallel`

**Key type changes:**

```typescript
// coreTypes.ts
interface FieldBase {
  // ... existing fields
  parallel?: string;  // Parallel batch identifier
}

interface FieldGroup {
  // ... existing fields
  parallel?: string;  // Parallel batch identifier
}

// New: Execution plan types
interface SequentialUnit {
  kind: 'sequential';
  itemId: Id;
  itemType: 'field' | 'group';
}

interface ParallelBatch {
  kind: 'parallel';
  batchId: string;
  items: Array<{ itemId: Id; itemType: 'field' | 'group' }>;
}

type ExecutionUnit = SequentialUnit | ParallelBatch;

// New function
function computeExecutionPlan(form: ParsedForm): ExecutionUnit[];
```

**Parser changes (`parseFields.ts`):**

```typescript
// In parseField():
const parallel = getStringAttr(node, 'parallel');
// Add to field object: parallel

// In group parsing:
const groupParallel = getStringAttr(groupNode, 'parallel');
// Validate children don't conflict
for (const field of group.children) {
  if (field.parallel && field.parallel !== groupParallel) {
    throw new MarkformParseError(
      `Field '${field.id}' has parallel='${field.parallel}' but is inside ` +
      `group '${group.id}' with parallel='${groupParallel}'. ` +
      `Fields inherit their group's parallel value.`
    );
  }
}
```

**Validation for contiguity (`validate.ts` or `computeExecutionPlan`):**

```typescript
function validateParallelContiguity(items: Array<{ id: Id; parallel?: string }>): void {
  const seen = new Map<string, number>(); // batchId → last index seen
  for (let i = 0; i < items.length; i++) {
    const p = items[i].parallel;
    if (!p) {
      continue;
    }
    if (seen.has(p)) {
      const lastIdx = seen.get(p)!;
      // Check all items between lastIdx and i also have the same parallel value
      for (let j = lastIdx + 1; j < i; j++) {
        if (items[j].parallel !== p) {
          throw new MarkformParseError(
            `Parallel batch '${p}' is not contiguous. ` +
            `All items with the same parallel value must be adjacent.`
          );
        }
      }
    }
    seen.set(p, i);
  }
}
```

### Phase 3: Harness & AI SDK Implementation

Implement parallel execution in the harness and live agent.

**Tasks:**

- [ ] Add `ParallelHarness` class (or extend `FormHarness`) that uses execution plan
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
1. computeExecutionPlan(form) → [unit1, unit2, ...]
2. For each unit in order:
   a. If sequential:
      - Run single agent on that field/group (existing harness logic)
   b. If parallel batch:
      - For each item in batch, create ScopedFillRequest
      - Spawn agents concurrently (up to maxParallelAgents)
      - Await all agents
      - Merge patches (all target disjoint fields)
      - Apply merged patches
      - Run deferred validators for the batch
3. Final validation pass on complete form
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
- [ ] Conflicting field/group parallel values produce errors
- [ ] Non-contiguous batches produce errors
- [ ] `computeExecutionPlan` returns correct execution units
- [ ] Parallel harness spawns concurrent agents correctly
- [ ] Patches from parallel agents merge without conflicts
- [ ] Cross-batch validators execute after batch completes
- [ ] Session transcripts record parallel execution
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
# Verify execution plan shows: sequential(a) → parallel(b,c) → sequential(d)
```

---

## Future Directions

The following approaches were considered during design and are documented here as
potential future enhancements. The `parallel` attribute (Option A) was chosen as the
initial design for its simplicity and safe defaults.

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
