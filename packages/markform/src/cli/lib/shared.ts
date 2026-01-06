/**
 * Shared CLI utilities for command context, debug, and dry-run helpers.
 */

import type { Command } from 'commander';

import { mkdir } from 'node:fs/promises';
import { relative } from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';
import YAML from 'yaml';

import { convertKeysToSnakeCase } from './naming.js';
import type { CommandContext, LogLevel, OutputFormat } from './cliTypes.js';

// =============================================================================
// Spinner Utility Types
// =============================================================================

/**
 * Context type for spinner operations.
 * - 'api': For LLM/API calls (shows provider, model, turn info)
 * - 'compute': For local calculations
 */
export type SpinnerContextType = 'api' | 'compute';

/**
 * API context for spinner - used when making LLM calls.
 */
export interface ApiSpinnerContext {
  type: 'api';
  provider: string;
  model: string;
  turnNumber?: number;
}

/**
 * Compute context for spinner - used for local calculations.
 */
export interface ComputeSpinnerContext {
  type: 'compute';
  operation: string;
}

/**
 * Union of spinner context types.
 */
export type SpinnerContext = ApiSpinnerContext | ComputeSpinnerContext;

/**
 * Handle for controlling an active spinner.
 */
export interface SpinnerHandle {
  /** Update the spinner message. */
  message(msg: string): void;
  /** Update the spinner context (re-renders with elapsed time). */
  update(context: SpinnerContext): void;
  /** Stop the spinner with a success message. */
  stop(msg?: string): void;
  /** Stop the spinner with an error message. */
  error(msg: string): void;
  /** Get elapsed time in milliseconds since spinner started. */
  getElapsedMs(): number;
}

// Re-export types for backwards compatibility
export type { CommandContext, LogLevel, OutputFormat } from './cliTypes.js';

// =============================================================================
// Spinner Utility Functions
// =============================================================================

/**
 * Format elapsed time for display.
 */
