/**
 * Format FillRecord as a human-readable summary.
 *
 * Produces a concise text summary of a fill operation, suitable for
 * CLI output or logging. Shows key metrics at a glance:
 * - Duration and turns
 * - Token usage
 * - Tool call summary
 * - Timing breakdown (verbose mode)
 * - Form progress
 */

import type { FillRecord } from './fillRecord.js';

/**
 * Options for formatting the summary.
 */
export interface FormatFillRecordSummaryOptions {
  /** Show detailed breakdown including per-tool stats */
  verbose?: boolean;
}

/**
 * Format a number with thousands separators.
 */
function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Format milliseconds as a human-readable duration.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    // Show one decimal place
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

/**
 * Format a rate value (like s/field or s/turn) with appropriate significant figures.
 * >= 10s: 1 decimal (e.g., 12.3s/field)
 * >= 1s: 2 decimals (e.g., 3.45s/field)
 * < 1s: show as ms (e.g., 450ms/field)
 */
function formatRate(ms: number, unit: string): string {
  const seconds = ms / 1000;
  if (seconds >= 10) {
    return `${seconds.toFixed(1)}s/${unit}`;
  }
  if (seconds >= 1) {
    return `${seconds.toFixed(2)}s/${unit}`;
  }
  return `${Math.round(ms)}ms/${unit}`;
}

/**
 * Format a percentage.
 */
function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  const pct = Math.round((value / total) * 100);
  return `${pct}%`;
}

/**
 * Format FillRecord as a human-readable text summary.
 *
 * @param record - The FillRecord to format
 * @param options - Formatting options (verbose mode for more detail)
 * @returns Multi-line text summary
 *
 * @example
 * ```typescript
 * const result = await fillForm({ form, model, recordFill: true });
 * if (result.record) {
 *   console.log(formatFillRecordSummary(result.record));
 * }
 * ```
 */
export function formatFillRecordSummary(
  record: FillRecord,
  options: FormatFillRecordSummaryOptions = {},
): string {
  const { verbose = false } = options;
  const lines: string[] = [];

  // Status line with rates
  const statusText = record.status === 'completed' ? 'Fill completed' : 'Fill incomplete';
  const turnsText = `${record.execution.totalTurns} turn${record.execution.totalTurns !== 1 ? 's' : ''}`;
  const rateParts: string[] = [];
  if (record.execution.totalTurns > 0) {
    rateParts.push(formatRate(record.durationMs / record.execution.totalTurns, 'turn'));
  }
  if (record.formProgress.answeredFields > 0) {
    rateParts.push(formatRate(record.durationMs / record.formProgress.answeredFields, 'field'));
  }
  const ratesText = rateParts.length > 0 ? `, ${rateParts.join(', ')}` : '';
  let statusLine = `${statusText} in ${formatDuration(record.durationMs)} (${turnsText}${ratesText})`;
  if (record.status !== 'completed' && record.statusDetail) {
    statusLine += ` - ${record.statusDetail}`;
  }
  lines.push(statusLine);

  // Warn if timeline is empty but work was done (indicates callback wiring bug)
  // This catches the mf-mgxo bug where CLI was missing onTurnStart/onTurnComplete wiring
  const timelineEmpty = record.timeline.length === 0;
  const hadTurns = record.execution.totalTurns > 0;
  const hadFieldsFilled = record.formProgress.filledFields > 0;
  if (timelineEmpty && (hadTurns || hadFieldsFilled)) {
    lines.push('Warning: timeline is empty but work was recorded (possible callback wiring issue)');
  }

  lines.push('');

  // Token usage
  const tokenLine = `Tokens:  ${formatNumber(record.llm.inputTokens)} input / ${formatNumber(record.llm.outputTokens)} output (${record.llm.provider}/${record.llm.model})`;
  lines.push(tokenLine);

  // Tool summary
  const { toolSummary } = record;
  let toolLine = `Tools:   ${formatNumber(toolSummary.totalCalls)} calls`;
  if (toolSummary.totalCalls > 0) {
    toolLine += ` (${formatNumber(toolSummary.successfulCalls)} succeeded`;
    if (toolSummary.failedCalls > 0) {
      toolLine += `, ${formatNumber(toolSummary.failedCalls)} failed`;
    }
    toolLine += ')';
    toolLine += `, avg ${formatDuration(toolSummary.avgDurationMs)} each`;
  }
  lines.push(toolLine);

  // Per-tool breakdown (verbose mode)
  if (verbose && toolSummary.byTool.length > 0) {
    for (const tool of toolSummary.byTool) {
      const avgDuration = formatDuration(tool.timing.avgMs);
      let toolDetail = `         - ${tool.toolName}: ${tool.callCount} calls, avg ${avgDuration}`;
      if (tool.timing.p95Ms !== undefined && tool.callCount > 1) {
        toolDetail += `, p95 ${formatDuration(tool.timing.p95Ms)}`;
      }
      lines.push(toolDetail);
    }
  }

  // Timing breakdown (always shown)
  const { timingBreakdown } = record;
  const llmPct = Math.round(
    timingBreakdown.breakdown.find((b) => b.category === 'llm')?.percentage ?? 0,
  );
  const toolPct = Math.round(
    timingBreakdown.breakdown.find((b) => b.category === 'tools')?.percentage ?? 0,
  );
  const overheadPct = Math.round(
    timingBreakdown.breakdown.find((b) => b.category === 'overhead')?.percentage ?? 0,
  );

  if (verbose) {
    // Verbose: show percentages with absolute durations
    const timingLine = `Timing:  ${llmPct}% LLM (${formatDuration(timingBreakdown.llmTimeMs)}) | ${toolPct}% tools (${formatDuration(timingBreakdown.toolTimeMs)}) | ${overheadPct}% overhead (${formatDuration(timingBreakdown.overheadMs)})`;
    lines.push(timingLine);

    // Effective parallelism in verbose mode
    const ep = timingBreakdown.effectiveParallelism;
    if (record.execution.parallelEnabled) {
      // Always show for parallel fills
      const threadCount = record.execution.executionThreads.length;
      const orderCount = record.execution.orderLevels.length;
      lines.push(
        `         Effective parallelism: ${ep.toFixed(1)}x (${threadCount} threads, ${orderCount} order level${orderCount !== 1 ? 's' : ''})`,
      );
    } else if (ep < 0.8) {
      // Show for serial fills only when overhead is significant
      lines.push(`         Effective parallelism: ${ep.toFixed(1)}x`);
    }
  } else {
    // Non-verbose: one-line timing split with percentages only
    const timingLine = `Timing:  ${llmPct}% LLM | ${toolPct}% tools | ${overheadPct}% overhead`;
    lines.push(timingLine);
  }

  // Progress
  lines.push('');
  const { formProgress } = record;
  const progressPct = formatPercent(formProgress.answeredFields, formProgress.totalFields);
  const progressLine = `Progress: ${formProgress.answeredFields}/${formProgress.totalFields} fields filled (${progressPct})`;
  lines.push(progressLine);

  return lines.join('\n');
}
