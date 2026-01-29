# Plan Spec: FillRecord — Agent Actions Recap

## Purpose

Define a first-class `FillRecord` data structure (Zod schema) that captures a complete
record of everything that happened during a form fill operation. This enables:

- **Corroboration**: Attach to completed documents as provenance metadata
- **Cost analysis**: Track LLM tokens, API calls, web search usage
- **Debugging**: Detailed transcript of each turn's actions
- **Integration**: Clients can use structured data for billing, audits, analytics

### Naming Convention

- **`FillRecord`**: The complete, detailed record of everything that happened during a
  fill operation. Includes full timeline, per-turn tokens, all tool calls with timestamps.
- **`FillSummary`** (future): Reserved for briefer/aggregated versions that might omit
  timeline detail or collapse tool calls. Not implemented in this spec.

**Related docs:**
- `packages/markform/src/harness/harnessTypes.ts` — Current harness types (FillCallbacks,
  TurnStats, TurnProgress)
- `packages/markform/src/engine/coreTypes.ts` — Core types (SessionTurn, WireFormat)
- `docs/project/specs/active/plan-2026-01-27-parallel-form-filling.md` — Parallel filling
  (callbacks for batches/order levels)

## Background

### Current State

The form filling harness already captures significant execution data:

1. **Callbacks** (`FillCallbacks`): Real-time hooks for observing execution
   - `onTurnStart`, `onTurnComplete` — Turn lifecycle
   - `onToolStart`, `onToolEnd` — Tool execution with timing
   - `onLlmCallStart`, `onLlmCallEnd` — LLM calls with token counts
   - `onBatchStart`, `onBatchComplete` — Parallel batch execution
   - `onOrderLevelStart`, `onOrderLevelComplete` — Order level processing

2. **TurnStats**: Per-turn metrics (tokens, tool call counts, form progress)

3. **SessionTurn**: Complete turn record for golden tests (inspect, apply, wire format)

4. **FillResult**: Final output (status, markdown, values, turns, patches)

### Gap Analysis

What's **missing** is a unified, client-facing summary object that:

- Aggregates data across all turns into a single structure
- Provides both detailed timeline AND roll-up totals
- Is serializable as JSON for storage/transmission
- Includes customizable metadata fields
- Is designed for external consumption (not internal debugging)

### Use Cases

1. **Provenance attachment**: Store `FillRecord` alongside completed form as metadata
2. **Billing/cost tracking**: Sum up LLM tokens and API calls for invoicing
3. **Analytics**: Analyze fill patterns, success rates, tool usage
4. **Audit trail**: Complete record of what actions were taken and why
5. **Client integration**: Structured data for downstream systems

## Summary of Task

Design and implement a `FillRecord` Zod schema and collection mechanism that:

1. Captures all LLM calls with token counts (per-turn and totals)
2. Records tool invocations by type (web search, fill_form, custom tools)
3. Tracks web search queries and result counts
4. Provides a turn-by-turn timeline of actions with per-turn token usage
5. Includes form-level metadata (fields filled, skipped, validation results)
6. Supports client-defined custom metadata
7. No artificial size limits — if a form fill is long, the summary can be too

## Design Approaches

### Option A: Built-in FillRecord Collector

Markform provides a `FillRecordCollector` that implements `FillCallbacks` and assembles
the summary internally.

**Pros:**
- Single source of truth, consistent structure
- Easy for clients: just pass collector to fillForm, get summary back
- Can optimize data collection internally
- Summary is part of FillResult

**Cons:**
- More code in Markform core
- Less flexibility for clients who want different structures
- May collect data clients don't need

### Option B: Utility Tools via Callbacks

Markform provides utility functions that clients compose with their own callbacks.

```typescript
import { createSummaryCallbacks, aggregateSummary } from 'markform';

const collector = createSummaryCallbacks();
await fillForm({ ..., callbacks: collector.callbacks });
const summary = collector.getSummary();
```

**Pros:**
- Separates collection from core harness
- Clients can extend/customize
- Optional import reduces bundle size

**Cons:**
- Slightly more complex client code
- Summary structure still defined by Markform

### Option C: Enhanced Callbacks Only

Markform only ensures callbacks are fully expressive; clients build their own summaries.

**Pros:**
- Maximum flexibility
- Markform stays minimal
- Clients own their data structures

**Cons:**
- Every client reinvents the wheel
- No standard format for interchange
- Harder to ensure completeness

### Recommended Approach: Option A with Export Hooks

Implement Option A (built-in collector) as the primary path, but design it so that:

1. The Zod schemas are exported for clients who want to build their own collectors
2. The collector is optional — clients can still use raw callbacks
3. Custom metadata is supported via a generic `customData` field
4. The summary includes a `timeline` (detailed) and `totals` (aggregated) view

This gives clients the "it just works" experience while preserving flexibility.

## Detailed Design

### FillRecord Schema

