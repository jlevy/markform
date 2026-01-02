# Plan Spec: Resumable Form Fills

## Purpose

This is a technical design doc for adding resumable form fill support to markform's
programmatic API. This feature enables orchestrated environments with timeout constraints
(e.g., Convex workflows, AWS Step Functions) to checkpoint and resume long-running form
fill sessions.

## Background

**Markform** provides a `fillForm()` programmatic API that encapsulates the harness loop
with a live LLM agent. This works well for direct invocations but creates problems in
orchestrated environments:

**The Timeout Problem:**

- A 44-field form might take 15-20 minutes to complete
- Orchestrators like Convex actions have hard timeouts (600s = 10 min)
- When timeout hits, all progress is lost
- Retries start from scratch, wasting completed work

**Why This Matters:**

The `fillForm()` function is currently opaque to orchestrators - there's no way to:
1. Limit execution to N turns within a timeout budget
2. Checkpoint partial progress
3. Resume from where it left off

**Related Docs:**

- [plan-2025-12-24-programmatic-fill-api.md](done/plan-2025-12-24-programmatic-fill-api.md)
- [arch-markform-design.md](../architecture/current/arch-markform-design.md.md)

## Summary of Task

Add two optional parameters to `FillOptions` that enable resumable form fills:

```typescript
interface FillOptions {
  // ... existing options ...

  /**
   * Maximum turns to execute in THIS call.
   * When reached, returns with status `{ ok: false, reason: 'batch_limit' }`.
   * Caller can resume by passing the returned form back.
   *
   * @default undefined (no per-call limit)
   */
  maxTurnsThisCall?: number;

  /**
   * Starting turn number for progress tracking when resuming.
   * Affects callback reporting and FillResult.turns calculation.
   *
   * @default 0
   */
  startingTurnNumber?: number;
}
```

**Usage Example:**

```typescript
// First call - run up to 5 turns
const result1 = await fillForm({
  form: formMarkdown,
  model: 'anthropic/claude-sonnet-4-5',
  enableWebSearch: true,
  captureWireFormat: false,
  maxTurnsThisCall: 5,
});

if (!result1.status.ok && result1.status.reason === 'batch_limit') {
  // Checkpoint and resume later
  const checkpoint = result1.markdown;

  const result2 = await fillForm({
    form: checkpoint,
    model: 'anthropic/claude-sonnet-4-5',
    enableWebSearch: true,
    captureWireFormat: false,
    maxTurnsThisCall: 5,
    startingTurnNumber: result1.turns,
  });
}
```

## Backward Compatibility

**Compatibility Level:** Fully Backward Compatible (Additive Only)

| Area | Impact |
| --- | --- |
| Library API | New optional parameters; existing code unchanged |
| CLI | No changes |
| Types | New `'batch_limit'` reason added to `FillStatus` |
| Behavior | Default behavior unchanged when params omitted |

**Default Behavior (unchanged):**

| Parameter | Default | Behavior |
| --- | --- | --- |
| `maxTurnsThisCall` | `undefined` | No per-call limit; runs until complete or `maxTurns` |
| `startingTurnNumber` | `0` | Turn counting starts at 1 |

## Stage 1: Planning Stage

### Proposal Validation

The external proposal was analyzed against the current implementation. Key findings:

**1. Form State Serialization** ✅ VIABLE

The proposal claims "Form state is complete" - verified:
- `FillResult.form` (ParsedForm) contains all field values in `responsesByFieldId`
- `serializeForm()` produces markdown that can be re-parsed
- `parseForm()` restores the full state including values

**2. Stateless Turn Execution** ✅ VIABLE

The proposal claims "Each turn is stateless" - verified:
- Each turn's agent call receives: issues from `harness.step()`, current form, max patches
- No memory of previous turns needed - the form IS the state
- Previous rejections are passed explicitly (not persistent state)

**3. FillStatus Compatibility** ✅ VIABLE (with modification)

The proposal suggests reusing `reason: 'max_turns'` - recommendation: **use a new reason**

- `'max_turns'` indicates a safety limit was hit (something may be wrong)
- `'batch_limit'` (new) indicates intentional checkpoint for resumption
- Callers can distinguish between safety stops and planned checkpoints

**4. Implementation Scope** ✅ ACCURATE

The proposal estimates ~10 lines of change - verified:
- Add 2 fields to `FillOptions` type
- Add `'batch_limit'` to `FillStatus.reason`
- Add per-call limit check in main loop (~5 lines)
- Update return logic (~3 lines)

