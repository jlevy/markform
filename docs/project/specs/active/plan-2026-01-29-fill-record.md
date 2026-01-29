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
/**
 * Per-tool statistics with timing percentiles.
 * Enables analysis like "web_search p95 is 2.5s" or "fill_form has 98% success rate"
 */
export const ToolStatsSchema = z.object({
  /** Tool name identifier (e.g., "web_search", "fill_form") */
  toolName: z.string(),

  /** Number of times this tool was called */
  callCount: z.number().int().nonnegative(),
  /** Number of successful calls */
  successCount: z.number().int().nonnegative(),
  /** Number of failed calls */
  failureCount: z.number().int().nonnegative(),
  /** Success rate as percentage (0-100) */
  successRate: z.number().nonnegative(),

  /** For tools that return results (web_search), track result counts */
  results: z.object({
    /** Total results returned across all calls */
    totalResults: z.number().int().nonnegative(),
    /** Average results per call */
    avgResultsPerCall: z.number().nonnegative(),
    /** Calls that returned zero results */
    zeroResultCalls: z.number().int().nonnegative(),
  }).optional(),

  /** Timing statistics (all values in milliseconds) */
  timing: z.object({
    /** Total time spent in this tool */
    totalMs: z.number().int().nonnegative(),
    /** Average call duration */
    avgMs: z.number().nonnegative(),
    /** Minimum call duration */
    minMs: z.number().int().nonnegative(),
    /** Maximum call duration */
    maxMs: z.number().int().nonnegative(),
    /** 50th percentile (median) */
    p50Ms: z.number().int().nonnegative(),
    /** 95th percentile - useful for identifying slow outliers */
    p95Ms: z.number().int().nonnegative(),
  }),
});

export type ToolStats = z.infer<typeof ToolStatsSchema>;

// Core record returned from fillForm
export const FillRecordSchema = z.object({
  // Session identity
  sessionId: z.string().uuid(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),

  // Form metadata - identifies and describes the form that was filled
  form: z.object({
    /** Form ID from the form schema (e.g., "customer-intake") */
    id: z.string(),
    /** Form title if specified */
    title: z.string().optional(),
    /** Form description if specified */
    description: z.string().optional(),
    /** Structure summary - reuses existing StructureSummary from coreTypes.ts */
    structure: StructureSummarySchema,
    // StructureSummary includes:
    //   groupCount, fieldCount, optionCount, columnCount
    //   fieldCountByKind (e.g., { text: 5, checkbox: 3, select: 2 })
    //   groupsById, fieldsById, optionsById
  }),

  // Outcome
  status: z.enum(['completed', 'partial', 'failed', 'cancelled']),
  statusDetail: z.string().optional(),

  // Form progress at completion - reuses existing ProgressCounts from coreTypes.ts
  // This ensures alignment with inspect/apply results and frontmatter
  formProgress: ProgressCountsSchema,
  // ProgressCounts includes:
  //   totalFields, requiredFields
  //   AnswerState: unansweredFields, answeredFields, skippedFields, abortedFields
  //   Validity: validFields, invalidFields
  //   Value presence: emptyFields, filledFields
  //   totalNotes

  // LLM usage totals (tokens only - clients can calculate costs from these)
  llm: z.object({
    provider: z.string(),
    model: z.string(),
    totalCalls: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  }),

  // Tool usage summary (aggregated stats for quick analysis)
  // Individual tool calls are in timeline[].toolCalls
  toolSummary: z.object({
    /** Total tool calls across all turns */
    totalCalls: z.number().int().nonnegative(),
    /** Successful tool calls */
    successfulCalls: z.number().int().nonnegative(),
    /** Failed tool calls */
    failedCalls: z.number().int().nonnegative(),
    /** Success rate as percentage (0-100) */
    successRate: z.number().nonnegative(),
    /** Total time spent in tool execution (ms) */
    totalDurationMs: z.number().int().nonnegative(),

    /** Per-tool statistics */
    byTool: z.array(ToolStatsSchema),
  }),

  // Timing breakdown showing where time was spent
  timingBreakdown: z.object({
    /** Total wall-clock time for the fill (ms) */
    totalMs: z.number().int().nonnegative(),
    /** Time spent in LLM API calls (ms) */
    llmTimeMs: z.number().int().nonnegative(),
    /** Time spent executing tools (ms) */
    toolTimeMs: z.number().int().nonnegative(),
    /** Overhead time (total - llm - tools) */
    overheadMs: z.number().int().nonnegative(),
    /** Percentage breakdown for visualization */
    breakdown: z.array(z.object({
      category: z.enum(['llm', 'tools', 'overhead']),
      label: z.string(),
      ms: z.number().int().nonnegative(),
      percentage: z.number().nonnegative(), // 0-100
    })),
  }),

  // Turn-by-turn timeline (no size limits - full history always captured)
  // Same structure for serial and parallel execution
  timeline: z.array(z.object({
    turnNumber: z.number().int().positive(),

    // Order level this turn belongs to (0, 1, 2, etc.)
    // Order levels execute sequentially; within each level, items may run in parallel
    // For serial execution, all turns are order=0
    order: z.number().int().nonnegative(),

    // Execution thread identifier - uniquely identifies the execution context
    // Pattern: "{order}-{context}" where context is:
    //   - "serial" for loose serial items (run by primary agent)
    //   - "batch-{batchId}-{itemIndex}" for parallel batch items
    // Examples:
    //   - "0-serial" (order 0, serial execution)
    //   - "1-batch-contact-0" (order 1, batch "contact", item 0)
    //   - "1-batch-contact-1" (order 1, batch "contact", item 1 - runs in parallel with above)
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
      // Tool input parameters (what was sent to the tool)
      // For web_search: { query: string }
      // For fill_form: { patches: Patch[] } (or patch count)
      input: z.record(z.string(), z.unknown()),
      // Result summary (not full output, just key metrics)
      result: z.object({
        // Number of results returned (e.g., web search results, patches applied)
        resultCount: z.number().int().nonnegative().optional(),
        // Error message if success=false
        error: z.string().optional(),
      }).optional(),
    })),
  })),

  // Execution metadata
  execution: z.object({
    totalTurns: z.number().int().nonnegative(),
    parallelEnabled: z.boolean(),
    maxParallelAgents: z.number().int().positive().optional(),
    // Order levels processed (e.g., [0, 1, 2])
    orderLevels: z.array(z.number().int().nonnegative()),
    // Unique execution threads seen (derived from timeline executionIds)
    executionThreads: z.array(z.string()),
  }),

  // Client-defined custom data
  customData: z.record(z.string(), z.unknown()).optional(),
});

