/**
 * CLI Fill Callbacks - Helper to create FillCallbacks for CLI commands.
 *
 * Provides real-time feedback during web search tool execution.
 */

import type { FillCallbacks } from '../../harness/harnessTypes.js';
import type { SpinnerHandle } from './shared.js';
import { logVerbose } from './shared.js';
import type { CommandContext } from './cliTypes.js';

/**
 * Create FillCallbacks for CLI commands.
 *
 * Provides spinner feedback during tool execution (especially web search).
 * Only implements tool callbacks - turn/LLM callbacks are handled by CLI's
 * own logging which has richer context.
 *
 * @param spinner - Active spinner handle to update
 * @param ctx - Command context for verbose logging
 * @returns FillCallbacks with onToolStart and onToolEnd
 *
 * @example
 * ```typescript
 * const spinner = createSpinner({ type: 'api', provider, model });
 * const callbacks = createCliToolCallbacks(spinner, ctx);
 * const agent = createLiveAgent({ model, callbacks, ... });
 * ```
 */
export function createCliToolCallbacks(
  spinner: SpinnerHandle,
  ctx: CommandContext,
): Pick<FillCallbacks, 'onToolStart' | 'onToolEnd'> {
  return {
    onToolStart: ({ name }) => {
      // Update spinner for web search tools
      if (name.includes('search')) {
        spinner.message(`🔍 Web search...`);
      }
      logVerbose(ctx, `  Tool started: ${name}`);
    },

    onToolEnd: ({ name, durationMs, error }) => {
      if (error) {
        logVerbose(ctx, `  Tool ${name} failed: ${error} (${durationMs}ms)`);
      } else {
        logVerbose(ctx, `  Tool ${name} completed (${durationMs}ms)`);
      }
    },
  };
}
