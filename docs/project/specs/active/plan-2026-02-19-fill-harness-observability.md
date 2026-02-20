# Feature: Fill Harness Observability and Signal Propagation

**Date:** 2026-02-19

**Author:** Joshua Levy with LLM assistance

**Status:** Ready

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
- Include the raw event log in FillRecord for debugging and fill record browser
  visualization

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

4. **`liveAgent.ts`** — Let `AbortError` propagate unwrapped past `wrapApiError()`. In
   the catch block (line 210-213), check before wrapping:

   ```typescript
   } catch (error) {
     // Let AbortError propagate unwrapped so programmaticFill.ts
     // can detect cancellation vs. API failure
     if (error instanceof Error && error.name === 'AbortError') {
       throw error;
     }
     // Wrap API errors with rich context for debugging
     throw wrapApiError(error, this.provider ?? 'unknown', modelId);
   }
   ```

5. **`programmaticFill.ts`** — Update catch blocks (serial at line 669, parallel at line
   1205\) to detect signal-triggered aborts.
   When `AbortError` propagates from `liveAgent.ts`, it’s caught by the `fillFormTool()`
   catch block — which currently returns `reason: 'error'`. The between-turn signal
   check (line 712) never fires because the catch already returns.
   Fix: check signal state in the catch:

   ```typescript
   // Serial path, catch block (line 669-694):
   } catch (error) {
     // Check if this is a signal-triggered abort — return 'cancelled', not 'error'
     if (options.signal?.aborted) {
       let record: FillRecord | undefined;
       if (collector) {
         collector.setStatus('cancelled');
         record = collector.getRecord(getProgressCounts(form, targetRoles));
       }
       return buildResult(
         form, turnCount, totalPatches,
         { ok: false, reason: 'cancelled' },
         inputContextWarnings, turnIssues, record,
       );
     }
     // ... existing error handling unchanged ...
   }
   ```

   Same pattern for the parallel catch at line 1205-1222.

**Impact:** ~20 lines across 3 files.
Fully backward-compatible — `signal` is already optional everywhere.

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

**Decision:** Both `responseId` and `requestId` will also be stored in the FillRecord
`TimelineEntry` schema (see MF-3 below).
The FillRecord should be fully structured and detailed to support the fill record
browser and post-hoc debugging of stalled fills.

### MF-3. Add LLM Call Details to FillRecord Timeline Entries

**Priority:** Medium (makes fill records self-documenting)

Currently, LLM call duration per turn is only implicit (total turn time minus tool
time). The collector already receives `onLlmCallEnd` events with timing (after MF-2).
Making it explicit enables direct analysis.
Additionally, provider metadata (`responseId`, `requestId`) should be persisted in the
FillRecord to support the fill record browser and post-hoc debugging of stalled fills.

**Changes:**

1. **`fillRecord.ts`** — Add optional fields to `TimelineEntrySchema` (after line 150,
   after the `tokens` field, before `toolCalls` at line 152):

   ```typescript
   /** Total LLM call duration in milliseconds (sum of all generateText() calls this turn) */
   llmCallDurationMs: z.number().int().nonnegative().optional(),
   /** Number of LLM calls made this turn */
   llmCallCount: z.number().int().nonnegative().optional(),
   /** Provider response IDs for this turn (e.g., "chatcmpl-..." for OpenAI) */
   responseIds: z.array(z.string()).optional(),
   /** Provider request IDs for this turn (e.g., x-request-id header values) */
   requestIds: z.array(z.string()).optional(),
   ```

   Note: `responseIds` and `requestIds` are arrays because a single turn may involve
   multiple `generateText()` calls (e.g., in multi-step tool use).
   Each call appends its IDs.