```typescript
// Core summary returned from fillForm
export const FillRecordSchema = z.object({
  // Identity
  sessionId: z.string().uuid(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),

  // Outcome
  status: z.enum(['completed', 'partial', 'failed', 'cancelled']),
  statusDetail: z.string().optional(),

  // Form metadata
  form: z.object({
    fieldsTotal: z.number().int().nonnegative(),
    fieldsFilled: z.number().int().nonnegative(),
    fieldsSkipped: z.number().int().nonnegative(),
    fieldsRemaining: z.number().int().nonnegative(),
    validationsPassed: z.number().int().nonnegative(),
    validationsFailed: z.number().int().nonnegative(),
  }),

  // LLM usage totals (tokens only - clients can calculate costs from these)
  llm: z.object({
    provider: z.string(),
    model: z.string(),
    totalCalls: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  }),

  // Tool usage totals
  tools: z.object({
    totalCalls: z.number().int().nonnegative(),
    totalDurationMs: z.number().int().nonnegative(),
    byTool: z.record(z.string(), z.object({
      calls: z.number().int().nonnegative(),
      durationMs: z.number().int().nonnegative(),
      errors: z.number().int().nonnegative(),
    })),
  }),

  // Web search specifics (if enabled)
  webSearch: z.object({
    enabled: z.boolean(),
    totalQueries: z.number().int().nonnegative(),
    totalResults: z.number().int().nonnegative(),
    queries: z.array(z.object({
      query: z.string(),
      resultCount: z.number().int().nonnegative(),
      turnNumber: z.number().int().positive(),
    })),
  }).optional(),

  // Turn-by-turn timeline (no size limits - full history always captured)
  // Same structure for serial and parallel execution
  timeline: z.array(z.object({
    turnNumber: z.number().int().positive(),
    // Execution thread identifier (e.g., "main", "batch-1-item-0", "batch-1-item-1")
    // Allows debugging/visibility into parallel execution
    executionId: z.string(),
    // Timestamps for precise timing (totals calculated from these)
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    durationMs: z.number().int().nonnegative(),
    issuesAddressed: z.number().int().nonnegative(),
    patchesApplied: z.number().int().nonnegative(),
    patchesRejected: z.number().int().nonnegative(),
    // Per-turn token usage (from AI SDK result.usage)
    tokens: z.object({
      input: z.number().int().nonnegative(),
      output: z.number().int().nonnegative(),
    }),
    toolCalls: z.array(z.object({
      tool: z.string(),
      startedAt: z.string().datetime(),
      completedAt: z.string().datetime(),
      durationMs: z.number().int().nonnegative(),
      success: z.boolean(),
    })),
  })),

  // Execution metadata
  execution: z.object({
    totalTurns: z.number().int().nonnegative(),
    parallelEnabled: z.boolean(),
    maxParallelAgents: z.number().int().positive().optional(),
    // Unique execution threads seen (derived from timeline executionIds)
    executionThreads: z.array(z.string()),
  }),

  // Client-defined custom data
  customData: z.record(z.string(), z.unknown()).optional(),
});

export type FillRecord = z.infer<typeof FillRecordSchema>;
```

### FillRecordCollector

```typescript
export interface FillRecordCollectorOptions {
  // Include detailed tool inputs/outputs in timeline (can be large)
  includeToolDetails?: boolean;
  // Custom data to include in summary
  customData?: Record<string, unknown>;
}

export class FillRecordCollector implements FillCallbacks {
  constructor(options?: FillRecordCollectorOptions);

  // FillCallbacks implementation (all methods are thread-safe)
  onTurnStart(turn: { turnNumber: number; issuesCount: number; executionId: string }): void;
  onTurnComplete(progress: TurnProgress): void;
  onToolStart(call: { name: string; input: unknown; executionId: string }): void;
  onToolEnd(call: { name: string; output: unknown; durationMs: number; error?: string }): void;
  onLlmCallStart(call: { model: string; executionId: string }): void;
  onLlmCallEnd(call: { model: string; inputTokens: number; outputTokens: number }): void;
  onBatchStart(info: { batchId: string; itemCount: number }): void;
  onBatchComplete(info: { batchId: string; patchesApplied: number }): void;

  // Get the assembled record
  getRecord(): FillRecord;

  // Add custom data during execution
  addCustomData(key: string, value: unknown): void;
}
```

### Thread-Safety Requirements

The `FillRecordCollector` must be thread-safe for parallel execution:

1. **Concurrent callback invocation**: Multiple execution threads may call callbacks
   simultaneously during parallel batch processing.

2. **Implementation approach**: Use an array-based append-only pattern. Each callback
   appends a timestamped event; `getSummary()` aggregates at read time.

3. **Execution ID tracking**: Callbacks receive an `executionId` parameter to identify
   which thread generated the event. For serial execution, this is always `"main"`.
   For parallel execution, it follows the pattern `"batch-{batchId}-item-{index}"`.

