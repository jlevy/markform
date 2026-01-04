/**
 * Fill Logging Callbacks - Create FillCallbacks for unified CLI logging.
 *
 * Provides consistent turn-by-turn logging across all CLI commands that
 * run form-filling (fill, run, examples). API consumers can also use
 * these callbacks or implement their own.
 *
 * Log Levels:
 * - quiet: Only errors
 * - default: Turn info, tool calls with queries/results, patches, completion
 * - verbose: + harness config, full result listings, accept/reject details
 * - debug: + full prompts, raw tool inputs/outputs (truncated)
 *
 * Trace File:
 * - When traceFile is provided, all log output is also appended to the file
 * - Useful for monitoring long-running fills and post-hoc debugging
 */

import { appendFileSync, writeFileSync } from 'node:fs';

import pc from 'picocolors';

import type { FillCallbacks, TurnStats } from '../../harness/harnessTypes.js';
import { DEBUG_OUTPUT_TRUNCATION_LIMIT } from '../../settings.js';
import type { CommandContext, LogLevel } from './cliTypes.js';
import type { SpinnerHandle } from './shared.js';
import { logInfo, logVerbose, logDebug } from './shared.js';
import { formatTurnIssues } from './formatting.js';
import { formatPatchType, formatPatchValue } from './patchFormat.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for creating fill logging callbacks.
 */
export interface FillLoggingOptions {
  /** Spinner handle for updating during LLM/tool calls */
  spinner?: SpinnerHandle;
  /** Model identifier for display */
  modelId?: string;
  /** Provider name for display */
  provider?: string;
  /**
   * Path to trace file for incremental logging.
   * When provided, all log output is also appended to this file (without ANSI colors).
   * The file is created/truncated at start with a timestamp header.
   */
  traceFile?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Strip ANSI escape codes from a string for file output.
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Create a trace function that writes to a file if traceFile is provided.
 * Returns a no-op function if no trace file is configured.
 */
function createTracer(
  traceFile: string | undefined,
  modelId: string | undefined,
): (line: string) => void {
  if (!traceFile) {
    return () => undefined; // No-op
  }

  // Initialize trace file with header
  const timestamp = new Date().toISOString();
  const header = `# Markform Trace Log\n# Started: ${timestamp}\n# Model: ${modelId ?? 'unknown'}\n\n`;
  try {
    writeFileSync(traceFile, header, 'utf-8');
  } catch {
    console.error(`Warning: Could not create trace file: ${traceFile}`);
    return () => undefined;
  }

  // Return function that appends lines
  return (line: string) => {
    try {
      const plainLine = stripAnsi(line);
      appendFileSync(traceFile, plainLine + '\n', 'utf-8');
    } catch {
      // Silently ignore write errors to not disrupt main flow
    }
  };
}

/**
 * Truncate a string to a maximum length with ellipsis indicator.
 */
function truncate(str: string, maxLength: number = DEBUG_OUTPUT_TRUNCATION_LIMIT): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...[truncated]';
}

/**
 * Format duration in milliseconds to human-readable string.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Safely stringify an object for debug output.
 */
function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/**
 * Check if we should show output at this level.
 */