2. **`fillRecordCollector.ts`** — In the timeline building logic (lines 363-505),
   accumulate LLM call details per turn from `llm_call_end` events:

   ```typescript
   // In the event iteration loop, when processing llm_call_end events:
   // Track per-turn LLM duration and provider metadata using fields from MF-2
   if (event.type === 'llm_call_end') {
     const turnKey = currentTurnKey.get(event.executionId);
     if (turnKey) {
       if (event.durationMs !== undefined) {
         turnLlmDurationMs[turnKey] = (turnLlmDurationMs[turnKey] ?? 0) + event.durationMs;
       }
       turnLlmCallCount[turnKey] = (turnLlmCallCount[turnKey] ?? 0) + 1;
       if (event.responseId) {
         (turnResponseIds[turnKey] ??= []).push(event.responseId);
       }
       if (event.requestId) {
         (turnRequestIds[turnKey] ??= []).push(event.requestId);
       }
     }
   }

   // When building the TimelineEntry:
   llmCallDurationMs: turnLlmDurationMs[turnKey] ?? undefined,
   llmCallCount: turnLlmCallCount[turnKey] ?? undefined,
   responseIds: turnResponseIds[turnKey]?.length ? turnResponseIds[turnKey] : undefined,
   requestIds: turnRequestIds[turnKey]?.length ? turnRequestIds[turnKey] : undefined,
   ```

**Impact:** ~25 lines across 2 files.
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
   `FillStatus` (lines 565-583):

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

4. **`fillRecordCollector.ts`** — Extend `setStatus()` (line 301-303) to accept optional
   structured error fields.
   Change from positional args to an options object:

   ```typescript
   // Before:
   setStatus(status: FillRecordStatus, detail?: string): void

   // After:
   setStatus(
     status: FillRecordStatus,
     detail?: string,
     errorInfo?: { errorType?: string; errorCode?: string },
   ): void {
     this.explicitStatus = status;
     this.explicitStatusDetail = detail;
     this.explicitErrorType = errorInfo?.errorType;
     this.explicitErrorCode = errorInfo?.errorCode;
   }
   ```

   Note: Using a third parameter (not changing `detail` to an object) preserves backward
   compatibility with existing `setStatus('failed', message)` calls.

5. **`harnessTypes.ts`** — Also add `errorType`/`errorCode` to the `cancelled` reason
   case. Cancellation via `AbortSignal` produces an `AbortError`, and storing this in the
   FillRecord makes the record fully self-documenting:

   ```typescript
   | { ok: false; reason: 'max_turns' | 'batch_limit' | 'cancelled'; message?: string;
       errorType?: string; errorCode?: string; }
   ```

**Impact:** ~15 lines across 4 files.
Backward-compatible — all new fields are optional.

### MF-5. Include Raw Event Log in FillRecord

**Priority:** Medium (makes fill records fully self-contained for debugging)

The `FillRecordCollector` already captures a complete chronological event stream
(`private events: CollectorEvent[]`) with 7 typed event types: `turn_start`,
`turn_complete`, `llm_call_start`, `llm_call_end`, `tool_start`, `tool_end`,
`web_search`. Each event has a timestamp, executionId, and type-specific data.

These events are used internally to build the structured fill record (timeline,
toolSummary, timingBreakdown) and then **discarded** in `getRecord()`
(`fillRecordCollector.ts:309`). The structured output is an aggregation that loses the
chronological interleaving — exactly what’s needed to debug parallel execution stalls
and to power richer visualizations in the fill record browser.

**No new option needed.** The existing `recordFill: boolean` already gates whether the
collector is created.
When `recordFill` is true, events are collected in memory regardless — the collection
cost is already paid.
The change is simply to stop discarding them.

**Changes:**

1. **`fillRecordCollector.ts`** — Export the `CollectorEvent` type (currently internal)
   and include events in `getRecord()` output:

   ```typescript
   // Export the event union type (line ~97-104, currently internal)
   export type CollectorEvent = /* existing union */;

   // In getRecord() (line ~335-356), add:
   return {
     ...existingFields,
     eventLog: this.events,  // already in memory, zero additional collection cost
   };
   ```