export type FillRecord = z.infer<typeof FillRecordSchema>;
```

### Tool Call Examples

**Web search tool call:**
```json
{
  "tool": "web_search",
  "startedAt": "2026-01-29T10:30:15.123Z",
  "completedAt": "2026-01-29T10:30:16.456Z",
  "durationMs": 1333,
  "success": true,
  "input": { "query": "current CEO of Acme Corp 2026" },
  "result": { "resultCount": 8 }
}
```

**Web search with no results:**
```json
{
  "tool": "web_search",
  "startedAt": "2026-01-29T10:30:17.000Z",
  "completedAt": "2026-01-29T10:30:18.200Z",
  "durationMs": 1200,
  "success": true,
  "input": { "query": "xyzzy corporation founding date" },
  "result": { "resultCount": 0 }
}
```

**fill_form tool call:**
```json
{
  "tool": "fill_form",
  "startedAt": "2026-01-29T10:30:20.000Z",
  "completedAt": "2026-01-29T10:30:20.050Z",
  "durationMs": 50,
  "success": true,
  "input": { "patchCount": 3 },
  "result": { "resultCount": 3 }
}
```

**Tool call with error:**
```json
{
  "tool": "web_search",
  "startedAt": "2026-01-29T10:30:25.000Z",
  "completedAt": "2026-01-29T10:30:26.500Z",
  "durationMs": 1500,
  "success": false,
  "input": { "query": "some query" },
  "result": { "error": "Rate limit exceeded" }
}
```

This data enables analysis like:
- "What % of web searches returned 0 results?"
- "Which queries took longest?"
- "How many tool errors occurred?"

### Aggregated Tool Stats Example

The `toolSummary.byTool` array provides per-tool rollups:

```json
{
  "toolSummary": {
    "totalCalls": 15,
    "successfulCalls": 14,
    "failedCalls": 1,
    "successRate": 93.3,
    "totalDurationMs": 18500,
    "byTool": [
      {
        "toolName": "web_search",
        "callCount": 8,
        "successCount": 7,
        "failureCount": 1,
        "successRate": 87.5,
        "results": {
          "totalResults": 42,
          "avgResultsPerCall": 6.0,
          "zeroResultCalls": 2
        },
        "timing": {
          "totalMs": 12000,
          "avgMs": 1500,
          "minMs": 800,
          "maxMs": 3200,
          "p50Ms": 1200,
          "p95Ms": 2800
        }
      },
      {
        "toolName": "fill_form",
        "callCount": 7,
        "successCount": 7,
        "failureCount": 0,
        "successRate": 100,
        "timing": {
          "totalMs": 350,
          "avgMs": 50,
          "minMs": 30,
          "maxMs": 80,
          "p50Ms": 45,
          "p95Ms": 75
        }
      }
    ]
  },
  "timingBreakdown": {
    "totalMs": 45000,
    "llmTimeMs": 25000,
    "toolTimeMs": 18500,
    "overheadMs": 1500,
    "breakdown": [
      { "category": "llm", "label": "LLM API calls", "ms": 25000, "percentage": 55.6 },
      { "category": "tools", "label": "Tool execution", "ms": 18500, "percentage": 41.1 },
      { "category": "overhead", "label": "Overhead", "ms": 1500, "percentage": 3.3 }
    ]
  }
}
```

This enables quick insights:
- "web_search p95 is 2.8s - might need to optimize slow queries"
- "25% of web searches returned 0 results"
- "55% of time spent in LLM calls, 41% in tools"

### Timeline Execution Order Example

The timeline captures the execution order with `order` and `executionId` fields:

```json
{
  "timeline": [
    // Order 0: Serial execution (header fields)
    {
      "turnNumber": 1,
      "order": 0,
      "executionId": "0-serial",
      "startedAt": "2026-01-29T10:30:00.000Z",
      "completedAt": "2026-01-29T10:30:05.000Z",
      "durationMs": 5000
    },

    // Order 1: Parallel batch execution (contact info)
    // Note: turns 2 and 3 have overlapping timestamps - they ran in parallel
    {
      "turnNumber": 2,
      "order": 1,
      "executionId": "1-batch-contacts-0",
      "startedAt": "2026-01-29T10:30:05.100Z",
      "completedAt": "2026-01-29T10:30:08.500Z",
      "durationMs": 3400
    },
    {
      "turnNumber": 3,
      "order": 1,
      "executionId": "1-batch-contacts-1",
      "startedAt": "2026-01-29T10:30:05.100Z",
      "completedAt": "2026-01-29T10:30:09.200Z",
      "durationMs": 4100
    },

    // Order 2: Back to serial (summary fields)
    {
      "turnNumber": 4,
      "order": 2,
      "executionId": "2-serial",
      "startedAt": "2026-01-29T10:30:09.300Z",
      "completedAt": "2026-01-29T10:30:12.000Z",
      "durationMs": 2700
    }
  ],
  "execution": {
    "totalTurns": 4,
    "parallelEnabled": true,
    "maxParallelAgents": 4,
    "orderLevels": [0, 1, 2],
    "executionThreads": ["0-serial", "1-batch-contacts-0", "1-batch-contacts-1", "2-serial"]
  }
}
```

**Identifying parallel execution:**
- Turns with the same `order` value and overlapping `startedAt`/`completedAt` ran in parallel
- The `executionId` pattern shows the batch context: `"{order}-batch-{batchId}-{itemIndex}"`
- Serial turns use `"{order}-serial"`

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

**TypeScript API:**

The `recordFill` option enables fill record collection. When enabled, the complete
`FillRecord` is returned in `FillResult.record`.

```typescript
import { fillForm } from 'markform';

