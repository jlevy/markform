/**
 * FillRecordCollector - Thread-safe, append-only collector for fill records.
 *
 * Implements FillCallbacks to capture all events during a form fill operation
 * and assembles them into a FillRecord at the end.
 *
 * @see docs/project/specs/active/plan-2026-01-29-fill-record.md
 */

import type { ProgressCounts, StructureSummary } from '../engine/coreTypes.js';
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

type CollectorEvent =
  | TurnStartEvent
  | TurnCompleteEvent
  | LlmCallStartEvent
  | LlmCallEndEvent
  | ToolStartEvent
  | ToolEndEvent;

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
 * Thread-safe collector for FillRecord data.
 *
 * Uses an append-only event log pattern for thread safety.
 * Events are aggregated when getRecord() is called.
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

  // Append-only event log (thread-safe via JS single-threaded event loop)
  private events: CollectorEvent[] = [];

  // Explicit status override
  private explicitStatus?: FillRecordStatus;
  private explicitStatusDetail?: string;

  // Track pending tool calls by name (for matching start/end)
  private pendingToolCalls = new Map<string, ToolStartEvent>();

  // Track pending LLM calls by executionId
  private pendingLlmCalls = new Map<string, LlmCallStartEvent>();

  constructor(options: FillRecordCollectorOptions) {
    this.startedAt = new Date().toISOString();
    this.sessionId = crypto.randomUUID();
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
      timestamp: new Date().toISOString(),
      turnNumber: turn.turnNumber,
      issuesCount: turn.issuesCount,
      order: turn.order,
      executionId: turn.executionId,
    });
  }

  onTurnComplete(progress: TurnProgress): void {
    this.events.push({
      type: 'turn_complete',
      timestamp: new Date().toISOString(),
      turnNumber: progress.turnNumber,
      patchesApplied: progress.patchesApplied,
      patchesRejected: progress.rejectedPatches?.length ?? 0,
      issuesAddressed: progress.issuesShown,
    });
  }

  onLlmCallStart(call: { model: string; executionId: string }): void {
    const event: LlmCallStartEvent = {
      type: 'llm_call_start',
      timestamp: new Date().toISOString(),
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
      timestamp: new Date().toISOString(),
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
      timestamp: new Date().toISOString(),
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
      timestamp: new Date().toISOString(),
      name: call.name,
      output: call.output,
      durationMs: call.durationMs,
      error: call.error,
      executionId: call.executionId,
    });
    const key = `${call.executionId}:${call.name}`;
    this.pendingToolCalls.delete(key);
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
    const completedAt = new Date().toISOString();
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
    const turns = new Map<number, TimelineEntry>();
    const turnStartEvents = new Map<number, TurnStartEvent>();
    const turnToolCalls = new Map<number, ToolCallRecord[]>();
    const turnTokens = new Map<number, { input: number; output: number }>();

    // First pass: collect turn start events and tool calls
    for (const event of this.events) {
      if (event.type === 'turn_start') {
        turnStartEvents.set(event.turnNumber, event);
        turnToolCalls.set(event.turnNumber, []);
        turnTokens.set(event.turnNumber, { input: 0, output: 0 });
      }
    }

    // Track active tool calls per turn
    const activeToolsByTurn = new Map<
      number,
      Map<string, { start: ToolStartEvent; turnNumber: number }>
    >();
    let currentTurnNumber = 0;

    // Second pass: match tool start/end events and LLM tokens
    for (const event of this.events) {
      if (event.type === 'turn_start') {
        currentTurnNumber = event.turnNumber;
        activeToolsByTurn.set(currentTurnNumber, new Map());
      } else if (event.type === 'tool_start') {
        const activeTurn =
          this.findTurnForExecutionId(event.executionId, turnStartEvents) ?? currentTurnNumber;
        const activeTools = activeToolsByTurn.get(activeTurn);
        if (activeTools) {
          const key = `${event.executionId}:${event.name}`;
          activeTools.set(key, { start: event, turnNumber: activeTurn });
        }
      } else if (event.type === 'tool_end') {
        const key = `${event.executionId}:${event.name}`;
        // Find which turn this tool call belongs to
        let foundTurn: number | undefined;
        for (const [turnNum, activeTools] of activeToolsByTurn) {
          if (activeTools.has(key)) {
            foundTurn = turnNum;
            break;
          }
        }

        if (foundTurn !== undefined) {
          const activeTools = activeToolsByTurn.get(foundTurn)!;
          const startInfo = activeTools.get(key);
          if (startInfo) {
            const toolCall: ToolCallRecord = {
              tool: event.name,
              startedAt: startInfo.start.timestamp,
              completedAt: event.timestamp,
              durationMs: event.durationMs,
              success: !event.error,
              input: this.normalizeInput(startInfo.start.input),
              result: event.error ? { error: event.error } : this.extractResultCount(event.output),
            };
            turnToolCalls.get(foundTurn)?.push(toolCall);
            activeTools.delete(key);
          }
        }
      } else if (event.type === 'llm_call_end') {
        const turnNum =
          this.findTurnForExecutionId(event.executionId, turnStartEvents) ?? currentTurnNumber;
        const tokens = turnTokens.get(turnNum);
        if (tokens) {
          tokens.input += event.inputTokens;
          tokens.output += event.outputTokens;
        }
      }
    }

    // Third pass: build timeline entries from turn complete events
    for (const event of this.events) {
      if (event.type === 'turn_complete') {
        const startEvent = turnStartEvents.get(event.turnNumber);
        if (startEvent) {
          const tokens = turnTokens.get(event.turnNumber) ?? { input: 0, output: 0 };
          const toolCalls = turnToolCalls.get(event.turnNumber) ?? [];

          const entry: TimelineEntry = {
            turnNumber: event.turnNumber,
            order: startEvent.order,
            executionId: startEvent.executionId,
            startedAt: startEvent.timestamp,
            completedAt: event.timestamp,
            durationMs:
              new Date(event.timestamp).getTime() - new Date(startEvent.timestamp).getTime(),
            issuesAddressed: event.issuesAddressed,
            patchesApplied: event.patchesApplied,
            patchesRejected: event.patchesRejected,
            tokens,
            toolCalls,
          };
          turns.set(event.turnNumber, entry);
        }
      }
    }

    // Sort by turn number
    return Array.from(turns.values()).sort((a, b) => a.turnNumber - b.turnNumber);
  }

  private findTurnForExecutionId(
    executionId: string,
    turnStartEvents: Map<number, TurnStartEvent>,
  ): number | undefined {
    for (const [turnNumber, event] of turnStartEvents) {
      if (event.executionId === executionId) {
        return turnNumber;
      }
    }
    return undefined;
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
