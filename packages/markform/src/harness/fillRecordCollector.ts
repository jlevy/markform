/**
 * FillRecordCollector - Append-only collector for fill records.
 *
 * Implements FillCallbacks to capture all events during a form fill operation
 * and assembles them into a FillRecord at the end.
 *
 * Concurrency model: Uses an append-only event log pattern that safely handles
 * interleaved async operations. JavaScript's single-threaded event loop ensures
 * that synchronous array pushes are atomic, so concurrent async callbacks can
 * safely append events without data races.
 *
 * @see docs/project/specs/active/plan-2026-01-29-fill-record.md
 */

import type { PatchWarning, ProgressCounts, StructureSummary } from '../engine/coreTypes.js';
import type { FillCallbacks, TurnProgress } from './harnessTypes.js';
import type {
  FillRecord,
  FillRecordStatus,
  TimelineEntry,
  ToolCallRecord,
  ToolStats,
  ToolSummary,
  TimingBreakdown,
  TimingBreakdownItem,
  ExecutionMetadata,
} from './fillRecord.js';
import { currentTime, generateSessionId } from './timeUtils.js';

// =============================================================================
// Internal Event Types
// =============================================================================

interface TurnStartEvent {
  type: 'turn_start';
  timestamp: string;
  turnNumber: number;
  issuesCount: number;
  order: number;
  executionId: string;
}

interface TurnCompleteEvent {
  type: 'turn_complete';
  timestamp: string;
  turnNumber: number;
  patchesApplied: number;
  patchesRejected: number;
  issuesAddressed: number;
  coercionWarnings?: PatchWarning[];
  executionId?: string;
}

interface LlmCallStartEvent {
  type: 'llm_call_start';
  timestamp: string;
  model: string;
  executionId: string;
}

interface LlmCallEndEvent {
  type: 'llm_call_end';
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  executionId: string;
}

interface ToolStartEvent {
  type: 'tool_start';
  timestamp: string;
  name: string;
  input: unknown;
  executionId: string;
}

interface ToolEndEvent {
  type: 'tool_end';
  timestamp: string;
  name: string;
  output: unknown;
  durationMs: number;
  error?: string;
  executionId: string;
}

interface WebSearchEvent {
  type: 'web_search';
  timestamp: string;
  query: string;
  resultCount: number;
  provider: string;
  executionId: string;
}

type CollectorEvent =
  | TurnStartEvent
  | TurnCompleteEvent
  | LlmCallStartEvent
  | LlmCallEndEvent
  | ToolStartEvent
  | ToolEndEvent
  | WebSearchEvent;

// =============================================================================
// Options Interface
// =============================================================================

export interface FillRecordCollectorOptions {
  /** Form metadata */
  form: {
    id: string;
    title?: string;
    description?: string;
    structure: StructureSummary;
  };
  /** LLM provider name */
  provider: string;
  /** Model identifier */
  model: string;
  /** Whether parallel execution is enabled */
  parallelEnabled?: boolean;
  /** Maximum parallel agents */
  maxParallelAgents?: number;
  /** Custom data to include in record */
  customData?: Record<string, unknown>;
}

// =============================================================================
// FillRecordCollector Implementation
// =============================================================================

/**
 * Collector for FillRecord data from async form fill operations.
 *
 * Uses an append-only event log pattern that safely handles interleaved
 * async callbacks from parallel execution. Events are aggregated when
 * getRecord() is called.
 */
export class FillRecordCollector implements FillCallbacks {
  private readonly startedAt: string;
  private readonly sessionId: string;
  private readonly form: FillRecordCollectorOptions['form'];
  private readonly provider: string;
  private readonly model: string;
  private readonly parallelEnabled: boolean;
  private readonly maxParallelAgents?: number;
  private customData: Record<string, unknown>;

  // Append-only event log - safe for interleaved async operations
  private events: CollectorEvent[] = [];

  // Explicit status override
  private explicitStatus?: FillRecordStatus;
  private explicitStatusDetail?: string;

  // Track pending tool calls by name (for matching start/end)
  private pendingToolCalls = new Map<string, ToolStartEvent>();

  // Track pending LLM calls by executionId
  private pendingLlmCalls = new Map<string, LlmCallStartEvent>();

  constructor(options: FillRecordCollectorOptions) {
    this.startedAt = currentTime();
    this.sessionId = generateSessionId();
    this.form = options.form;
    this.provider = options.provider;
    this.model = options.model;
    this.parallelEnabled = options.parallelEnabled ?? false;
    this.maxParallelAgents = options.maxParallelAgents;
    this.customData = options.customData ?? {};
  }