function shouldShow(ctx: CommandContext, minLevel: LogLevel): boolean {
  const levels: LogLevel[] = ['quiet', 'default', 'verbose', 'debug'];
  const currentIndex = levels.indexOf(ctx.logLevel);
  const minIndex = levels.indexOf(minLevel);
  return currentIndex >= minIndex;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create FillCallbacks that produce standard CLI logging output.
 *
 * Log Levels:
 * - quiet: Only errors
 * - default: Turn info, tool calls with queries/results, patches, completion
 * - verbose: + harness config, full result listings, accept/reject details
 * - debug: + full prompts, raw tool inputs/outputs (truncated)
 *
 * This is used by fill, run, and examples commands for consistent output.
 *
 * @param ctx - Command context for log level
 * @param options - Optional spinner and model info
 * @returns FillCallbacks with all logging implemented
 *
 * @example
 * ```typescript
 * const callbacks = createFillLoggingCallbacks(ctx, { spinner, modelId, provider });
 * const result = await fillForm({
 *   form: formMarkdown,
 *   model: 'anthropic/claude-sonnet-4-5',
 *   enableWebSearch: true,
 *   callbacks,
 * });
 * ```
 */
export function createFillLoggingCallbacks(
  ctx: CommandContext,
  options: FillLoggingOptions = {},
): FillCallbacks {
  // Create tracer for file output (no-op if no traceFile provided)
  const trace = createTracer(options.traceFile, options.modelId);

  // Show model info at start if provided (default level)
  if (options.modelId && shouldShow(ctx, 'default')) {
    const providerInfo = options.provider ? ` (provider: ${options.provider})` : '';
    const modelLine = pc.bold(`Model: ${options.modelId}${providerInfo}`);
    logInfo(ctx, modelLine);
    trace(`Model: ${options.modelId}${providerInfo}`);
  }

  return {
    // DEFAULT: Always show turn number and issues
    onIssuesIdentified: ({ turnNumber, issues }) => {
      if (!shouldShow(ctx, 'default')) return;
      const issuesText = formatTurnIssues(issues);
      logInfo(ctx, `${pc.bold(`Turn ${turnNumber}:`)} ${issuesText}`);
      trace(`Turn ${turnNumber}: ${issuesText}`);
    },

    // DEFAULT: Always show patches with field IDs and values
    onPatchesGenerated: ({ patches, stats }) => {
      if (!shouldShow(ctx, 'default')) return;

      // Show patches
      const tokenInfo = formatTokenInfo(stats);
      const tokenInfoPlain =
        stats?.inputTokens || stats?.outputTokens
          ? ` (tokens: ↓${stats.inputTokens ?? 0} ↑${stats.outputTokens ?? 0})`
          : '';
      logInfo(ctx, `  → ${pc.yellow(String(patches.length))} patch(es)${tokenInfo}:`);
      trace(`  → ${patches.length} patch(es)${tokenInfoPlain}:`);

      for (const patch of patches) {
        const typeName = formatPatchType(patch);
        const value = formatPatchValue(patch);
        // Some patches (add_note, remove_note) don't have fieldId
        const fieldId =
          'fieldId' in patch ? patch.fieldId : patch.op === 'add_note' ? patch.ref : '';
        if (fieldId) {
          logInfo(ctx, `    ${pc.cyan(fieldId)} ${pc.dim(`(${typeName})`)} = ${pc.green(value)}`);
          trace(`    ${fieldId} (${typeName}) = ${value}`);
        } else {
          logInfo(ctx, `    ${pc.dim(`(${typeName})`)} = ${pc.green(value)}`);
          trace(`    (${typeName}) = ${value}`);
        }
      }

      // VERBOSE: Tool summary
      if (stats?.toolCalls && stats.toolCalls.length > 0 && shouldShow(ctx, 'verbose')) {
        const toolSummary = stats.toolCalls.map((t) => `${t.name}(${t.count})`).join(', ');
        logVerbose(ctx, `  Tools: ${toolSummary}`);
        trace(`  Tools: ${toolSummary}`);
      }

      // DEBUG: Full prompts
      if (stats?.prompts && shouldShow(ctx, 'debug')) {
        logDebug(ctx, `  ─── System Prompt ───`);
        logDebug(ctx, truncate(stats.prompts.system));
        logDebug(ctx, `  ─── Context Prompt ───`);
        logDebug(ctx, truncate(stats.prompts.context));
        trace(`  ─── System Prompt ───\n${truncate(stats.prompts.system)}`);
        trace(`  ─── Context Prompt ───\n${truncate(stats.prompts.context)}`);
      }
    },

    // DEFAULT: Show completion status
    onTurnComplete: ({ isComplete }) => {
      if (isComplete && shouldShow(ctx, 'default')) {
        logInfo(ctx, pc.green(`  ✓ Complete`));
        trace(`  ✓ Complete`);
      }
    },

    // DEFAULT: Tool calls with queries and structured results
    onToolStart: ({ name, input, query, toolType }) => {
      // Update spinner for web search (even in quiet mode)
      if (toolType === 'web_search' || name.includes('search')) {
        const queryText = query ? ` "${query}"` : '';
        options.spinner?.message(`Web search${queryText}...`);
      }

      if (!shouldShow(ctx, 'default')) return;

      // Show tool start with query if available
      const queryInfo = query ? ` ${pc.yellow(`"${query}"`)}` : '';
      const queryInfoPlain = query ? ` "${query}"` : '';
      logInfo(ctx, `  [${name}]${queryInfo}`);
      trace(`  [${name}]${queryInfoPlain}`);

      // DEBUG: Show raw input
      if (shouldShow(ctx, 'debug') && input !== undefined) {
        const inputStr = truncate(safeStringify(input));
        logDebug(ctx, `     Input: ${inputStr}`);
        trace(`     Input: ${inputStr}`);
      }
    },

    onToolEnd: ({
      name,
      durationMs,
      error,
      toolType,
      resultCount,
      sources,
      topResults,
      fullResults,
      output,
    }) => {
      if (!shouldShow(ctx, 'default')) return;

      const durationStr = formatDuration(durationMs);

      if (error) {
        logInfo(ctx, `  ${pc.red('❌')} ${name} failed (${durationStr}): ${error}`);
        trace(`  ❌ ${name} failed (${durationStr}): ${error}`);
        return;
      }

      // Format result info based on tool type
      if (toolType === 'web_search') {
        const countStr = resultCount !== undefined ? `${resultCount} results` : 'done';
        logInfo(ctx, `  ${pc.green('✓')} ${name}: ${countStr} (${durationStr})`);
        trace(`  ✓ ${name}: ${countStr} (${durationStr})`);

        // DEFAULT: Show sources and top results
        if (sources) {
          logInfo(ctx, `     Sources: ${sources}`);
          trace(`     Sources: ${sources}`);
        }
        if (topResults) {
          logInfo(ctx, `     Results: ${topResults}`);
          trace(`     Results: ${topResults}`);
        }

        // VERBOSE: Show full result listings
        if (fullResults && fullResults.length > 0 && shouldShow(ctx, 'verbose')) {
          for (const result of fullResults) {
            const resultLine = `     [${result.index}] "${result.title}" - ${result.url}`;
            logVerbose(ctx, resultLine);
            trace(resultLine);
          }
        }
      } else {
        logInfo(ctx, `  ${pc.green('✓')} ${name}: done (${durationStr})`);
        trace(`  ✓ ${name}: done (${durationStr})`);
      }

      // DEBUG: Show raw output (input is available on onToolStart)
      if (shouldShow(ctx, 'debug') && output !== undefined) {
        const outputStr = truncate(safeStringify(output));
        logDebug(ctx, `     Output: ${outputStr}`);
        trace(`     Output: ${outputStr}`);
      }
    },

    // VERBOSE: LLM call metadata
    onLlmCallStart: ({ model }) => {
      if (shouldShow(ctx, 'verbose')) {
        logVerbose(ctx, `  LLM call: ${model}`);
        trace(`  LLM call: ${model}`);
      }
    },

    onLlmCallEnd: ({ model, inputTokens, outputTokens, reasoningTokens }) => {
      if (shouldShow(ctx, 'verbose')) {
        const reasoningInfo = reasoningTokens ? ` reasoning=${reasoningTokens}` : '';
        const line = `  LLM response: ${model} (in=${inputTokens} out=${outputTokens}${reasoningInfo})`;
        logVerbose(ctx, line);
        trace(line);
      }
    },

    // DEBUG: Reasoning content
    onReasoningGenerated: ({ stepNumber, reasoning }) => {
      if (!shouldShow(ctx, 'debug')) return;

      logDebug(ctx, `  [reasoning step ${stepNumber}]`);
      trace(`  [reasoning step ${stepNumber}]`);
      for (const r of reasoning) {
        if (r.type === 'redacted') {
          logDebug(ctx, `     [redacted]`);
          trace(`     [redacted]`);
        } else if (r.text) {
          const text = truncate(r.text);
          logDebug(ctx, `     ${text}`);
          trace(`     ${text}`);
        }
      }
    },
  };
}

/**
 * Format token info for patch output.
 */
function formatTokenInfo(stats?: TurnStats): string {
  if (!stats?.inputTokens && !stats?.outputTokens) return '';
  const inTokens = stats.inputTokens ?? 0;
  const outTokens = stats.outputTokens ?? 0;
  return pc.dim(` (tokens: ↓${inTokens} ↑${outTokens})`);
}