const result = await fillForm({
  form: markdown,
  model: 'anthropic/claude-sonnet-4-5',
  enableWebSearch: true,
  recordFill: true, // Defaults to false
  captureWireFormat: false,
});

// FillRecord is available when recordFill: true
if (result.record) {
  console.log(result.record.llm.inputTokens);
  console.log(result.record.timeline.length);
}
```

**FillResult type extension:**

```typescript
export interface FillResult {
  // ... existing fields ...

  /**
   * Complete fill record when recordFill: true.
   * Contains timeline, token usage, tool calls, and execution metadata.
   */
  record?: FillRecord;
}
```

**Alternative: Explicit collector for advanced use**

For clients who need to process events in real-time or customize collection:

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

### CLI Integration

The CLI provides a `--record-fill` flag that writes a sidecar file alongside the output.

```bash
# Fill a form and write the fill record
markform fill input.form.md -o output.form.md --record-fill

# Output files:
#   output.form.md      # The filled form
#   output.fill.json    # The FillRecord (JSON)
```

**CLI naming convention:**

The fill record file is derived from the output form path:
- Output: `path/to/some-name.form.md` → Record: `path/to/some-name.fill.json`
- Output: `path/to/document.md` → Record: `path/to/document.fill.json`

The pattern is: replace the file extension with `.fill.json`.

**CLI defaults:**

| Flag | Default | Description |
|------|---------|-------------|
| `--record-fill` | `true`* | Write fill record alongside output |

*Note: Default changes from `false` to `true` in Phase 5. Use `--no-record-fill` to disable.

**Note:** This sidecar file convention is a CLI-only behavior. The TypeScript API returns
the `FillRecord` in `result.record` — it's up to the caller to decide how to persist it.

### Why Sidecar Files (CLI)

The CLI uses sidecar files rather than embedding in YAML frontmatter because:
- Keeps form content clean and readable
- Record can be large (especially timeline with many turns)
- Easy to include/exclude from version control (`.gitignore *.fill.json`)
- Standard JSON is more portable than embedded YAML
- Separation of concerns: form content vs. execution metadata

## Implementation Plan

### Phase 1: Core Schema & Collector

- [ ] Define `FillRecordSchema` and related types in new file
      `packages/markform/src/harness/fillRecord.ts`
- [ ] Implement `FillRecordCollector` class (thread-safe, append-only)
- [ ] Add `onWebSearch` callback to `FillCallbacks` interface
- [ ] Export from package entry point
- [ ] Unit tests for collector

### Phase 2: TypeScript API Integration

- [ ] Add `recordFill` option to `FillOptions` (defaults to `false`)
- [ ] Add `record?: FillRecord` to `FillResult`
- [ ] Wire up `FillRecordCollector` internally when `recordFill: true`
- [ ] Wire up web search query capture in liveAgent for Anthropic provider
- [ ] Integration tests with real fills

### Phase 3: CLI Integration

- [ ] Add `--record-fill` flag to `fill` command (defaults to `false`)
- [ ] Implement sidecar file naming: `{basename}.fill.json`
- [ ] Write JSON fill record when flag is set
- [ ] CLI tests for record file generation

### Phase 4: Documentation & Examples

- [ ] Document `recordFill` option in TypeScript API docs
- [ ] Document `--record-fill` flag in CLI help and docs
- [ ] Add example showing programmatic record access
- [ ] Add example showing CLI sidecar file usage

### Phase 5: Text Summary Formatting & CLI Default

The final phase enables users to easily see what happened during a fill operation:

- [ ] Implement `formatFillRecordSummary(record: FillRecord): string` function
- [ ] CLI enables `recordFill` by default (change from `false` to `true`)
- [ ] CLI prints summary to stderr at end of fill (can be silenced with `--quiet`)
- [ ] Export formatting function for TypeScript clients
- [ ] Add summary formatting to Golden tests in TryScript

**Summary format design:**

The summary should be concise but informative, showing key metrics at a glance:

```
Fill completed in 12.4s (5 turns)

