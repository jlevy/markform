/**
 * Color and output formatting utilities for CLI.
 */

import pc from "picocolors";

/**
 * Semantic color helpers for consistent CLI output.
 */
export const colors = {
  success: (msg: string) => pc.green(msg),
  error: (msg: string) => pc.red(msg),
  warn: (msg: string) => pc.yellow(msg),
  info: (msg: string) => pc.cyan(msg),
  dim: (msg: string) => pc.dim(msg),
  bold: (msg: string) => pc.bold(msg),
  title: (msg: string) => pc.bold(pc.cyan(msg)),
};

/**
 * Format a duration in seconds.
 */
export function formatDuration(ms: number): string {
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

/**
 * Format a timing message.
 */
export function formatTiming(label: string, durationMs: number): string {
  return pc.cyan(`⏰ ${label}: ${formatDuration(durationMs)}`);
}

/**
 * Format a count with label.
 */
export function formatCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

/**
 * Format a state badge.
 */
export function formatState(state: string): string {
  switch (state) {
    case "complete":
      return pc.green("✓ complete");
    case "incomplete":
      return pc.yellow("○ incomplete");
    case "empty":
      return pc.dim("◌ empty");
    case "invalid":
      return pc.red("✗ invalid");
    default:
      return state;
  }
}

/**
 * Format a priority badge.
 */
export function formatPriority(priority: number): string {
  const label = `P${priority}`;
  switch (priority) {
    case 1:
      return pc.red(pc.bold(label));
    case 2:
      return pc.yellow(label);
    case 3:
      return pc.cyan(label);
    default:
      return pc.dim(label);
  }
}
