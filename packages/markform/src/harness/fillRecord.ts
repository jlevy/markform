/**
 * FillRecord types - Captures complete records of form fill operations.
 *
 * Provides detailed tracking of:
 * - LLM usage (tokens per turn and totals)
 * - Tool invocations with timing and results
 * - Turn-by-turn timeline with execution context
 * - Form progress and completion status
 *
 * @see docs/project/specs/active/plan-2026-01-29-fill-record.md
 */

import { z } from 'zod';

import { ProgressCountsSchema, StructureSummarySchema } from '../engine/coreTypes.js';

// =============================================================================
// Tool Statistics Schema
// =============================================================================

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
  results: z
    .object({
      /** Total results returned across all calls */
      totalResults: z.number().int().nonnegative(),
      /** Average results per call */
      avgResultsPerCall: z.number().nonnegative(),
      /** Calls that returned zero results */
      zeroResultCalls: z.number().int().nonnegative(),
    })
    .optional(),

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

// =============================================================================
// Tool Call Schema (for timeline)
// =============================================================================

/**
 * Individual tool call in the timeline.
 */
export const ToolCallRecordSchema = z.object({
  /** Tool name */
  tool: z.string(),
  /** When the tool started */
  startedAt: z.string().datetime(),
  /** When the tool completed */
  completedAt: z.string().datetime(),
  /** Start time relative to fill start (milliseconds) */
  startMs: z.number().int().nonnegative(),
  /** Duration in milliseconds */
  durationMs: z.number().int().nonnegative(),
  /** Whether the call succeeded */
  success: z.boolean(),
  /** Tool input parameters (e.g., { query: "..." } for web_search) */
  input: z.record(z.string(), z.unknown()),
  /** Result summary */
  result: z
    .object({
      /** Number of results returned (e.g., web search results, patches applied) */
      resultCount: z.number().int().nonnegative().optional(),
      /** Error message if success=false */
      error: z.string().optional(),
    })
    .optional(),
});

export type ToolCallRecord = z.infer<typeof ToolCallRecordSchema>;

// =============================================================================
// Timeline Entry Schema
// =============================================================================

/**
 * Single turn in the fill timeline.
 */
export const TimelineEntrySchema = z.object({
  /** Turn number (1-based) */
  turnNumber: z.number().int().positive(),

  /** Order level this turn belongs to (0, 1, 2, etc.) */
  order: z.number().int().nonnegative(),

  /**
   * Execution thread identifier.
   * Pattern: "{order}-{context}" where context is:
   *   - "serial" for loose serial items
   *   - "batch-{batchId}-{itemIndex}" for parallel batch items
   */
  executionId: z.string(),

  /** When the turn started */
  startedAt: z.string().datetime(),
  /** When the turn completed */
  completedAt: z.string().datetime(),
  /** Start time relative to fill start (milliseconds) */
  startMs: z.number().int().nonnegative(),
  /** Duration in milliseconds */
  durationMs: z.number().int().nonnegative(),

  /** Number of issues addressed this turn */
  issuesAddressed: z.number().int().nonnegative(),
  /** Number of patches successfully applied */
  patchesApplied: z.number().int().nonnegative(),
  /** Number of patches rejected */
  patchesRejected: z.number().int().nonnegative(),

  /** Per-turn token usage (from AI SDK result.usage) */
  tokens: z.object({
    input: z.number().int().nonnegative(),
    output: z.number().int().nonnegative(),
  }),

  /** Tool calls made during this turn */
  toolCalls: z.array(ToolCallRecordSchema),
});

export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

// =============================================================================
// Timing Breakdown Schema
// =============================================================================

/**
 * Breakdown item for visualization.
 */
export const TimingBreakdownItemSchema = z.object({
  category: z.enum(['llm', 'tools', 'overhead']),
  label: z.string(),
  ms: z.number().int().nonnegative(),
  percentage: z.number().nonnegative(), // 0-100
});

export type TimingBreakdownItem = z.infer<typeof TimingBreakdownItemSchema>;

/**
 * Timing breakdown showing where time was spent.
 */
export const TimingBreakdownSchema = z.object({
  /** Total wall-clock time for the fill (ms) */
  totalMs: z.number().int().nonnegative(),
  /** Time spent in LLM API calls (ms) */
  llmTimeMs: z.number().int().nonnegative(),
  /** Time spent executing tools (ms) */
  toolTimeMs: z.number().int().nonnegative(),
  /** Overhead time (total - llm - tools) */
  overheadMs: z.number().int().nonnegative(),
  /** Percentage breakdown for visualization */
  breakdown: z.array(TimingBreakdownItemSchema),
});

export type TimingBreakdown = z.infer<typeof TimingBreakdownSchema>;

// =============================================================================
// Tool Summary Schema
// =============================================================================

/**
 * Aggregated tool usage statistics.
 */
export const ToolSummarySchema = z.object({
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
});

export type ToolSummary = z.infer<typeof ToolSummarySchema>;

// =============================================================================
// Execution Metadata Schema
// =============================================================================

/**
 * Execution metadata for the fill.
 */
export const ExecutionMetadataSchema = z.object({
  /** Total number of turns executed */
  totalTurns: z.number().int().nonnegative(),
  /** Whether parallel execution was enabled */
  parallelEnabled: z.boolean(),
  /** Maximum parallel agents (if parallel enabled) */
  maxParallelAgents: z.number().int().positive().optional(),
  /** Order levels processed (e.g., [0, 1, 2]) */
  orderLevels: z.array(z.number().int().nonnegative()),
  /** Unique execution threads seen */
  executionThreads: z.array(z.string()),
});

