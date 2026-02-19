# Feature: Fill Harness Observability and Signal Propagation

**Date:** 2026-02-19

**Author:** Joshua Levy with LLM assistance

**Status:** Draft

**Related:**

- [GitHub Issue #157](https://github.com/jlevy/markform/issues/157) — Original proposal
- `docs/project/specs/active/plan-2026-02-14-fill-record-performance-metrics.md` —
  FillRecord performance metrics (overlaps with MF-3)
- `docs/project/specs/done/plan-2026-01-29-fill-record.md` — Original FillRecord spec

## Overview

When using `fillForm()` at scale (batch fills with parallel execution), the harness
discards valuable data from the AI SDK’s `generateText()` result and has a bug where
`FillOptions.signal` doesn’t interrupt in-flight LLM calls.
These changes make fills observable and properly interruptible.

All changes are backward-compatible (new optional fields or bug fixes).
No breaking changes.

## Goals

- Fix the `signal` propagation bug so in-flight LLM calls can be cancelled
- Expose provider metadata (`responseId`, `requestId`, `durationMs`) through
  `onLlmCallEnd` so callers can correlate with provider dashboards
- Record per-turn LLM call duration in FillRecord timeline entries
- Add structured error classification fields to `FillStatus` for serialization-friendly
  error handling

## Non-Goals

- Cost estimation or pricing database — stays downstream
- Retry policy changes — existing `maxRetries` with AI SDK exponential backoff is
  sufficient
- Wire format changes — `captureWireFormat` already captures full LLM request/response
- Changes to `onError` callback — it already receives the full Error object

## Background

During batch research fills with gpt-5-mini, individual LLM calls stalled for 30-50+
minutes with no way to diagnose whether the cause was rate limiting, API queuing, or
infrastructure issues.
The `generateText()` result contains response IDs and headers that would allow lookup in
provider dashboards (e.g., OpenAI’s `chatcmpl-...` ID and `x-request-id` header), but
markform discards them.

The `signal` option couldn’t cancel stalled calls because it’s only checked between
turns — the `AbortSignal` is never passed to `generateText()`.

### Current State of the Code

- **Signal checking**: `FillOptions.signal` is checked at 4 points in
  `programmaticFill.ts` (lines 617, 712, 878, 1154) — all between turns, never during
  LLM calls
- **generateText call**: `liveAgent.ts:201-209` calls `generateText()` without
  `abortSignal`
- **onLlmCallEnd callback**: Passes `{ model, inputTokens, outputTokens, executionId }`
  — no duration, no provider metadata (`harnessTypes.ts:351-358`)
- **FillRecord timeline**: `TimelineEntrySchema` has `durationMs` (total turn time) and
  per-tool `ToolCallRecord` with `durationMs`, but no per-entry LLM call duration
  (`fillRecord.ts:115-157`)
- **Error handling**: Catch blocks in `programmaticFill.ts` DO preserve the full `Error`
  object in `FillStatus` (`error?: Error`), but Error objects don’t survive JSON
  serialization — FillRecord loses error class/code information
- **Error wrapping**: `wrapApiError()` in `errors.ts:345` already wraps API errors as
  `MarkformLlmError` with `statusCode`, `provider`, `model`, and `retryable` fields —
  but these are lost when FillRecord is serialized to JSON

### AI SDK v6 `generateText()` API

Relevant fields available from `GenerateTextResult`:

```typescript
// result.response: LanguageModelResponseMetadata
{
  id: string;                          // Provider response ID (e.g., "chatcmpl-...")
  timestamp: Date;                     // Response start timestamp
  modelId: string;                     // Actual model ID used
  headers?: Record<string, string>;    // Response headers (e.g., x-request-id)
}
```

The `generateText()` function accepts `abortSignal?: AbortSignal` to cancel in-flight
calls.

## Design

### MF-1. Bug Fix: Propagate `signal` to `generateText()`

**Priority:** High (bug — public API contract not honored)

`FillOptions.signal` is documented for cancellation, but only checked between turns.
In-flight LLM calls cannot be interrupted.

**Changes:**

1. **`harnessTypes.ts`** — Add `signal?: AbortSignal` to `LiveAgentConfig` interface
   (line ~197, after `maxRetries`):

   ```typescript
   // harnessTypes.ts, LiveAgentConfig interface
   /**
    * AbortSignal for cancelling in-flight LLM calls.
    * Propagated from FillOptions.signal through to generateText().
    */
   signal?: AbortSignal;
   ```

2. **`liveAgent.ts`** — Store signal on instance and pass to `generateText()`:

   ```typescript
   // liveAgent.ts, class LiveAgent
   // Add to private fields (after line 75):
   private signal?: AbortSignal;

   // Add to constructor (after line 87):
   this.signal = config.signal;

   // Add to generateText() call (line 201-209):
   result = await generateText({
     model: this.model,
     system: systemPrompt,
     prompt: contextPrompt,
     tools,
     toolChoice: this.toolChoice,
     maxRetries: this.maxRetries,
     stopWhen: stepCountIs(this.maxStepsPerTurn),
     abortSignal: this.signal,  // NEW
   });
   ```

3. **`programmaticFill.ts`** — Pass signal through to agent config in both serial and
   parallel paths:

   ```typescript
   // Serial path (line ~574-585):
   createLiveAgent({
     ...existingConfig,
     signal: options.signal,  // NEW
   });

   // Parallel path, createAgentForExecution (line ~860-872):
   createLiveAgent({
     ...existingConfig,
     signal: options.signal,  // NEW
   });
   ```

**Impact:** ~8 lines across 3 files.
Fully backward-compatible — `signal` is already optional everywhere.

**Open question:** When the signal fires mid-call, `generateText()` throws an
`AbortError`. The existing catch block in `liveAgent.ts:210-213` wraps it via
`wrapApiError()`. Should we let `AbortError` propagate unwrapped so
`programmaticFill.ts` can detect it as cancellation rather than an API error?
See [Open Question 1](#open-questions).

### MF-2. Extend `onLlmCallEnd` with Duration and Provider Metadata

**Priority:** High (data is available but discarded)

**Changes:**

1. **`harnessTypes.ts`** — Extend `onLlmCallEnd` callback type (lines 351-358):

   ```typescript
   /** Called after an LLM response */
   onLlmCallEnd?(call: {
     model: string;
     inputTokens: number;
     outputTokens: number;
     /** Execution thread ID for parallel tracking */
     executionId: string;
     /** Duration of the generateText() call in milliseconds */
     durationMs?: number;
     /** Provider response ID (e.g., "chatcmpl-..." for OpenAI) */
     responseId?: string;
     /** Provider request ID from response headers (e.g., x-request-id) */
     requestId?: string;
   }): void;
   ```

2. **`liveAgent.ts`** — Capture timing and extract provider metadata (lines 186-227):

   ```typescript
   // Before generateText() call (before line 201):
   const llmCallStartMs = Date.now();

   // After generateText() call, in the onLlmCallEnd block (lines 218-223):
   const durationMs = Date.now() - llmCallStartMs;
   this.callbacks.onLlmCallEnd({
     model: modelId,
     inputTokens: result.usage?.inputTokens ?? 0,
     outputTokens: result.usage?.outputTokens ?? 0,
     executionId: this.executionId,
     durationMs,
     responseId: result.response?.id,
     requestId: result.response?.headers?.['x-request-id'],
   });
   ```

3. **`fillRecordCollector.ts`** — Accept and store new fields in `onLlmCallEnd` event
   (lines 220-235):

   ```typescript
   onLlmCallEnd(call: {
     model: string;
     inputTokens: number;
     outputTokens: number;
     executionId: string;
     durationMs?: number;
     responseId?: string;
     requestId?: string;
   }): void {
     this.events.push({
       type: 'llm_call_end',
       timestamp: currentTime(),
       model: call.model,
       inputTokens: call.inputTokens,
       outputTokens: call.outputTokens,
       executionId: call.executionId,
       durationMs: call.durationMs,       // NEW
       responseId: call.responseId,         // NEW
       requestId: call.requestId,           // NEW
     });
     this.pendingLlmCalls.delete(call.executionId);
   }
   ```

**Impact:** ~15 lines across 3 files.
Fully backward-compatible — all new fields are optional.
Existing callbacks ignore extra fields.

**Open question:** Should `responseId` and `requestId` also be stored in the FillRecord
schema? They’re useful for debugging but increase record size.
See [Open Question 2](#open-questions).

### MF-3. Add `llmCallDurationMs` and `llmCallCount` to FillRecord Timeline Entries

**Priority:** Medium (makes fill records self-documenting)

Currently, LLM call duration per turn is only implicit (total turn time minus tool
time). The collector already receives `onLlmCallEnd` events with timing (after MF-2).
Making it explicit enables direct analysis.

**Changes:**

1. **`fillRecord.ts`** — Add optional fields to `TimelineEntrySchema` (after line ~149,
   after `tokens`):

   ```typescript
   /** Total LLM call duration in milliseconds (sum of all generateText() calls this turn) */
   llmCallDurationMs: z.number().int().nonneg().optional(),
   /** Number of LLM calls made this turn */
   llmCallCount: z.number().int().nonneg().optional(),
   ```

2. **`fillRecordCollector.ts`** — In the timeline building logic (lines 363-505),
   accumulate LLM call duration per turn from `llm_call_end` events:

   ```typescript
   // In the event iteration loop, when processing llm_call_end events:
   // Track per-turn LLM duration using the durationMs from MF-2
   if (event.type === 'llm_call_end' && event.durationMs !== undefined) {
     const turnKey = currentTurnKey.get(event.executionId);
     if (turnKey) {
       turnLlmDurationMs[turnKey] = (turnLlmDurationMs[turnKey] ?? 0) + event.durationMs;
       turnLlmCallCount[turnKey] = (turnLlmCallCount[turnKey] ?? 0) + 1;
     }
   }

   // When building the TimelineEntry:
   llmCallDurationMs: turnLlmDurationMs[turnKey] ?? undefined,
   llmCallCount: turnLlmCallCount[turnKey] ?? undefined,
   ```

**Impact:** ~15 lines across 2 files.
Backward-compatible — new fields are `.optional()` in the Zod schema.

**Note:** This overlaps with the FillRecord Performance Metrics spec
(`plan-2026-02-14-fill-record-performance-metrics.md`), which adds `llmParallelism` to
`TimingBreakdown`. That spec computes parallelism from paired start/end event timestamps
at the fill level; this adds per-turn granularity from the `durationMs` value provided
by MF-2. They complement each other.

### MF-4. Add Serializable Error Classification to `FillStatus`

**Priority:** Medium (enables downstream error classification without parsing)

**Current state:** `FillStatus` already preserves the full `Error` object for in-memory
use (`error?: Error` at `harnessTypes.ts:582`). However:

- `Error` objects don’t survive JSON serialization (FillRecord, logging pipelines)
- `MarkformLlmError` has `statusCode`, `provider`, `model`, `retryable` but these are
  lost when serialized
- Callers must parse error messages to distinguish `AbortError` (timeout) from
  `APICallError` (rate limit) from `RetryError` (exhausted)

**Changes:**

1. **`harnessTypes.ts`** — Add serializable error fields to the error case of
   `FillStatus` (lines 568-583):

   ```typescript
   | {
       ok: false;
       reason: 'error';
       message?: string;
       /**
        * The original Error object with its full cause chain preserved.
        * Not serialized into FillRecord — use for in-memory diagnostics.
        */
       error?: Error;
       /** Error class name (e.g., 'AbortError', 'APICallError', 'MarkformLlmError') */
       errorType?: string;
       /** HTTP status code or error code, if available */
       errorCode?: string;
     };
   ```

2. **`programmaticFill.ts`** — Extract structured error fields in catch blocks.
   Serial path (lines ~669-695):

   ```typescript
   const errorType = error instanceof Error ? error.name : undefined;
   const errorCode =
     (error as any)?.statusCode?.toString()
     ?? (error as any)?.code
     ?? undefined;

   return buildResult(
     form,
     turnCount,
     totalPatches,
     {
       ok: false,
       reason: 'error',
       message: errorMessage,
       error: errorObj,
       errorType,   // NEW
       errorCode,   // NEW
     },
     ...
   );
   ```

   Parallel path — same pattern in the parallel catch blocks.

3. **`fillRecord.ts`** — Optionally store error classification in
   `FillRecordSchema.status`:

   ```typescript
   // Extend the status section in FillRecordSchema
   errorType: z.string().optional(),
   errorCode: z.string().optional(),
   ```

4. **`fillRecordCollector.ts`** — When `setStatus('failed', ...)` is called, accept and
   store the structured error fields.

**Impact:** ~15 lines across 4 files.
Backward-compatible — all new fields are optional.

**Open question:** Should `errorType`/`errorCode` also be added to the `cancelled`
reason case? Cancellation via signal produces an `AbortError`, and knowing this could be
useful. See [Open Question 3](#open-questions).

## Implementation Plan

### Phase 1: Signal Propagation Bug Fix (MF-1)

Files: `harnessTypes.ts`, `liveAgent.ts`, `programmaticFill.ts`

- [ ] Add `signal?: AbortSignal` to `LiveAgentConfig` interface in `harnessTypes.ts`
- [ ] Add `private signal?: AbortSignal` field and constructor assignment in
  `liveAgent.ts`
- [ ] Add `abortSignal: this.signal` to `generateText()` call in `liveAgent.ts:201-209`
- [ ] Pass `signal: options.signal` in serial `createLiveAgent()` call in
  `programmaticFill.ts:574`
- [ ] Pass `signal: options.signal` in parallel `createAgentForExecution()` in
  `programmaticFill.ts:860`
- [ ] Decide AbortError handling strategy (see Open Question 1) and implement
  accordingly

### Phase 2: Callback and FillRecord Enhancements (MF-2, MF-3, MF-4)

Files: `harnessTypes.ts`, `liveAgent.ts`, `fillRecordCollector.ts`, `fillRecord.ts`,
`programmaticFill.ts`

- [ ] Extend `onLlmCallEnd` callback type with `durationMs`, `responseId`, `requestId`
  in `harnessTypes.ts:351-358`
- [ ] Add `Date.now()` timing around `generateText()` and extract `result.response.id`
  and headers in `liveAgent.ts:186-227`
- [ ] Update `fillRecordCollector.ts:220-235` to accept and store new `onLlmCallEnd`
  fields
- [ ] Add `llmCallDurationMs` and `llmCallCount` optional fields to
  `TimelineEntrySchema` in `fillRecord.ts:115-157`
- [ ] Accumulate per-turn LLM duration in timeline builder in
  `fillRecordCollector.ts:363-505`
- [ ] Add `errorType` and `errorCode` to `FillStatus` error case in
  `harnessTypes.ts:565-583`
- [ ] Extract `error.name` and `statusCode` in catch blocks in `programmaticFill.ts`
  (serial: ~669, parallel: equivalent)
- [ ] Add `errorType` and `errorCode` to FillRecord status section in `fillRecord.ts`
- [ ] Update `fillRecordCollector.ts` `setStatus()` to accept structured error fields

### Phase 3: Tests and Validation

- [ ] Add unit test for signal propagation: verify `AbortSignal` cancels in-flight
  `generateText()` calls
- [ ] Add unit test for `onLlmCallEnd` new fields: verify `durationMs`, `responseId`,
  `requestId` are passed through
- [ ] Add unit test for timeline entry: verify `llmCallDurationMs` and `llmCallCount`
  appear in FillRecord
- [ ] Add unit test for structured error fields: verify `errorType` and `errorCode` are
  populated from `MarkformLlmError`
- [ ] Update golden tests if FillRecord schema changes affect snapshots
  (`pnpm --filter markform test:golden:regen`)
- [ ] Update tryscript tests if CLI output changes (`pnpm test:tryscript:update`)
- [ ] Run full validation: `pnpm precommit`

## Testing Strategy

- **Unit tests**: Test each change independently with mock agents and mock callbacks
- **Signal propagation**: Create an `AbortController`, fire `abort()` during a mock
  `generateText()`, verify the fill returns `cancelled` status
- **Callback fields**: Mock `generateText()` result with known `response.id` and
  headers, verify they appear in `onLlmCallEnd`
- **FillRecord**: Run a fill with `recordFill: true`, verify new fields appear in the
  record JSON
- **Error classification**: Throw a `MarkformLlmError` from mock agent, verify
  `errorType` and `errorCode` in `FillStatus`
- **Golden tests**: Regenerate if schema changes affect snapshots
- **Backward compatibility**: Existing callbacks without new fields should work
  unchanged

## Open Questions

### 1. AbortError Handling in liveAgent.ts

When `signal` fires mid-call, `generateText()` throws an `AbortError`. Currently the
catch block in `liveAgent.ts:210-213` wraps ALL errors via `wrapApiError()`, which would
convert the `AbortError` into a `MarkformLlmError`. This means `programmaticFill.ts`
can’t easily detect cancellation vs.
API failure.

**Options:**

- **(a) Let AbortError propagate unwrapped** — Check
  `if (error instanceof Error && error.name === 'AbortError') throw error;` before
  calling `wrapApiError()`. The existing between-turn signal check would then handle it
  as `cancelled`.
- **(b) Wrap with a distinguishable type** — Create a specific error subclass or set a
  flag so `programmaticFill.ts` can detect it.
- **(c) Check signal state in catch** — After catching, check
  `if (this.signal?.aborted)` and throw a specific cancellation error.

**Recommendation:** Option (a) is simplest and aligns with existing cancellation
handling in `programmaticFill.ts`. Option (c) is a close second — slightly more robust
since it checks the actual signal state rather than relying on error type detection.

### 2. Should Provider Metadata Be Stored in FillRecord?

`responseId` and `requestId` from MF-2 are passed to callbacks, but should they also be
persisted in the FillRecord schema (e.g., in `TimelineEntry`)?

**Pro:** Enables post-hoc debugging of stalled fills from serialized records.
**Con:** Increases record size; provider-specific fields in a generic schema.

**Recommendation:** Store `responseId` in `TimelineEntry` (small, universally useful for
provider dashboard correlation).
Skip `requestId` for now — it’s redundant with `responseId` for most providers.
Can be added later if needed.

### 3. Should `errorType`/`errorCode` Apply to `cancelled` Status?

The `cancelled` reason currently has only `message?: string`. Cancellation via
`AbortSignal` produces an `AbortError`, and downstream consumers might want to know
this.

**Recommendation:** Keep `cancelled` simple for now — it’s a clean semantic signal.
The `errorType`/`errorCode` fields only add value on the `error` reason where the cause
is ambiguous (rate limit vs.
timeout vs. infrastructure).

### 4. AI SDK Version Compatibility

The `abortSignal` parameter and `result.response` metadata depend on AI SDK v6
(`ai@^6.0.66`). The project currently uses this version.
If the AI SDK changes these APIs in future versions, the code will need updates.

**Recommendation:** No action needed — the project already pins `ai@^6.0.66`.

### 5. Interaction with `onLlmCallEnd` Duration vs. Collector Timestamp-Based Duration

The `FillRecordCollector` already calculates LLM call duration from paired
`llm_call_start`/`llm_call_end` event timestamps (lines 558-577). MF-2 adds an explicit
`durationMs` from `Date.now()` measurement in `liveAgent.ts`. These two values will be
very close but not identical (event timestamp resolution vs.
`Date.now()` precision).

**Options:**

- **(a) Use `durationMs` from MF-2 for per-turn timeline entries** — More precise since
  it’s measured directly around the `generateText()` call.
- **(b) Continue using timestamp pairs for fill-level aggregates** — Existing code works
  and changing it risks regressions.

**Recommendation:** Use MF-2’s `durationMs` for per-turn `llmCallDurationMs` (more
precise). Leave the fill-level `TimingBreakdown.llmTimeMs` using timestamp pairs (no
regression risk). Document the two sources in code comments.

## Alternate Approaches Considered

### Timeout Instead of Signal Propagation

The AI SDK also accepts a `timeout` parameter on `generateText()`. We could expose a
`FillOptions.llmTimeoutMs` instead of propagating `signal`.

**Rejected:** The `signal` API is more flexible (callers can cancel for any reason —
timeout, user action, batch abort).
The AI SDK’s own docs recommend `abortSignal` over `timeout` for cancellation.
And `signal` is already part of the public API contract.

### Separate onLlmCallDuration Callback

Instead of adding `durationMs` to `onLlmCallEnd`, add a separate `onLlmCallDuration`
callback.

**Rejected:** Unnecessary complexity.
Adding optional fields to an existing callback is simpler and more consistent with how
`onToolEnd` already includes `durationMs`.

### Full Provider Response in onLlmCallEnd

Pass the entire `result.response` object through the callback instead of individual
fields.

**Rejected:** Leaking the full AI SDK response type into the callback interface creates
a tight coupling. Extracting specific fields (`responseId`, `requestId`) keeps the API
stable across AI SDK version changes.

## Extensions to Consider

1. **`FillOptions.llmTimeoutMs`** — A convenience wrapper that creates an `AbortSignal`
   with `AbortSignal.timeout(ms)`. Useful for callers who want per-call timeouts without
   managing `AbortController` lifecycle.
   Low effort, high convenience.

2. **Per-step onProgress callback** — The AI SDK supports `onStepFinish` within
   `generateText()`. Exposing this could provide real-time progress within a turn (e.g.,
   “step 3/20 complete”). Useful for long-running fills with many tool calls per turn.

3. **Streaming support** — `streamText()` instead of `generateText()` would enable
   real-time token streaming.
   Much more complex but would address the “is it stalled?”
   observability concern at a fundamental level.

4. **FillRecord error journal** — Store all errors encountered during a fill (not just
   the final one) in a separate section of FillRecord.
   Useful for fills that recover from transient errors — the current model only captures
   the final outcome.

## References

- `packages/markform/src/harness/liveAgent.ts` — LiveAgent, `generateText()` call
- `packages/markform/src/harness/harnessTypes.ts` — `FillCallbacks`, `LiveAgentConfig`,
  `FillStatus`, `FillOptions`
- `packages/markform/src/harness/programmaticFill.ts` — Fill loop, signal checks, error
  handling
- `packages/markform/src/harness/fillRecord.ts` — `TimelineEntrySchema`, FillRecord
  schema
- `packages/markform/src/harness/fillRecordCollector.ts` — Event collector, timeline
  builder
- `packages/markform/src/errors.ts` — `wrapApiError()`, `MarkformLlmError`
- [Vercel AI SDK v6 `generateText()`](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text)
  — `abortSignal`, `result.response`
