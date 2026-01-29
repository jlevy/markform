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

  // Status line
  const statusText = record.status === 'completed' ? 'Fill completed' : 'Fill incomplete';
  const turnsText = `${record.execution.totalTurns} turn${record.execution.totalTurns !== 1 ? 's' : ''}`;
  let statusLine = `${statusText} in ${formatDuration(record.durationMs)} (${turnsText})`;
  if (record.status !== 'completed' && record.statusDetail) {
    statusLine += ` - ${record.statusDetail}`;
  }
  lines.push(statusLine);
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

  // Timing breakdown (verbose mode)
  if (verbose) {
    lines.push('');
    const { timingBreakdown } = record;
    const llmPct = timingBreakdown.breakdown.find((b) => b.category === 'llm')?.percentage ?? 0;
    const toolPct = timingBreakdown.breakdown.find((b) => b.category === 'tools')?.percentage ?? 0;
    const overheadPct =
      timingBreakdown.breakdown.find((b) => b.category === 'overhead')?.percentage ?? 0;

    const timingLine = `Timing:  ${llmPct}% LLM (${formatDuration(timingBreakdown.llmTimeMs)}) | ${toolPct}% tools (${formatDuration(timingBreakdown.toolTimeMs)}) | ${overheadPct}% overhead (${formatDuration(timingBreakdown.overheadMs)})`;
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
