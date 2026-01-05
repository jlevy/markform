/**
 * CLI Fill Callbacks - Helper to create FillCallbacks for CLI commands.
 *
 * Provides real-time feedback during web search tool execution.
 */

import type { FillCallbacks } from '../../harness/harnessTypes.js';
import type { SpinnerHandle } from './shared.js';
import { logVerbose, logDebug } from './shared.js';
import type { CommandContext } from './cliTypes.js';
import type { TraceFn } from './traceUtils.js';
import { truncate, formatDuration } from './traceUtils.js';

/**
 * Options for creating CLI tool callbacks.
 */
export interface CliToolCallbacksOptions {
  /** Spinner handle for UI feedback */
  spinner: SpinnerHandle;
  /** Command context for logging */
  ctx: CommandContext;
  /** Optional trace function for file output */
  trace?: TraceFn;
}

/**
 * Create FillCallbacks for CLI commands.
 *
 * Provides spinner feedback during tool execution (especially web search).
 * Also supports trace file output when trace function is provided.
 * Only implements tool callbacks - turn/LLM callbacks are handled by CLI's
 * own logging which has richer context.
 *
 * @param options - Spinner, context, and optional trace function
 * @returns FillCallbacks with onToolStart and onToolEnd
 *
 * @example
 * ```typescript
 * const spinner = createSpinner({ type: 'api', provider, model });
 * const trace = createTracer(ctx.traceFile, modelId);
 * const callbacks = createCliToolCallbacks({ spinner, ctx, trace });
 * const agent = createLiveAgent({ model, callbacks, ... });
 * ```
 */
export function createCliToolCallbacks(
  options: CliToolCallbacksOptions,
): Pick<
  FillCallbacks,
  'onToolStart' | 'onToolEnd' | 'onLlmCallStart' | 'onLlmCallEnd' | 'onReasoningGenerated'
> {
  const { spinner, ctx, trace = () => undefined } = options;

  return {
    onToolStart: ({ name, query }) => {
      // Update spinner for web search tools
      if (name.includes('search')) {
        const queryText = query ? ` "${query}"` : '';
        spinner.message(`🔍 Web search${queryText}...`);
      }
      const queryInfo = query ? ` "${query}"` : '';
      logVerbose(ctx, `  Tool started: ${name}${queryInfo}`);
      trace(`  [${name}]${queryInfo}`);
    },

    onToolEnd: ({ name, durationMs, error, resultCount, sources }) => {
      const duration = formatDuration(durationMs);
      if (error) {
        logVerbose(ctx, `  Tool ${name} failed: ${error} (${duration})`);
        trace(`  ❌ ${name} failed (${duration}): ${error}`);
      } else {
        const countInfo = resultCount !== undefined ? ` (${resultCount} results)` : '';
        logVerbose(ctx, `  Tool ${name} completed${countInfo} (${duration})`);
        trace(`  ✓ ${name}${countInfo} (${duration})`);
        if (sources) {
          trace(`     Sources: ${sources}`);
        }
      }
    },

    onLlmCallStart: ({ model }) => {
      logVerbose(ctx, `  LLM call: ${model}`);
      trace(`  LLM call: ${model}`);
    },

    onLlmCallEnd: ({ model, inputTokens, outputTokens, reasoningTokens }) => {
      const reasoningInfo = reasoningTokens ? ` reasoning=${reasoningTokens}` : '';
      const line = `  LLM response: ${model} (in=${inputTokens} out=${outputTokens}${reasoningInfo})`;
      logVerbose(ctx, line);
      trace(line);
    },

    onReasoningGenerated: ({ stepNumber, reasoning }) => {
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
        } else {
          logDebug(ctx, `     [reasoning content not available]`);
          trace(`     [reasoning content not available]`);
        }
      }
    },
  };
}