  // ===========================================================================
  // FillCallbacks Implementation
  // ===========================================================================

  onTurnStart(turn: {
    turnNumber: number;
    issuesCount: number;
    order: number;
    executionId: string;
  }): void {
    this.events.push({
      type: 'turn_start',
      timestamp: currentTime(),
      turnNumber: turn.turnNumber,
      issuesCount: turn.issuesCount,
      order: turn.order,
      executionId: turn.executionId,
    });
  }

  onTurnComplete(progress: TurnProgress): void {
    const warnings = progress.coercionWarnings;
    this.events.push({
      type: 'turn_complete',
      timestamp: currentTime(),
      turnNumber: progress.turnNumber,
      patchesApplied: progress.patchesApplied,
      patchesRejected: progress.rejectedPatches?.length ?? 0,
      issuesAddressed: progress.issuesShown,
      ...(warnings && warnings.length > 0 && { coercionWarnings: warnings }),
      executionId: progress.executionId,
    });
  }

  onLlmCallStart(call: { model: string; executionId: string }): void {
    const event: LlmCallStartEvent = {
      type: 'llm_call_start',
      timestamp: currentTime(),
      model: call.model,
      executionId: call.executionId,
    };
    this.events.push(event);
    this.pendingLlmCalls.set(call.executionId, event);
  }

