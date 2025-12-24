/**
 * Shared CLI utilities for command context, debug, and dry-run helpers.
 */

import type { Command } from "commander";

import pc from "picocolors";
import YAML from "yaml";

import { convertKeysToSnakeCase } from "./naming.js";

/**
 * Output format options for CLI commands.
 * - console: auto-detect TTY, use ANSI colors if available (default)
 * - plaintext: same as console but no ANSI colors
 * - yaml: structured YAML output
 * - json: structured JSON output
 * - markform: canonical markform format (markdoc directives, for export command)
 * - markdown: plain readable markdown (no directives, for export command)
 */
export type OutputFormat = "console" | "plaintext" | "yaml" | "json" | "markform" | "markdown";

/**
 * Valid format options for Commander choice validation.
 */
export const OUTPUT_FORMATS: OutputFormat[] = [
  "console",
  "plaintext",
  "yaml",
  "json",
  "markform",
  "markdown",
];

/**
 * Context available to all commands.
 */
export interface CommandContext {
  dryRun: boolean;
  verbose: boolean;
  quiet: boolean;
  format: OutputFormat;
}

/**
 * Extract command context from Commander options.
 */
export function getCommandContext(command: Command): CommandContext {
  const opts = command.optsWithGlobals<{
    dryRun?: boolean;
    verbose?: boolean;
    quiet?: boolean;
    format?: OutputFormat;
  }>();
  return {
    dryRun: opts.dryRun ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
    format: opts.format ?? "console",
  };
}

/**
 * Check if output should use colors.
 * Returns true for console format when stdout is a TTY.
 */
export function shouldUseColors(ctx: CommandContext): boolean {
  if (ctx.format === "plaintext" || ctx.format === "yaml" || ctx.format === "json") {
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
  consoleFormatter?: (data: unknown, useColors: boolean) => string
): string {
  switch (ctx.format) {
    case "json":
      return JSON.stringify(convertKeysToSnakeCase(data), null, 2);
    case "yaml":
      return YAML.stringify(convertKeysToSnakeCase(data));
    case "plaintext":
    case "console":
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
 * Log a verbose message (only shown if --verbose is set).
 */
export function logVerbose(ctx: CommandContext, message: string): void {
  if (ctx.verbose) {
    console.log(pc.dim(message));
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
export function logTiming(
  ctx: CommandContext,
  label: string,
  durationMs: number
): void {
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
 * Read a file and return its contents.
 */
export async function readFile(filePath: string): Promise<string> {
  const { readFile: fsReadFile } = await import("node:fs/promises");
  return fsReadFile(filePath, "utf-8");
}

/**
 * Write contents to a file.
 */
export async function writeFile(
  filePath: string,
  contents: string
): Promise<void> {
  const { writeFile: fsWriteFile } = await import("node:fs/promises");
  await fsWriteFile(filePath, contents, "utf-8");
}