### Design Decisions

**Decision 1: New Status Reason**

Use `reason: 'batch_limit'` instead of reusing `'max_turns'`:

```typescript
export type FillStatus =
  | { ok: true }
  | { ok: false; reason: 'max_turns' | 'batch_limit' | 'cancelled' | 'error'; message?: string };
```

Rationale:
- `'max_turns'` = safety limit hit, may indicate a problem
- `'batch_limit'` = intentional checkpoint, expected to resume
- Clearer semantics for error handling and logging

**Decision 2: Turn Counting Semantics**

`FillResult.turns` returns total turns executed across all calls (including previous):

```typescript
// After first call: result1.turns = 5
// After second call: result2.turns = 10 (not 5)
```

Implementation: `turns = startingTurnNumber + turnsThisCall`

Rationale:
- Accurate progress tracking across sessions
- Consistent with how `maxTurns` is meant to work (overall limit)

**Decision 3: Interaction with maxTurns**

Both limits apply independently:

| Scenario | Result |
| --- | --- |
| `maxTurnsThisCall` hit first | `reason: 'batch_limit'` |
| `maxTurns` hit first | `reason: 'max_turns'` |

The overall `maxTurns` limit is checked by the harness, which creates a fresh counter each
call. To enforce overall limits across calls, callers must track total turns externally:

```typescript
const overallLimit = 100;
let totalTurns = 0;

while (totalTurns < overallLimit) {
  const result = await fillForm({
    form: checkpoint,
    maxTurns: overallLimit - totalTurns, // Remaining budget
    maxTurnsThisCall: 5,
    startingTurnNumber: totalTurns,
  });
  totalTurns = result.turns;
  if (result.status.ok) break;
  if (result.status.reason !== 'batch_limit') break;
  checkpoint = result.markdown;
}
```

### Feature Scope

**In Scope:**

- `maxTurnsThisCall` parameter for per-call turn limits
- `startingTurnNumber` parameter for accurate progress tracking
- `'batch_limit'` status reason for checkpoint returns
- Update callbacks to report correct turn numbers
- Unit tests for new functionality

**Out of Scope (Explicit Non-Goals):**

- Session log continuity across calls (each call starts fresh log)
- Automatic checkpoint/resume orchestration
- Persistent turn state in harness
- Changes to harness.ts internal logic

### Acceptance Criteria

1. `fillForm()` with `maxTurnsThisCall: N` stops after N turns
2. Returns `status: { ok: false, reason: 'batch_limit' }` when per-call limit hit
3. `FillResult.turns` includes `startingTurnNumber`
4. Callbacks receive adjusted turn numbers
5. Default behavior unchanged when params omitted
6. Existing tests pass
7. Round-trip works: result.markdown can be re-parsed and resumed

### Testing Plan

#### 1. Unit Tests (`tests/unit/harness/programmaticFill.test.ts`)

**maxTurnsThisCall:**

- [ ] Stops after exactly N turns when `maxTurnsThisCall: N`
- [ ] Returns `reason: 'batch_limit'` (not `'max_turns'`)
- [ ] Partial form state is preserved
- [ ] `FillResult.turns` equals turns executed

**startingTurnNumber:**

- [ ] `FillResult.turns` = `startingTurnNumber` + turns executed this call
- [ ] Callbacks receive adjusted turn numbers
- [ ] Works correctly when combined with `maxTurnsThisCall`

**Interaction with maxTurns:**

- [ ] `maxTurns` still enforced (returns `'max_turns'` if hit first)
- [ ] `maxTurnsThisCall` takes precedence when lower than remaining `maxTurns`

**Resume flow:**

- [ ] Result markdown can be parsed and used as input
- [ ] Resumed fill continues from saved state
- [ ] Multi-resume scenario works (3+ consecutive calls)

#### 2. Integration Tests (`tests/integration/programmaticFill.test.ts`)

- [ ] End-to-end: checkpoint at turn 2, resume, complete
- [ ] Values from first call preserved in second call
- [ ] Total patches accumulated correctly across calls

## Stage 2: Architecture Stage

### Module Structure

No new files needed. Changes are localized:

```
packages/markform/src/harness/
├── harnessTypes.ts     # Add maxTurnsThisCall, startingTurnNumber, 'batch_limit'
├── programmaticFill.ts # Add per-call limit check in main loop
└── ...                 # No other changes
```