2. **`fillRecord.ts`** — Add the `eventLog` field to `FillRecordSchema` and define the
   event schema. Since `CollectorEvent` is currently a TypeScript-only type, it needs a
   corresponding Zod schema:

   ```typescript
   // Define Zod schemas for each event type (mirror interfaces in fillRecordCollector.ts:34-104)
   const EventTurnStartSchema = z.object({
     type: z.literal('turn_start'),
     timestamp: z.string().datetime(),
     turnNumber: z.number().int().positive(),
     issuesCount: z.number().int().nonnegative(),
     order: z.number().int().nonnegative(),
     executionId: z.string(),
   });
   const EventTurnCompleteSchema = z.object({
     type: z.literal('turn_complete'),
     timestamp: z.string().datetime(),
     turnNumber: z.number().int().positive(),
     patchesApplied: z.number().int().nonnegative(),
     patchesRejected: z.number().int().nonnegative(),
     issuesAddressed: z.number().int().nonnegative(),
     coercionWarnings: z.array(PatchWarningSchema).optional(),
     executionId: z.string().optional(),
   });
   const EventLlmCallStartSchema = z.object({
     type: z.literal('llm_call_start'),
     timestamp: z.string().datetime(),
     model: z.string(),
     executionId: z.string(),
   });
   const EventLlmCallEndSchema = z.object({
     type: z.literal('llm_call_end'),
     timestamp: z.string().datetime(),
     model: z.string(),
     inputTokens: z.number().int().nonnegative(),
     outputTokens: z.number().int().nonnegative(),
     executionId: z.string(),
     durationMs: z.number().int().nonnegative().optional(),   // from MF-2
     responseId: z.string().optional(),                        // from MF-2
     requestId: z.string().optional(),                         // from MF-2
   });
   const EventToolStartSchema = z.object({
     type: z.literal('tool_start'),
     timestamp: z.string().datetime(),
     name: z.string(),
     input: z.unknown(),
     executionId: z.string(),
   });
   const EventToolEndSchema = z.object({
     type: z.literal('tool_end'),
     timestamp: z.string().datetime(),
     name: z.string(),
     output: z.unknown(),
     durationMs: z.number().int().nonnegative(),
     error: z.string().optional(),
     executionId: z.string(),
   });
   const EventWebSearchSchema = z.object({
     type: z.literal('web_search'),
     timestamp: z.string().datetime(),
     query: z.string(),
     resultCount: z.number().int().nonnegative(),
     provider: z.string(),
     executionId: z.string(),
   });

   const CollectorEventSchema = z.discriminatedUnion('type', [
     EventTurnStartSchema,
     EventTurnCompleteSchema,
     EventLlmCallStartSchema,
     EventLlmCallEndSchema,
     EventToolStartSchema,
     EventToolEndSchema,
     EventWebSearchSchema,
   ]);

   // In FillRecordSchema (after customData at line 360, before closing });):
   /** Raw chronological event log for debugging and visualization */
   eventLog: z.array(CollectorEventSchema).optional(),
   ```

   The field is `optional` in the Zod schema for backward compatibility — existing fill
   records without `eventLog` still parse fine.
   The `FillRecord` type (`fillRecord.ts:363`) will automatically include it via
   `z.infer<>`.

3. **`fillRecordCollector.ts`** — Update the `LlmCallEndEvent` interface to include the
   new fields from MF-2 (`durationMs`, `responseId`, `requestId`) so they appear in the
   event log:

   ```typescript
   interface LlmCallEndEvent {
     type: 'llm_call_end';
     timestamp: string;
     model: string;
     inputTokens: number;
     outputTokens: number;
     executionId: string;
     durationMs?: number;     // from MF-2
     responseId?: string;     // from MF-2
     requestId?: string;      // from MF-2
   }
   ```

**Size estimate:** A 30-turn parallel fill generates ~200 events at ~100-200 bytes each
= 20-40KB. Typical fill records are ~290KB. The event log adds ~10-15%.