Tokens:  2,450 input / 890 output (anthropic/claude-sonnet-4-5)
Tools:   12 calls (11 succeeded, 1 failed)
         - web_search: 5 calls, avg 1.2s, p95 2.1s
         - fill_form: 7 calls, avg 45ms

Timing:  55% LLM (6.8s) | 41% tools (5.1s) | 4% overhead (0.5s)

Progress: 18/20 fields filled (90%)
```

**TypeScript API:**

```typescript
import { formatFillRecordSummary } from 'markform';

const result = await fillForm({ form, model, recordFill: true });
if (result.record) {
  console.log(formatFillRecordSummary(result.record));
}
```

**CLI behavior:**

By default, the CLI will:
1. Enable `recordFill` automatically
2. Print the summary to stderr after the fill completes
3. Write the sidecar `.fill.json` file

To suppress output:
- `--quiet` or `-q`: Suppress summary output (still writes sidecar file)
- `--no-record-fill`: Disable recording entirely (no sidecar, no summary)

**Golden test integration:**

For TryScript golden tests, the formatted summary provides a stable, human-readable
view of execution that can be included in test fixtures. This helps validate:
- Expected turn counts
- Tool call patterns
- Performance characteristics

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: MAINTAIN — all additions are optional
- **TypeScript API**: MAINTAIN — new `recordFill` option defaults to `false`
- **CLI**: MAINTAIN — new `--record-fill` flag defaults to `false`
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