  onLlmCallEnd(call: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    executionId: string;
  }): void {
    this.events.push({
      type: 'llm_call_end',
      timestamp: currentTime(),
      model: call.model,
      inputTokens: call.inputTokens,
      outputTokens: call.outputTokens,
      executionId: call.executionId,
    });
    this.pendingLlmCalls.delete(call.executionId);
  }

  onToolStart(call: { name: string; input: unknown; executionId: string }): void {
    const event: ToolStartEvent = {
      type: 'tool_start',
      timestamp: currentTime(),
      name: call.name,
      input: call.input,
      executionId: call.executionId,
    };
    this.events.push(event);
    // Use composite key for parallel tool calls
    const key = `${call.executionId}:${call.name}`;
    this.pendingToolCalls.set(key, event);
  }

  onToolEnd(call: {
    name: string;
    output: unknown;
    durationMs: number;
    error?: string;
    executionId: string;
  }): void {
    this.events.push({
      type: 'tool_end',
      timestamp: currentTime(),
      name: call.name,
      output: call.output,
      durationMs: call.durationMs,
      error: call.error,
      executionId: call.executionId,
    });
    const key = `${call.executionId}:${call.name}`;
    this.pendingToolCalls.delete(key);
  }

  onWebSearch(info: {
    query: string;
    resultCount: number;
    provider: string;
    executionId: string;
  }): void {
    this.events.push({
      type: 'web_search',
      timestamp: currentTime(),
      query: info.query,
      resultCount: info.resultCount,
      provider: info.provider,
      executionId: info.executionId,
    });
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Add custom data during execution.
   */
  addCustomData(key: string, value: unknown): void {
    this.customData[key] = value;
  }

  /**
   * Set explicit status (overrides auto-detection from progress).
   */
  setStatus(status: FillRecordStatus, detail?: string): void {
    this.explicitStatus = status;
    this.explicitStatusDetail = detail;
  }

  /**
   * Assemble the complete FillRecord from collected events.
   */
  getRecord(formProgress: ProgressCounts): FillRecord {
    const completedAt = currentTime();
    const durationMs = new Date(completedAt).getTime() - new Date(this.startedAt).getTime();

    // Build timeline from events
    const timeline = this.buildTimeline();

    // Calculate LLM totals
    const llmTotals = this.calculateLlmTotals();

    // Calculate tool summary
    const toolSummary = this.calculateToolSummary();

    // Calculate timing breakdown
    const timingBreakdown = this.calculateTimingBreakdown(
      durationMs,
      llmTotals.llmTimeMs,
      toolSummary.totalDurationMs,
    );

    // Build execution metadata
    const execution = this.buildExecutionMetadata(timeline);

    // Determine status
    const status = this.determineStatus(formProgress);

    return {
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      completedAt,
      durationMs,
      form: this.form,
      status,
      statusDetail: this.explicitStatusDetail,
      formProgress,
      llm: {
        provider: this.provider,
        model: this.model,
        totalCalls: llmTotals.totalCalls,
        inputTokens: llmTotals.inputTokens,
        outputTokens: llmTotals.outputTokens,
      },
      toolSummary,
      timingBreakdown,
      timeline,
      execution,
      customData: Object.keys(this.customData).length > 0 ? this.customData : undefined,
    };
  }

  // ===========================================================================
  // Private Aggregation Methods
  // ===========================================================================

  private buildTimeline(): TimelineEntry[] {
    // Use composite key (executionId:turnNumber) to properly track parallel turns
    const turnKey = (execId: string, turnNum: number) => `${execId}:${turnNum}`;

    // Fill start time for calculating relative offsets
    const fillStartMs = new Date(this.startedAt).getTime();

    const turns = new Map<string, TimelineEntry>();
    const turnStartEvents = new Map<string, TurnStartEvent>();
    const turnToolCalls = new Map<string, ToolCallRecord[]>();
    const turnTokens = new Map<string, { input: number; output: number }>();

    // First pass: collect turn start events and tool calls
    for (const event of this.events) {
      if (event.type === 'turn_start') {
        const key = turnKey(event.executionId, event.turnNumber);
        turnStartEvents.set(key, event);
        turnToolCalls.set(key, []);
        turnTokens.set(key, { input: 0, output: 0 });
      }
    }

    // Track active tool calls per turn (keyed by composite key)
    const activeToolsByTurn = new Map<
      string,
      Map<string, { start: ToolStartEvent; turnKey: string }>
    >();
    // Track current turn key for each executionId (for proper sequential turn tracking)
    const currentTurnKeyByExecutionId = new Map<string, string>();

    // Second pass: match tool start/end events and LLM tokens
    for (const event of this.events) {
      if (event.type === 'turn_start') {
        const key = turnKey(event.executionId, event.turnNumber);
        currentTurnKeyByExecutionId.set(event.executionId, key);
        activeToolsByTurn.set(key, new Map());
      } else if (event.type === 'tool_start') {
        // Use the current turn for this executionId (not the most recent globally)
        const activeTurnKey = currentTurnKeyByExecutionId.get(event.executionId);
        if (activeTurnKey) {
          const activeTools = activeToolsByTurn.get(activeTurnKey);
          if (activeTools) {
            const toolKey = `${event.executionId}:${event.name}`;
            activeTools.set(toolKey, { start: event, turnKey: activeTurnKey });
          }
        }
      } else if (event.type === 'tool_end') {
        const toolKey = `${event.executionId}:${event.name}`;
        // Find which turn this tool call belongs to
        let foundTurnKey: string | undefined;
        for (const [tk, activeTools] of activeToolsByTurn) {
          if (activeTools.has(toolKey)) {
            foundTurnKey = tk;
            break;
          }
        }

        if (foundTurnKey !== undefined) {
          const activeTools = activeToolsByTurn.get(foundTurnKey)!;
          const startInfo = activeTools.get(toolKey);
          if (startInfo) {
            const toolCall: ToolCallRecord = {
              tool: event.name,
              startedAt: startInfo.start.timestamp,
              completedAt: event.timestamp,
              startMs: new Date(startInfo.start.timestamp).getTime() - fillStartMs,
              durationMs: event.durationMs,
              success: !event.error,
              input: this.normalizeInput(startInfo.start.input),
              result: event.error ? { error: event.error } : this.extractResultCount(event.output),
            };
            turnToolCalls.get(foundTurnKey)?.push(toolCall);
            activeTools.delete(toolKey);
          }
        }
      } else if (event.type === 'llm_call_end') {
        // Use the current turn for this executionId
        const tk = currentTurnKeyByExecutionId.get(event.executionId);
        if (tk) {
          const tokens = turnTokens.get(tk);
          if (tokens) {
            tokens.input += event.inputTokens;
            tokens.output += event.outputTokens;
          }
        }
      }
    }

    // Third pass: build timeline entries from turn complete events
    // Match turn_complete events to their start events by executionId + turnNumber
    const turnCompleteByKey = new Map<string, TurnCompleteEvent>();
    for (const event of this.events) {
      if (event.type === 'turn_complete') {
        // Use executionId if available (parallel execution), otherwise fall back to matching by turnNumber
        if (event.executionId) {
          const key = turnKey(event.executionId, event.turnNumber);
          turnCompleteByKey.set(key, event);
        } else {
          // Legacy fallback: find first unmatched start event with same turnNumber
          for (const [key, startEvent] of turnStartEvents) {
            if (startEvent.turnNumber === event.turnNumber && !turnCompleteByKey.has(key)) {
              turnCompleteByKey.set(key, event);
              break;
            }
          }
        }
      }
    }

    for (const [key, startEvent] of turnStartEvents) {
      const completeEvent = turnCompleteByKey.get(key);
      if (completeEvent) {
        const tokens = turnTokens.get(key) ?? { input: 0, output: 0 };
        const toolCalls = turnToolCalls.get(key) ?? [];

        const turnStartMs = new Date(startEvent.timestamp).getTime();
        const entry: TimelineEntry = {
          turnNumber: startEvent.turnNumber,
          order: startEvent.order,
          executionId: startEvent.executionId,
          startedAt: startEvent.timestamp,
          completedAt: completeEvent.timestamp,
          startMs: turnStartMs - fillStartMs,
          durationMs: new Date(completeEvent.timestamp).getTime() - turnStartMs,
          issuesAddressed: completeEvent.issuesAddressed,
          patchesApplied: completeEvent.patchesApplied,
          patchesRejected: completeEvent.patchesRejected,
          tokens,
          toolCalls,
          ...(completeEvent.coercionWarnings &&
            completeEvent.coercionWarnings.length > 0 && {
              coercionWarnings: completeEvent.coercionWarnings,
            }),
        };
        turns.set(key, entry);
      }
    }

    // Sort by startedAt timestamp (proper chronological order for parallel execution)
    return Array.from(turns.values()).sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );
  }

  private findTurnKeyForExecutionId(
    executionId: string,
    turnStartEvents: Map<string, TurnStartEvent>,
  ): string | undefined {
    // Find the most recent turn for this executionId
    let latestKey: string | undefined;
    let latestTime = '';
    for (const [key, event] of turnStartEvents) {
      if (event.executionId === executionId && event.timestamp > latestTime) {
        latestKey = key;
        latestTime = event.timestamp;
      }
    }
    return latestKey;
  }

  private normalizeInput(input: unknown): Record<string, unknown> {
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      return input as Record<string, unknown>;
    }
    return { value: input };
  }

  private extractResultCount(output: unknown): { resultCount?: number } | undefined {
    if (output && typeof output === 'object') {
      const obj = output as Record<string, unknown>;
      // Check for common patterns
      if (Array.isArray(obj.results)) {
        return { resultCount: obj.results.length };
      }
      if (typeof obj.applied === 'number') {
        return { resultCount: obj.applied };
      }
      if (typeof obj.resultCount === 'number') {
        return { resultCount: obj.resultCount };
      }
    }
    return undefined;
  }

  private calculateLlmTotals(): {
    totalCalls: number;
    inputTokens: number;
    outputTokens: number;
    llmTimeMs: number;
  } {
    let totalCalls = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let llmTimeMs = 0;

    const llmStartTimes = new Map<string, string>();

    for (const event of this.events) {
      if (event.type === 'llm_call_start') {
        llmStartTimes.set(event.executionId, event.timestamp);
      } else if (event.type === 'llm_call_end') {
        totalCalls++;
        inputTokens += event.inputTokens;
        outputTokens += event.outputTokens;

        const startTime = llmStartTimes.get(event.executionId);
        if (startTime) {
          llmTimeMs += new Date(event.timestamp).getTime() - new Date(startTime).getTime();
          llmStartTimes.delete(event.executionId);
        }
      }
    }

    return { totalCalls, inputTokens, outputTokens, llmTimeMs };
  }

  private calculateToolSummary(): ToolSummary {
    const toolCalls = new Map<
      string,
      { durations: number[]; successes: number; failures: number; resultCounts: number[] }
    >();

    let totalCalls = 0;
    let successfulCalls = 0;
    let failedCalls = 0;
    let totalDurationMs = 0;

    for (const event of this.events) {
      if (event.type === 'tool_end') {
        totalCalls++;
        totalDurationMs += event.durationMs;

        if (event.error) {
          failedCalls++;
        } else {
          successfulCalls++;
        }

        let stats = toolCalls.get(event.name);
        if (!stats) {
          stats = { durations: [], successes: 0, failures: 0, resultCounts: [] };
          toolCalls.set(event.name, stats);
        }

        stats.durations.push(event.durationMs);
        if (event.error) {
          stats.failures++;
        } else {
          stats.successes++;
        }

        // Extract result count if available
        const resultCount = this.extractResultCountFromOutput(event.output);
        if (resultCount !== undefined) {
          stats.resultCounts.push(resultCount);
        }
      }
    }

    const byTool: ToolStats[] = [];
    for (const [toolName, stats] of toolCalls) {
      const callCount = stats.durations.length;
      const sortedDurations = [...stats.durations].sort((a, b) => a - b);

      byTool.push({
        toolName,
        callCount,
        successCount: stats.successes,
        failureCount: stats.failures,
        successRate: callCount > 0 ? (stats.successes / callCount) * 100 : 0,
        results:
          stats.resultCounts.length > 0
            ? {
                totalResults: stats.resultCounts.reduce((a, b) => a + b, 0),
                avgResultsPerCall:
                  stats.resultCounts.reduce((a, b) => a + b, 0) / stats.resultCounts.length,
                zeroResultCalls: stats.resultCounts.filter((c) => c === 0).length,
              }
            : undefined,
        timing: {
          totalMs: stats.durations.reduce((a, b) => a + b, 0),
          avgMs: callCount > 0 ? stats.durations.reduce((a, b) => a + b, 0) / callCount : 0,
          minMs: sortedDurations[0] ?? 0,
          maxMs: sortedDurations[sortedDurations.length - 1] ?? 0,
          p50Ms: this.percentile(sortedDurations, 50),
          p95Ms: this.percentile(sortedDurations, 95),
        },
      });
    }

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      successRate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
      totalDurationMs,
      avgDurationMs: totalCalls > 0 ? totalDurationMs / totalCalls : 0,
      byTool,
    };
  }

  private extractResultCountFromOutput(output: unknown): number | undefined {
    if (output && typeof output === 'object') {
      const obj = output as Record<string, unknown>;
      if (Array.isArray(obj.results)) {
        return obj.results.length;
      }
      if (typeof obj.resultCount === 'number') {
        return obj.resultCount;
      }
    }
    return undefined;
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0]!;

    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return Math.round(sorted[lower]!);
    }

    const weight = index - lower;
    return Math.round(sorted[lower]! * (1 - weight) + sorted[upper]! * weight);
  }

  private calculateTimingBreakdown(
    totalMs: number,
    llmTimeMs: number,
    toolTimeMs: number,
  ): TimingBreakdown {
    // Under parallelism, llmTimeMs + toolTimeMs can exceed totalMs (since they're
    // sums of individual durations, not de-overlapped). Clamp overhead to 0 in that case.
    // This means percentage breakdowns may exceed 100% for parallel fills.
    const overheadMs = Math.max(0, totalMs - llmTimeMs - toolTimeMs);

    const breakdown: TimingBreakdownItem[] = [
      {
        category: 'llm',
        label: 'LLM API calls',
        ms: llmTimeMs,
        percentage: totalMs > 0 ? (llmTimeMs / totalMs) * 100 : 0,
      },
      {
        category: 'tools',
        label: 'Tool execution',
        ms: toolTimeMs,
        percentage: totalMs > 0 ? (toolTimeMs / totalMs) * 100 : 0,
      },
      {
        category: 'overhead',
        label: 'Overhead',
        ms: overheadMs,
        percentage: totalMs > 0 ? (overheadMs / totalMs) * 100 : 0,
      },
    ];

    return {
      totalMs,
      llmTimeMs,
      toolTimeMs,
      overheadMs,
      breakdown,
      effectiveParallelism: totalMs > 0 ? (llmTimeMs + toolTimeMs) / totalMs : 0,
    };
  }

  private buildExecutionMetadata(timeline: TimelineEntry[]): ExecutionMetadata {
    const orderLevels = new Set<number>();
    const executionThreads = new Set<string>();

    for (const entry of timeline) {
      orderLevels.add(entry.order);
      executionThreads.add(entry.executionId);
    }

    return {
      totalTurns: timeline.length,
      parallelEnabled: this.parallelEnabled,
      maxParallelAgents: this.parallelEnabled ? this.maxParallelAgents : undefined,
      orderLevels: Array.from(orderLevels).sort((a, b) => a - b),
      executionThreads: Array.from(executionThreads),
    };
  }

  private determineStatus(formProgress: ProgressCounts): FillRecordStatus {
    // Explicit status takes precedence
    if (this.explicitStatus) {
      return this.explicitStatus;
    }

    // Determine from form progress
    const hasUnanswered = formProgress.unansweredFields > 0;
    const allRequiredFilled = formProgress.answeredFields >= formProgress.requiredFields;

    if (!hasUnanswered) {
      return 'completed';
    }

    if (allRequiredFilled) {
      return 'completed';
    }

    return 'partial';
  }
}