function formatElapsedTime(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

/**
 * Format spinner message based on context type.
 */
function formatSpinnerMessage(context: SpinnerContext, elapsedMs: number): string {
  const elapsed = formatElapsedTime(elapsedMs);

  if (context.type === 'api') {
    const turnInfo = context.turnNumber !== undefined ? ` turn ${context.turnNumber}` : '';
    return `${context.provider}/${context.model}${turnInfo} ${pc.dim(`(${elapsed})`)}`;
  }

  return `${context.operation} ${pc.dim(`(${elapsed})`)}`;
}

/**
 * Create a context-aware spinner with elapsed time tracking.
 *
 * The spinner automatically updates its message with elapsed time.
 *
 * @example
 * ```ts
 * const spinner = createSpinner({
 *   type: 'api',
 *   provider: 'anthropic',
 *   model: 'claude-sonnet-4',
 *   turnNumber: 1,
 * });
 *
 * // Do async work...
 * const result = await agent.fillFormTool(...);
 *
 * spinner.stop('Done');
 * ```
 */
export function createSpinner(context: SpinnerContext): SpinnerHandle {
  const startTime = Date.now();
  const spinner = p.spinner();
  let currentContext = context;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  // Start the spinner with initial message
  const initialMessage = formatSpinnerMessage(currentContext, 0);
  spinner.start(initialMessage);

  // Update elapsed time every second
  intervalId = setInterval(() => {
    const elapsed = Date.now() - startTime;
    spinner.message(formatSpinnerMessage(currentContext, elapsed));
  }, 1000);

  const cleanup = (): void => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  return {
    message(msg: string): void {
      spinner.message(msg);
    },

    update(newContext: SpinnerContext): void {
      currentContext = newContext;
      const elapsed = Date.now() - startTime;
      spinner.message(formatSpinnerMessage(currentContext, elapsed));
    },

    stop(msg?: string): void {
      cleanup();
      const elapsed = Date.now() - startTime;
      const defaultMsg = formatSpinnerMessage(currentContext, elapsed);
      spinner.stop(msg ?? `✓ ${defaultMsg}`);
    },

    error(msg: string): void {
      cleanup();
      spinner.stop(pc.red(`✗ ${msg}`));
    },

    getElapsedMs(): number {
      return Date.now() - startTime;
    },
  };
}

/**
 * Create a no-op spinner handle for quiet mode or non-TTY environments.
 */
export function createNoOpSpinner(): SpinnerHandle {
  const startTime = Date.now();
  // Use explicit undefined returns to avoid empty-function lint errors
  const noop = (): void => undefined;
  return {
    message: noop,
    update: noop,
    stop: noop,
    error: noop,
    getElapsedMs: () => Date.now() - startTime,
  };
}

/**
 * Create a spinner if appropriate for the context.
 * Returns a no-op spinner in quiet mode or when stdout is not a TTY.
 */
export function createSpinnerIfTty(context: SpinnerContext, ctx: CommandContext): SpinnerHandle {
  if (ctx.quiet || !process.stdout.isTTY) {
    return createNoOpSpinner();
  }
  return createSpinner(context);
}

// =============================================================================
// Output Format Utilities
// =============================================================================

/**
 * Valid format options for Commander choice validation.
 */
export const OUTPUT_FORMATS: OutputFormat[] = [
  'console',
  'plaintext',
  'yaml',
  'json',
  'markform',
  'markdown',
];

/**
 * Compute log level from flags and environment.
 *
 * Priority: --quiet > --debug > --verbose > MARKFORM_LOG_LEVEL > default
 */
function computeLogLevel(opts: { quiet?: boolean; debug?: boolean; verbose?: boolean }): LogLevel {
  // Flags take precedence over environment
  if (opts.quiet) return 'quiet';
  if (opts.debug) return 'debug';
  if (opts.verbose) return 'verbose';

  // Check environment variable (consistent naming with MARKFORM_ prefix)
  const envLevel = process.env.MARKFORM_LOG_LEVEL?.toLowerCase();
  if (envLevel === 'quiet' || envLevel === 'debug' || envLevel === 'verbose') {
    return envLevel;
  }

  return 'default';
}

/**
 * Extract command context from Commander options.
 */
export function getCommandContext(command: Command): CommandContext {
  const opts = command.optsWithGlobals<{
    dryRun?: boolean;
    verbose?: boolean;
    quiet?: boolean;
    debug?: boolean;
    trace?: string;
    format?: OutputFormat;
    formsDir?: string;
    overwrite?: boolean;
  }>();

  const logLevel = computeLogLevel(opts);

  // Trace file: --trace flag or MARKFORM_TRACE env var
  const traceFile = opts.trace ?? process.env.MARKFORM_TRACE;

  return {
    dryRun: opts.dryRun ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
    debug: opts.debug ?? false,
    logLevel,
    format: opts.format ?? 'console',
    formsDir: opts.formsDir,
    overwrite: opts.overwrite ?? false,
    traceFile,
  };
}

/**
 * Check if output should use colors.
 * Returns true for console format when stdout is a TTY.
 */
export function shouldUseColors(ctx: CommandContext): boolean {
  if (ctx.format === 'plaintext' || ctx.format === 'yaml' || ctx.format === 'json') {
    return false;
  }
  // console format: use colors if stdout is a TTY and NO_COLOR is not set
  return process.stdout.isTTY && !process.env.NO_COLOR;
}

/**
 * Format structured data according to output format.
 *
 * JSON and YAML outputs are converted to snake_case keys for consistency.
 */
export function formatOutput(
  ctx: CommandContext,
  data: unknown,
  consoleFormatter?: (data: unknown, useColors: boolean) => string,
): string {
  switch (ctx.format) {
    case 'json':
      return JSON.stringify(convertKeysToSnakeCase(data), null, 2);
    case 'yaml':
      return YAML.stringify(convertKeysToSnakeCase(data));
    case 'plaintext':
    case 'console':
    default:
      if (consoleFormatter) {
        return consoleFormatter(data, shouldUseColors(ctx));
      }
      // Default: use YAML for readable console output
      return YAML.stringify(convertKeysToSnakeCase(data));
  }
}

/**
 * Log a dry-run message.
 */
export function logDryRun(message: string, details?: unknown): void {
  console.log(pc.yellow(`[DRY RUN] ${message}`));
  if (details) {
    console.log(pc.dim(JSON.stringify(details, null, 2)));
  }
}

/**
 * Log a verbose message (only shown if --verbose or --debug is set).
 */
export function logVerbose(ctx: CommandContext, message: string): void {
  if (ctx.verbose || ctx.debug) {
    console.log(pc.dim(message));
  }
}

/**
 * Log a debug message (only shown if --debug is set or MARKFORM_LOG_LEVEL=debug).
 *
 * Use for full diagnostic output like raw prompts and tool I/O.
 */
export function logDebug(ctx: CommandContext, message: string): void {
  if (ctx.debug || ctx.logLevel === 'debug') {
    console.log(pc.magenta(message));
  }
}

/**
 * Log an info message (hidden if --quiet is set).
 */
export function logInfo(ctx: CommandContext, message: string): void {
  if (!ctx.quiet) {
    console.log(message);
  }
}

/**
 * Log an error message (always shown).
 */
export function logError(message: string): void {
  console.error(pc.red(`Error: ${message}`));
}

/**
 * Log a success message (hidden if --quiet is set).
 */
export function logSuccess(ctx: CommandContext, message: string): void {
  if (!ctx.quiet) {
    console.log(pc.green(message));
  }
}

/**
 * Log a timing message (hidden if --quiet is set).
 */
export function logTiming(ctx: CommandContext, label: string, durationMs: number): void {
  if (!ctx.quiet) {
    const seconds = (durationMs / 1000).toFixed(1);
    console.log(pc.cyan(`⏰ ${label}: ${seconds}s`));
  }
}

/**
 * Log a warning message (hidden if --quiet is set).
 */
export function logWarn(ctx: CommandContext, message: string): void {
  if (!ctx.quiet) {
    console.log(pc.yellow(`⚠️  ${message}`));
  }
}

/**
 * Format a file path for display: relative to cwd, colored green.
 * If the path is within the cwd, shows as relative (e.g., "./simple-filled1.form.md")
 * If outside cwd, shows the absolute path.
 */
export function formatPath(absolutePath: string, cwd: string = process.cwd()): string {
  const relativePath = relative(cwd, absolutePath);
  // If the relative path doesn't start with "..", it's within cwd
  const displayPath = relativePath.startsWith('..') ? absolutePath : `./${relativePath}`;
  return pc.green(displayPath);
}

/**
 * Read a file and return its contents.
 */
export async function readFile(filePath: string): Promise<string> {
  const { readFile: fsReadFile } = await import('node:fs/promises');
  return fsReadFile(filePath, 'utf-8');
}

/**
 * Write contents to a file atomically.
 *
 * Uses the atomically library to prevent partial or corrupted files
 * if the process crashes mid-write.
 */
export async function writeFile(filePath: string, contents: string): Promise<void> {
  const { writeFile: atomicWriteFile } = await import('atomically');
  await atomicWriteFile(filePath, contents);
}

/**
 * Ensure the forms directory exists, creating it if necessary.
 * Uses recursive mkdir so parent directories are created as needed.
 *
 * @param formsDir Absolute path to the forms directory
 */
export async function ensureFormsDir(formsDir: string): Promise<void> {
  await mkdir(formsDir, { recursive: true });
}
