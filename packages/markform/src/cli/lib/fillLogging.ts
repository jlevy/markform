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
 */

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
}

// =============================================================================
// Helpers
// =============================================================================

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
  // Show model info at start if provided (default level)
  if (options.modelId && shouldShow(ctx, 'default')) {
    const providerInfo = options.provider ? ` (provider: ${options.provider})` : '';
    logInfo(ctx, pc.bold(`Model: ${options.modelId}${providerInfo}`));
  }

  return {
    // DEFAULT: Always show turn number and issues
    onIssuesIdentified: ({ turnNumber, issues }) => {
      if (!shouldShow(ctx, 'default')) return;
      logInfo(ctx, `${pc.bold(`Turn ${turnNumber}:`)} ${formatTurnIssues(issues)}`);
    },

    // DEFAULT: Always show patches with field IDs and values
    onPatchesGenerated: ({ patches, stats }) => {
      if (!shouldShow(ctx, 'default')) return;

      // Show patches
      const tokenInfo = formatTokenInfo(stats);
      logInfo(ctx, `  → ${pc.yellow(String(patches.length))} patch(es)${tokenInfo}:`);

      for (const patch of patches) {
        const typeName = formatPatchType(patch);
        const value = formatPatchValue(patch);
        // Some patches (add_note, remove_note) don't have fieldId
        const fieldId =
          'fieldId' in patch ? patch.fieldId : patch.op === 'add_note' ? patch.ref : '';
        if (fieldId) {
          logInfo(ctx, `    ${pc.cyan(fieldId)} ${pc.dim(`(${typeName})`)} = ${pc.green(value)}`);
        } else {
          logInfo(ctx, `    ${pc.dim(`(${typeName})`)} = ${pc.green(value)}`);
        }
      }

      // VERBOSE: Tool summary
      if (stats?.toolCalls && stats.toolCalls.length > 0 && shouldShow(ctx, 'verbose')) {
        const toolSummary = stats.toolCalls.map((t) => `${t.name}(${t.count})`).join(', ');
        logVerbose(ctx, `  Tools: ${toolSummary}`);
      }

      // DEBUG: Full prompts
      if (stats?.prompts && shouldShow(ctx, 'debug')) {
        logDebug(ctx, `  ─── System Prompt ───`);
        logDebug(ctx, truncate(stats.prompts.system));
        logDebug(ctx, `  ─── Context Prompt ───`);
        logDebug(ctx, truncate(stats.prompts.context));
      }
    },

    // DEFAULT: Show completion status
    onTurnComplete: ({ isComplete }) => {
      if (isComplete && shouldShow(ctx, 'default')) {
        logInfo(ctx, pc.green(`  ✓ Complete`));
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
      logInfo(ctx, `  [${name}]${queryInfo}`);

      // DEBUG: Show raw input
      if (shouldShow(ctx, 'debug') && input !== undefined) {
        logDebug(ctx, `     Input: ${truncate(safeStringify(input))}`);
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

      if (error) {
        logInfo(ctx, `  ${pc.red('❌')} ${name} failed (${formatDuration(durationMs)}): ${error}`);
        return;
      }

      // Format result info based on tool type
      if (toolType === 'web_search') {
        const countStr = resultCount !== undefined ? `${resultCount} results` : 'done';
        logInfo(ctx, `  ${pc.green('✓')} ${name}: ${countStr} (${formatDuration(durationMs)})`);

        // DEFAULT: Show sources and top results
        if (sources) {
          logInfo(ctx, `     Sources: ${sources}`);
        }
        if (topResults) {
          logInfo(ctx, `     Results: ${topResults}`);
        }

        // VERBOSE: Show full result listings
        if (fullResults && fullResults.length > 0 && shouldShow(ctx, 'verbose')) {
          for (const result of fullResults) {
            logVerbose(ctx, `     [${result.index}] "${result.title}" - ${result.url}`);
          }
        }
      } else {
        logInfo(ctx, `  ${pc.green('✓')} ${name}: done (${formatDuration(durationMs)})`);
      }

      // DEBUG: Show raw output (input is available on onToolStart)
      if (shouldShow(ctx, 'debug') && output !== undefined) {
        logDebug(ctx, `     Output: ${truncate(safeStringify(output))}`);
      }
    },

    // VERBOSE: LLM call metadata
    onLlmCallStart: ({ model }) => {
      if (shouldShow(ctx, 'verbose')) {
        logVerbose(ctx, `  LLM call: ${model}`);
      }
    },

    onLlmCallEnd: ({ model, inputTokens, outputTokens, reasoningTokens }) => {
      if (shouldShow(ctx, 'verbose')) {
        const reasoningInfo = reasoningTokens ? ` reasoning=${reasoningTokens}` : '';
        logVerbose(
          ctx,
          `  LLM response: ${model} (in=${inputTokens} out=${outputTokens}${reasoningInfo})`,
        );
      }
    },

    // DEBUG: Reasoning content
    onReasoningGenerated: ({ stepNumber, reasoning }) => {
      if (!shouldShow(ctx, 'debug')) return;

      logDebug(ctx, `  [reasoning step ${stepNumber}]`);
      for (const r of reasoning) {
        if (r.type === 'redacted') {
          logDebug(ctx, `     [redacted]`);
        } else if (r.text) {
          logDebug(ctx, `     ${truncate(r.text)}`);
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