4. **Timestamp-based ordering**: Events are ordered by timestamp in the final summary,
   allowing clients to see interleaved parallel execution.

```typescript
// Internal event structure (not exposed in public API)
interface CollectorEvent {
  type: 'turn_start' | 'turn_complete' | 'tool_start' | 'tool_end' | 'llm_call';
  timestamp: string; // ISO datetime
  executionId: string;
  data: unknown;
}
```

### Integration with fillForm

Two integration approaches:

**Approach 1: Explicit collector (recommended)**
```typescript
import { fillForm, FillRecordCollector } from 'markform';

const collector = new FillRecordCollector();

const result = await fillForm({
  form: markdown,
  model: 'anthropic/claude-sonnet-4-5',
  enableWebSearch: true,
  callbacks: collector,
  captureWireFormat: false,
});

const record = collector.getRecord();
// record.llm.inputTokens, record.llm.outputTokens for cost calculation
// record.timeline[n].tokens for per-turn breakdown
```

**Approach 2: Built into FillResult (optional)**
```typescript
const result = await fillForm({
  form: markdown,
  model: 'anthropic/claude-sonnet-4-5',
  enableWebSearch: true,
  collectRecord: true, // New option
  captureWireFormat: false,
});

console.log(result.record); // FillRecord included in result
```

### Web Search Query Capture

Currently web search is handled by provider-specific tools (Anthropic's web_search,
OpenAI's web_search, etc.). To capture query details, we need to:

1. **For Anthropic**: The web_search tool input includes the query. Capture in onToolStart.
2. **For custom tools**: Client's tool can emit query metadata via a new callback or
   by including it in the tool result.

New callback for explicit web search tracking:
```typescript
interface FillCallbacks {
  // ... existing callbacks ...

  /** Called when a web search is performed (provides query details) */
  onWebSearch?(info: {
    query: string;
    resultCount: number;
    provider: string;
  }): void;
}
```

### Record Attachment to Documents

Two options for attaching the record to completed forms:

**Option 1: YAML frontmatter**
```yaml
---
fillRecord:
  sessionId: "abc-123"
  completedAt: "2026-01-29T10:30:00Z"
  llm:
    model: "claude-sonnet-4-5"
    inputTokens: 5000
    outputTokens: 2000
  # ... abbreviated
---
```

**Option 2: Sidecar file**
```
document.md           # The filled form
document.fill.json    # The FillRecord
```

Recommend **Option 2** (sidecar) because:
- Keeps form content clean
- Record can be large (especially timeline with many turns)
- Easy to include/exclude from version control
- Standard JSON is more portable than embedded YAML

## Implementation Plan

### Phase 1: Core Schema & Collector

- [ ] Define `FillRecordSchema` and related types in new file
      `packages/markform/src/harness/fillRecord.ts`
- [ ] Implement `FillRecordCollector` class
- [ ] Add `onWebSearch` callback to `FillCallbacks` interface
- [ ] Export from package entry point
- [ ] Unit tests for collector

### Phase 2: Integration & Web Search

- [ ] Wire up web search query capture in liveAgent for Anthropic provider
- [ ] Add `collectRecord` option to `FillOptions` (optional convenience)
- [ ] Include record in `FillResult` when requested
- [ ] Integration tests with real fills

### Phase 3: Documentation & Examples

- [ ] Document FillRecord in API docs
- [ ] Add example showing summary collection and storage
- [ ] Add example showing sidecar file generation

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: MAINTAIN — all additions are optional
- **Library APIs**: MAINTAIN — new `collectRecord` option defaults to false
- **File formats**: MAINTAIN — sidecar files are opt-in, form format unchanged
- **FillCallbacks**: EXTEND — new `onWebSearch` callback is optional

## Design Decisions

These questions were resolved during spec review:

1. **Turn summary generation**: **No** — Not worth the extra LLM calls or complexity.
   Clients who need natural language summaries can generate them from the structured
   data.

2. **Summary size limits**: **No caps** — If a form fill is long (100+ turns), the
   summary can be correspondingly long. Full history is always captured.

3. **Cost estimation**: **Tokens only, no costs** — The AI SDK provides `inputTokens`
   and `outputTokens` via `result.usage`. We track these totals and per-turn. Clients
   can calculate costs from tokens using their own rate tables (which change frequently).

4. **Parallel execution detail**: **Same structure, with execution IDs** — No
   difference between serial and parallel in capture structure. Each turn/call includes
   an `executionId` field (e.g., `"main"`, `"batch-1-item-0"`) for debugging and
   visibility. Timestamps on everything allow calculating totals and understanding
   parallel execution patterns.

## References

- `packages/markform/src/harness/harnessTypes.ts` — Current callback/stats types
- `packages/markform/src/harness/programmaticFill.ts` — fillForm implementation
- `packages/markform/src/harness/liveAgent.ts` — Agent and tool wrapping
