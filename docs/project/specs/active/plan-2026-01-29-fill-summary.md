# Plan Spec: FillSummary — Agent Actions Recap

## Purpose

Define a first-class `FillSummary` data structure (Zod schema) that captures a complete
record of everything that happened during a form fill operation. This enables:

- **Corroboration**: Attach to completed documents as provenance metadata
- **Cost analysis**: Track LLM tokens, API calls, web search usage
- **Debugging**: Detailed transcript of each turn's actions
- **Integration**: Clients can use structured data for billing, audits, analytics

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

1. **Provenance attachment**: Store `FillSummary` alongside completed form as metadata
2. **Billing/cost tracking**: Sum up LLM tokens and API calls for invoicing
3. **Analytics**: Analyze fill patterns, success rates, tool usage
4. **Audit trail**: Complete record of what actions were taken and why
5. **Client integration**: Structured data for downstream systems

## Summary of Task

Design and implement a `FillSummary` Zod schema and collection mechanism that:

1. Captures all LLM calls with token counts and costs
2. Records tool invocations (web search, fill_form, custom tools)
3. Tracks web search queries, result counts, and relevance
4. Provides a turn-by-turn transcript of actions
5. Includes form-level metadata (fields filled, skipped, validation results)
6. Supports client-defined custom metadata
7. Is compact enough for storage but detailed enough for analysis

## Design Approaches

### Option A: Built-in FillSummary Collector

Markform provides a `FillSummaryCollector` that implements `FillCallbacks` and assembles
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

### FillSummary Schema

```typescript
// Core summary returned from fillForm
export const FillSummarySchema = z.object({
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

  // LLM usage totals
  llm: z.object({
    provider: z.string(),
    model: z.string(),
    totalCalls: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    // Optional cost if client provides rate
    estimatedCostUsd: z.number().nonnegative().optional(),
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

  // Turn-by-turn timeline
  timeline: z.array(z.object({
    turnNumber: z.number().int().positive(),
    startedAt: z.string().datetime(),
    durationMs: z.number().int().nonnegative(),
    issuesAddressed: z.number().int().nonnegative(),
    patchesApplied: z.number().int().nonnegative(),
    patchesRejected: z.number().int().nonnegative(),
    llm: z.object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    }).optional(),
    toolCalls: z.array(z.object({
      tool: z.string(),
      durationMs: z.number().int().nonnegative(),
      success: z.boolean(),
    })),
    // Brief description of what happened
    summary: z.string().optional(),
  })),

  // Execution metadata
  execution: z.object({
    totalTurns: z.number().int().nonnegative(),
    parallelEnabled: z.boolean(),
    maxParallelAgents: z.number().int().positive().optional(),
    batchesExecuted: z.number().int().nonnegative().optional(),
  }),

  // Client-defined custom data
  customData: z.record(z.string(), z.unknown()).optional(),
});

export type FillSummary = z.infer<typeof FillSummarySchema>;
```

### FillSummaryCollector

```typescript
export interface FillSummaryCollectorOptions {
  // Token cost rates for estimation (per 1M tokens)
  tokenCostRates?: {
    input: number;
    output: number;
  };
  // Include detailed tool inputs/outputs in timeline (can be large)
  includeToolDetails?: boolean;
  // Custom data to include in summary
  customData?: Record<string, unknown>;
  // Callback to generate turn summaries (optional, for natural language descriptions)
  generateTurnSummary?: (turn: TurnProgress) => string;
}

export class FillSummaryCollector implements FillCallbacks {
  constructor(options?: FillSummaryCollectorOptions);

  // FillCallbacks implementation
  onTurnStart(turn: { turnNumber: number; issuesCount: number }): void;
  onTurnComplete(progress: TurnProgress): void;
  onToolStart(call: { name: string; input: unknown }): void;
  onToolEnd(call: { name: string; output: unknown; durationMs: number; error?: string }): void;
  onLlmCallStart(call: { model: string }): void;
  onLlmCallEnd(call: { model: string; inputTokens: number; outputTokens: number }): void;
  onBatchStart(info: { batchId: string; itemCount: number }): void;
  onBatchComplete(info: { batchId: string; patchesApplied: number }): void;

  // Get the assembled summary
  getSummary(): FillSummary;

  // Add custom data during execution
  addCustomData(key: string, value: unknown): void;
}
```

### Integration with fillForm

Two integration approaches:

**Approach 1: Explicit collector (recommended)**
```typescript
import { fillForm, FillSummaryCollector } from 'markform';

const collector = new FillSummaryCollector({
  tokenCostRates: { input: 3.00, output: 15.00 }, // Claude pricing
});

const result = await fillForm({
  form: markdown,
  model: 'anthropic/claude-sonnet-4-5',
  enableWebSearch: true,
  callbacks: collector,
  captureWireFormat: false,
});

const summary = collector.getSummary();
// Attach to document, store in database, etc.
```

**Approach 2: Built into FillResult (optional)**
```typescript
const result = await fillForm({
  form: markdown,
  model: 'anthropic/claude-sonnet-4-5',
  enableWebSearch: true,
  collectSummary: true, // New option
  captureWireFormat: false,
});

console.log(result.summary); // FillSummary included in result
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

### Summary Attachment to Documents

Two options for attaching summary to completed forms:

**Option 1: YAML frontmatter**
```yaml
---
fillSummary:
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
document.fill.json    # The FillSummary
```

Recommend **Option 2** (sidecar) because:
- Keeps form content clean
- Summary can be large (especially timeline)
- Easy to include/exclude from version control
- Standard JSON is more portable than embedded YAML

## Implementation Plan

### Phase 1: Core Schema & Collector

- [ ] Define `FillSummarySchema` and related types in new file
      `packages/markform/src/harness/fillSummary.ts`
- [ ] Implement `FillSummaryCollector` class
- [ ] Add `onWebSearch` callback to `FillCallbacks` interface
- [ ] Export from package entry point
- [ ] Unit tests for collector

### Phase 2: Integration & Web Search

- [ ] Wire up web search query capture in liveAgent for Anthropic provider
- [ ] Add `collectSummary` option to `FillOptions` (optional convenience)
- [ ] Include summary in `FillResult` when requested
- [ ] Integration tests with real fills

### Phase 3: Documentation & Examples

- [ ] Document FillSummary in API docs
- [ ] Add example showing summary collection and storage
- [ ] Add example showing sidecar file generation

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: MAINTAIN — all additions are optional
- **Library APIs**: MAINTAIN — new `collectSummary` option defaults to false
- **File formats**: MAINTAIN — sidecar files are opt-in, form format unchanged
- **FillCallbacks**: EXTEND — new `onWebSearch` callback is optional

## Open Questions

1. **Turn summary generation**: Should we include AI-generated natural language summaries
   of each turn? This would require an extra LLM call or client-provided function.

2. **Summary size limits**: Should we cap timeline detail for very long fills (100+
   turns)? Could offer `timelineDepth: 'full' | 'last10' | 'totalsOnly'`.

3. **Cost estimation**: Include cost estimation in core, or leave to clients? Rates
   change frequently.

4. **Parallel execution detail**: How much detail for parallel fills? Per-batch
   summaries or just aggregate?

## References

- `packages/markform/src/harness/harnessTypes.ts` — Current callback/stats types
- `packages/markform/src/harness/programmaticFill.ts` — fillForm implementation
- `packages/markform/src/harness/liveAgent.ts` — Agent and tool wrapping