export type ExecutionMetadata = z.infer<typeof ExecutionMetadataSchema>;

// =============================================================================
// Fill Record Schema
// =============================================================================

/**
 * Fill status enum.
 */
export const FillRecordStatusSchema = z.enum(['completed', 'partial', 'failed', 'cancelled']);

export type FillRecordStatus = z.infer<typeof FillRecordStatusSchema>;

/**
 * Complete record of a form fill operation.
 *
 * Captures everything that happened during the fill for:
 * - Provenance/corroboration
 * - Cost analysis
 * - Debugging
 * - Analytics
 */
export const FillRecordSchema = z.object({
  // =========================================================================
  // Session Identity
  // =========================================================================

  /** Unique session identifier */
  sessionId: z.string().uuid(),
  /** When the fill started */
  startedAt: z.string().datetime(),
  /** When the fill completed */
  completedAt: z.string().datetime(),
  /** Total duration in milliseconds */
  durationMs: z.number().int().nonnegative(),

  // =========================================================================
  // Form Metadata
  // =========================================================================

  /** Form identification and structure */
  form: z.object({
    /** Form ID from the form schema */
    id: z.string(),
    /** Form title if specified */
    title: z.string().optional(),
    /** Form description if specified */
    description: z.string().optional(),
    /** Structure summary (field counts, etc.) */
    structure: StructureSummarySchema,
  }),

  // =========================================================================
  // Outcome
  // =========================================================================

  /** Fill status */
  status: FillRecordStatusSchema,
  /** Additional status detail (e.g., error message) */
  statusDetail: z.string().optional(),

  /** Form progress at completion */
  formProgress: ProgressCountsSchema,

  // =========================================================================
  // LLM Usage
  // =========================================================================

  /** LLM usage totals (tokens only - clients calculate costs) */
  llm: z.object({
    /** Provider name (e.g., "anthropic", "openai") */
    provider: z.string(),
    /** Model identifier */
    model: z.string(),
    /** Total LLM calls */
    totalCalls: z.number().int().nonnegative(),
    /** Total input tokens */
    inputTokens: z.number().int().nonnegative(),
    /** Total output tokens */
    outputTokens: z.number().int().nonnegative(),
  }),

  // =========================================================================
  // Tool Usage
  // =========================================================================

  /** Aggregated tool statistics */
  toolSummary: ToolSummarySchema,

  /** Timing breakdown */
  timingBreakdown: TimingBreakdownSchema,

  // =========================================================================
  // Timeline
  // =========================================================================

  /** Turn-by-turn timeline (full history, no size limits) */
  timeline: z.array(TimelineEntrySchema),

  // =========================================================================
  // Execution Metadata
  // =========================================================================

  /** Execution configuration and thread info */
  execution: ExecutionMetadataSchema,

  // =========================================================================
  // Custom Data
  // =========================================================================

  /** Client-defined custom data */
  customData: z.record(z.string(), z.unknown()).optional(),
});

export type FillRecord = z.infer<typeof FillRecordSchema>;

// =============================================================================
// Stable FillRecord (for golden tests)
// =============================================================================

/**
 * Stripped ToolStats without timing information.
 */
export type StableToolStats = Omit<ToolStats, 'timing'>;

/**
 * Stripped ToolSummary without timing information.
 */
export type StableToolSummary = Omit<ToolSummary, 'totalDurationMs' | 'byTool'> & {
  byTool: StableToolStats[];
};

/**
 * FillRecord with unstable fields removed for deterministic golden tests.
 *
 * Removes:
 * - sessionId, startedAt, completedAt, durationMs (top-level timing)
 * - timeline (contains per-turn timestamps and durations)
 * - timingBreakdown (all timing values)
 * - toolSummary.totalDurationMs and toolSummary.byTool[].timing
 */
export type StableFillRecord = Omit<
  FillRecord,
  | 'sessionId'
  | 'startedAt'
  | 'completedAt'
  | 'durationMs'
  | 'timeline'
  | 'timingBreakdown'
  | 'toolSummary'
> & {
  toolSummary: StableToolSummary;
};

/**
 * Strip unstable fields from FillRecord for golden test comparisons.
 *
 * In mock mode, all remaining fields should be deterministic:
 * - status, statusDetail: based on completion logic
 * - form: form metadata (static)
 * - formProgress: counts of filled fields (deterministic from mock source)
 * - llm: provider/model/tokens (tokens are 0 in mock mode)
 * - toolSummary: call counts and success rates (without timing)
 * - execution: turn counts, parallel settings (deterministic)
 */
export function stripUnstableFillRecordFields(record: FillRecord): StableFillRecord {
  // Strip timing from each tool's stats
  const stableByTool: StableToolStats[] = record.toolSummary.byTool.map((toolStats) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { timing, ...rest } = toolStats;
    return rest;
  });

  // Build stable tool summary without timing
  const stableToolSummary: StableToolSummary = {
    totalCalls: record.toolSummary.totalCalls,
    successfulCalls: record.toolSummary.successfulCalls,
    failedCalls: record.toolSummary.failedCalls,
    successRate: record.toolSummary.successRate,
    byTool: stableByTool,
  };

  return {
    // Keep form metadata (stable)
    form: record.form,

    // Keep outcome (stable in mock mode)
    status: record.status,
    statusDetail: record.statusDetail,
    formProgress: record.formProgress,

    // Keep LLM info (tokens are 0 in mock mode)
    llm: record.llm,

    // Use stable tool summary
    toolSummary: stableToolSummary,

    // Keep execution metadata (stable)
    execution: record.execution,

    // Keep custom data if present
    customData: record.customData,
  };
}