### Type Changes

#### harnessTypes.ts

```typescript
// Add to FillOptions
export interface FillOptions {
  // ... existing ...

  /**
   * Maximum turns to execute in THIS call.
   * When reached, returns with status `{ ok: false, reason: 'batch_limit' }`.
   *
   * @default undefined (no per-call limit)
   */
  maxTurnsThisCall?: number;

  /**
   * Starting turn number for progress tracking when resuming.
   * Affects callback reporting and FillResult.turns calculation.
   *
   * @default 0
   */
  startingTurnNumber?: number;
}

// Update FillStatus
export type FillStatus =
  | { ok: true }
  | { ok: false; reason: 'max_turns' | 'batch_limit' | 'cancelled' | 'error'; message?: string };
```

### Implementation Changes

#### programmaticFill.ts

```typescript
export async function fillForm(options: FillOptions): Promise<FillResult> {
  // ... existing setup ...

  // 5. Run harness loop
  const startingTurn = options.startingTurnNumber ?? 0;
  let turnCount = startingTurn;
  let turnsThisCall = 0;
  let stepResult = harness.step();

  while (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
    // Check per-call limit
    if (
      options.maxTurnsThisCall !== undefined &&
      turnsThisCall >= options.maxTurnsThisCall
    ) {
      return buildResult(
        form,
        turnCount,  // Total turns including previous calls
        totalPatches,
        { ok: false, reason: 'batch_limit', message: `Reached per-call limit (${options.maxTurnsThisCall})` },
        inputContextWarnings,
        stepResult.issues,
      );
    }

    // Check for cancellation
    if (options.signal?.aborted) { /* ... */ }

    // Call turn start callback with adjusted turn number
    if (options.callbacks?.onTurnStart) {
      options.callbacks.onTurnStart({
        turnNumber: turnCount + 1,  // Already includes startingTurnNumber
        issuesCount: stepResult.issues.length,
      });
    }

    // ... existing agent call and apply logic ...

    turnsThisCall++;
    turnCount++;

    // ... existing turn complete callback (already uses turnCount) ...
  }

  // 6. Determine final status (unchanged)
  // ...
}
```

## Stage 3: Refine Architecture

### Reusable Components

All existing components are reused without modification:

| Component | Usage |
| --- | --- |
| `serializeForm()` | Produces checkpoint markdown |
| `parseForm()` | Restores form from checkpoint |
| `FormHarness` | Fresh instance per call (expected) |
| Callbacks | Already receive `turnNumber` (just adjust value) |

### Potential Future Improvements

Not in scope but worth noting:

1. **Session Log Continuity**: Currently each call starts a fresh `harness.getTurns()`.
   Could add option to pass previous turns for unified session log.

2. **Automatic Budget Calculation**: Could add helper to compute remaining `maxTurns`
   based on overall limit and `startingTurnNumber`.

3. **Checkpoint Serialization**: Could add `serializeCheckpoint()` that includes
   metadata like turn count, making resume fully self-contained.

## Open Questions

### Resolved

1. **Reuse 'max_turns' reason?** ✅ NO
   - Decision: Add new `'batch_limit'` reason for clearer semantics

2. **How to track total turns?** ✅ RESOLVED
   - `FillResult.turns = startingTurnNumber + turnsThisCall`
   - Caller is responsible for passing correct `startingTurnNumber`

3. **Harness state persistence?** ✅ NOT NEEDED
   - Each call creates fresh harness (expected)
   - Form markdown is the only state that matters

### Implementation Notes

1. **The harness has its own turn counter** - This is fine. The harness's `hasReachedMaxTurns()`
   uses its internal counter which resets each call. The `maxTurns` option passed to harness
   should be the remaining budget if enforcing overall limits.

2. **Session logs are per-call** - Each `fillForm()` call creates a new harness with fresh
   `turns` array. This is acceptable for MVP; session log continuity can be added later.

## Revision History

| Date | Author | Changes |
| --- | --- | --- |
| 2026-01-02 | Claude | Initial draft from external proposal evaluation |
| 2026-01-02 | Claude | Decision: Use 'batch_limit' reason instead of reusing 'max_turns' |
| 2026-01-02 | Claude | Decision: turns includes startingTurnNumber for accurate tracking |
| 2026-01-02 | Claude | Added acceptance criteria and testing plan |