**Impact:** ~5 lines in `fillRecordCollector.ts`, ~75 lines in `fillRecord.ts` (Zod
schemas for 7 event types + discriminated union + FillRecordSchema addition).
Backward-compatible — optional field.

**Open question:** Should the event log Zod schemas live in `fillRecord.ts` alongside
the rest of the FillRecord schema, or in a separate `eventLogSchema.ts` file?
The 7 event schemas add ~50 lines.
See [Open Question 6](#open-questions).

## Implementation Plan

### Phase 1: Signal Propagation Bug Fix (MF-1)

Files: `harnessTypes.ts`, `liveAgent.ts`, `programmaticFill.ts`

- [ ] Add `signal?: AbortSignal` to `LiveAgentConfig` interface in
  `harnessTypes.ts:127-197` (after `maxRetries` at line 196)
- [ ] Add `private signal?: AbortSignal` field to `LiveAgent` class in
  `liveAgent.ts:63-75` (after `maxRetries` at line 75)
- [ ] Add `this.signal = config.signal` to `LiveAgent` constructor in
  `liveAgent.ts:77-103` (after line 87)
- [ ] Add `abortSignal: this.signal` to `generateText()` call in `liveAgent.ts:201-209`
- [ ] Add AbortError passthrough in catch block at `liveAgent.ts:210-213`: check
  `error.name === 'AbortError'` before calling `wrapApiError()`
- [ ] Pass `signal: options.signal` in serial `createLiveAgent()` call at
  `programmaticFill.ts:574-585`
- [ ] Pass `signal: options.signal` in parallel `createAgentForExecution()` at
  `programmaticFill.ts:860-872`
- [ ] Add signal check in serial catch block at `programmaticFill.ts:669`: if
  `options.signal?.aborted`, return `cancelled` instead of `error`
- [ ] Add signal check in parallel catch block at `programmaticFill.ts:1205`: if
  `options.signal?.aborted`, return `cancelled`/`aborted` instead of `error`

### Phase 2: Callback and FillRecord Enhancements (MF-2, MF-3, MF-4, MF-5)

Files: `harnessTypes.ts`, `liveAgent.ts`, `fillRecordCollector.ts`, `fillRecord.ts`,
`programmaticFill.ts`

**MF-2: onLlmCallEnd extension**

- [ ] Extend `onLlmCallEnd` callback type with `durationMs`, `responseId`, `requestId`
  in `harnessTypes.ts:351-358`
- [ ] Add `Date.now()` timing around `generateText()` and extract `result.response.id`
  and headers in `liveAgent.ts:186-227`
- [ ] Update `LlmCallEndEvent` interface in `fillRecordCollector.ts:61-68` to include
  `durationMs`, `responseId`, `requestId`
- [ ] Update `fillRecordCollector.ts:220-235` `onLlmCallEnd()` to accept and store new
  fields

**MF-3: FillRecord timeline LLM details**

- [ ] Add `llmCallDurationMs`, `llmCallCount`, `responseIds`, `requestIds` optional
  fields to `TimelineEntrySchema` in `fillRecord.ts:115-157`
- [ ] Accumulate per-turn LLM duration and provider IDs in timeline builder in
  `fillRecordCollector.ts:363-505`

**MF-4: Structured error classification**

- [ ] Add `errorType` and `errorCode` to `FillStatus` error case in
  `harnessTypes.ts:568-583`
- [ ] Add `errorType` and `errorCode` to `FillStatus` cancelled/max_turns/batch_limit
  case in `harnessTypes.ts:567`
- [ ] Extract `error.name` and `statusCode` in serial catch block at
  `programmaticFill.ts:669-694`
- [ ] Extract `error.name` and `statusCode` in parallel catch block at
  `programmaticFill.ts:1205-1222`
- [ ] Add `errorType` and `errorCode` to FillRecord status section in
  `fillRecord.ts:306-308` (near `statusDetail`)
- [ ] Update `fillRecordCollector.ts:301-303` `setStatus()` to accept and store
  `errorType` and `errorCode`

**MF-5: Raw event log in FillRecord**

- [ ] Export `CollectorEvent` type from `fillRecordCollector.ts`
- [ ] Define Zod schemas for all 7 event types in `fillRecord.ts` (including new MF-2
  fields on `LlmCallEndEvent`)
- [ ] Create `CollectorEventSchema` discriminated union in `fillRecord.ts`
- [ ] Add `eventLog: z.array(CollectorEventSchema).optional()` to `FillRecordSchema`
- [ ] Include `this.events` as `eventLog` in `getRecord()` return value
  (`fillRecordCollector.ts:335-356`)

### Phase 3: Tests and Validation

- [ ] Add unit test for signal propagation: verify `AbortSignal` cancels in-flight
  `generateText()` calls and returns `cancelled` status
- [ ] Add unit test for AbortError passthrough: verify `AbortError` is not wrapped by
  `wrapApiError()` in `liveAgent.ts`
- [ ] Add unit test for `onLlmCallEnd` new fields: verify `durationMs`, `responseId`,
  `requestId` are passed through
- [ ] Add unit test for timeline entry: verify `llmCallDurationMs`, `llmCallCount`,
  `responseIds`, `requestIds` appear in FillRecord
- [ ] Add unit test for structured error fields: verify `errorType` and `errorCode` are
  populated from `MarkformLlmError`
- [ ] Add unit test for `errorType` on cancelled status: verify AbortError name is
  captured
- [ ] Add unit test for event log: verify `eventLog` array is present in FillRecord when
  `recordFill: true`, with correct event types and chronological ordering
- [ ] Add unit test for event log Zod parsing: verify `CollectorEventSchema` correctly
  validates all 7 event types
- [ ] Update golden tests if FillRecord schema changes affect snapshots
  (`pnpm --filter markform test:golden:regen`)
- [ ] Update tryscript tests if CLI output changes (`pnpm test:tryscript:update`)
- [ ] Run full validation: `pnpm precommit`

## Testing Strategy

- **Unit tests**: Test each change independently with mock agents and mock callbacks
- **Signal propagation**: Create an `AbortController`, fire `abort()` during a mock
  `generateText()`, verify the fill returns `cancelled` status
- **AbortError passthrough**: Verify `AbortError` propagates unwrapped from `liveAgent`
  catch block
- **Callback fields**: Mock `generateText()` result with known `response.id` and
  headers, verify they appear in `onLlmCallEnd`
- **FillRecord timeline**: Run a fill with `recordFill: true`, verify
  `llmCallDurationMs`, `llmCallCount`, `responseIds`, `requestIds` appear in timeline
  entries
- **Event log**: Run a fill with `recordFill: true`, verify `eventLog` array is present,
  contains all expected event types in chronological order, and round-trips through Zod
  parsing
- **Error classification**: Throw a `MarkformLlmError` from mock agent, verify
  `errorType` and `errorCode` in `FillStatus` and FillRecord
- **Golden tests**: Regenerate if schema changes affect snapshots
- **Backward compatibility**: Existing callbacks without new fields should work
  unchanged; existing fill records without `eventLog` should still parse

## Decisions (Resolved Open Questions)

### 1. AbortError Handling in liveAgent.ts — RESOLVED: Option (a)

Let `AbortError` propagate unwrapped.
Check `if (error instanceof Error && error.name === 'AbortError') throw error;` before
calling `wrapApiError()`. The existing between-turn signal check handles it as
`cancelled` status. This is reflected in MF-1 design above.

### 2. Provider Metadata in FillRecord — RESOLVED: Yes, store both

Store both `responseId` and `requestId` in `TimelineEntry` (as `responseIds` and
`requestIds` arrays).
The FillRecord should be fully structured and detailed to support the fill record
browser and post-hoc debugging.
This is reflected in MF-3 design above.

### 3. `errorType`/`errorCode` on `cancelled` Status — RESOLVED: Yes

Add `errorType`/`errorCode` to the `cancelled` reason case too, since the FillRecord
should capture the full picture.
This is reflected in MF-4 design above.

### 4. AI SDK Version Compatibility — No action needed

The project already pins `ai@^6.0.66` which supports `abortSignal` and
`result.response`.

### 5. Duration Source: MF-2 `durationMs` vs. Timestamp Pairs — RESOLVED

Use MF-2’s explicit `durationMs` for per-turn `llmCallDurationMs` (more precise).
Leave fill-level `TimingBreakdown.llmTimeMs` using timestamp pairs (no regression risk).
Document the two sources in code comments.

### 6. Event Log Schema Location — RESOLVED: Option (a)

Keep Zod schemas in `fillRecord.ts`. The event schemas are part of the FillRecord
contract and belong with the rest of the schema.
The file is ~300 lines; adding ~75 more is manageable.

## Senior Engineering Review Notes

### Critical Issue Found and Fixed: AbortError Catch Path

The original issue (MF-1) proposed letting `AbortError` propagate unwrapped from
`liveAgent.ts` and relying on the existing between-turn signal checks in
`programmaticFill.ts` to handle it as cancellation.
**This doesn’t work.** The catch blocks in `programmaticFill.ts` (serial at line 669,
parallel at 1205) catch the `AbortError` BEFORE the signal check at line 712 runs.
They’d return `{ reason: 'error' }` instead of `{ reason: 'cancelled' }`.

**Fix added to spec:** The catch blocks now check `options.signal?.aborted` first,
before treating the error as a fill failure.
This is the correct approach because it checks signal state (authoritative) rather than
relying on error type matching (fragile).

### Design Consideration: `responseIds`/`requestIds` as Arrays

The spec uses arrays because a single turn *could* involve multiple `generateText()`
calls. In practice, `fillFormTool()` calls `generateText()` exactly once per invocation
(multi-step tool use happens within a single `generateText()` call via `stopWhen`). So
`llmCallCount` will always be 1 per turn and the arrays will have exactly one element.

The arrays are **intentionally defensive** — if the architecture changes in the future
(retry within a turn, multi-model calls), they handle it without schema migration.
The cost is negligible (one-element arrays vs.
scalar fields).

### Duration Measurement Placement

The `Date.now()` timer for `durationMs` in MF-2 is placed AFTER the `onLlmCallStart`
callback (which fires before `generateText()`) and BEFORE the `generateText()` call.
This correctly measures only `generateText()` wall-clock time, not callback overhead.

On AbortError: if `generateText()` throws, we don’t reach the `onLlmCallEnd` block, so
no duration is reported for cancelled/failed calls.
This is correct — partial duration of a failed call has no diagnostic value.

### Backward Compatibility Verified

- **Callback API**: All new fields are optional — existing `onLlmCallEnd` callbacks
  ignore extra properties
- **FillRecord schema**: All new fields use `.optional()` — existing serialized records
  parse unchanged
- **`setStatus()`**: New third parameter is optional — existing
  `setStatus('failed', msg)` calls work unchanged
- **`LiveAgentConfig`**: `signal` is optional — existing configs without it work
  unchanged
- **`_testAgent` path**: Both serial and parallel paths skip `createLiveAgent()` when
  `_testAgent` is provided, so the `signal` plumbing doesn’t affect test mock behavior

### Golden Test Impact

MF-3 adds optional fields to `TimelineEntrySchema` and MF-5 adds `eventLog` to
`FillRecordSchema`. The golden tests use `StableFillRecord` which strips timing.
Need to verify whether `llmCallDurationMs`, `responseIds`, `requestIds`, and `eventLog`
need to be added to the `StableFillRecord` stripping logic, or whether they should be
included in golden output (since they’re optional, existing goldens won’t break — but
new fills will produce different output).

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
