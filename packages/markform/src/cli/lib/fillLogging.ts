/**
 * Fill Logging Callbacks - Create FillCallbacks for unified CLI logging.
 *
 * Provides consistent turn-by-turn logging across all CLI commands that
 * run form-filling (fill, run, examples). API consumers can also use
 * these callbacks or implement their own.
 *
 * Default output (always shown unless --quiet):
 * - Turn numbers with issues list (field IDs + issue types)
 * - Patches per turn (field ID + value)
 * - Completion status
 *
 * Verbose output (--verbose flag):
 * - Token counts per turn
 * - Tool call start/end with timing
 * - Detailed stats and LLM metadata
 */

import pc from 'picocolors';

import type { FillCallbacks } from '../../harness/harnessTypes.js';
import type { CommandContext } from './cliTypes.js';
import type { SpinnerHandle } from './shared.js';
import { logInfo, logVerbose } from './shared.js';
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
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create FillCallbacks that produce standard CLI logging output.
 *
 * Default output (always shown unless --quiet):
 * - Turn numbers with issues list (field IDs + issue types)
 * - Patches per turn (field ID + value)
 * - Completion status
 *
 * Verbose output (--verbose flag):
 * - Token counts per turn
 * - Tool call start/end with timing
 * - Detailed stats and LLM metadata
 *
 * This is used by fill, run, and examples commands for consistent output.
 *
 * @param ctx - Command context for verbose/quiet flags
 * @param options - Optional spinner for tool progress
 * @returns FillCallbacks with all logging implemented
 *
 * @example
 * ```typescript
 * const callbacks = createFillLoggingCallbacks(ctx, { spinner });
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
  return {
    // DEFAULT: Always show turn number and issues
    onIssuesIdentified: ({ turnNumber, issues }) => {
      logInfo(ctx, `${pc.bold(`Turn ${turnNumber}:`)} ${formatTurnIssues(issues)}`);
    },

    // DEFAULT: Always show patches with field IDs and values
    onPatchesGenerated: ({ patches, stats }) => {
      logInfo(ctx, `  -> ${pc.yellow(String(patches.length))} patch(es):`);

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

      // VERBOSE: Token counts and detailed stats
      if (stats && ctx.verbose) {
        logVerbose(ctx, `  Tokens: in=${stats.inputTokens ?? 0} out=${stats.outputTokens ?? 0}`);
        if (stats.toolCalls && stats.toolCalls.length > 0) {
          const toolSummary = stats.toolCalls.map((t) => `${t.name}(${t.count})`).join(', ');
          logVerbose(ctx, `  Tools: ${toolSummary}`);
        }
      }
    },

    // DEFAULT: Show completion status
    onTurnComplete: ({ isComplete }) => {
      if (isComplete) {
        logInfo(ctx, pc.green(`  ✓ Complete`));
      }
    },

    // VERBOSE: Tool call details (with spinner update for web search)
    onToolStart: ({ name }) => {
      // Web search gets spinner update even without --verbose
      if (name.includes('search')) {
        options.spinner?.message(`Web search...`);
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

    // VERBOSE: LLM call metadata
    onLlmCallStart: ({ model }) => {
      logVerbose(ctx, `  LLM call: ${model}`);
    },

    onLlmCallEnd: ({ model, inputTokens, outputTokens }) => {
      logVerbose(ctx, `  LLM response: ${model} (in=${inputTokens} out=${outputTokens})`);
    },
  };
}
