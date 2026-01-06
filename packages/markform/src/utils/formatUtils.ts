/**
 * String and formatting utilities.
 *
 * General-purpose utilities for formatting strings, numbers, and other data
 * for display. These are reusable across the codebase (CLI, engine, harness, etc.).
 */

import { DEBUG_OUTPUT_TRUNCATION_LIMIT } from '../settings.js';

// =============================================================================
// ANSI Utilities
// =============================================================================

/**
 * Strip ANSI escape codes from a string.
 * Useful for file output where colors should not appear.
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// =============================================================================
// String Truncation
// =============================================================================

/**
 * Truncate a string to a maximum length with ellipsis indicator.
 * Useful for debug output where full content would be too verbose.
 */
export function safeTruncate(
  str: string,
  maxLength: number = DEBUG_OUTPUT_TRUNCATION_LIMIT,
): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...[truncated]';
}

// =============================================================================
// Duration & Size Formatting
// =============================================================================

/**
 * Format duration in milliseconds to human-readable string.
 * Uses seconds format (e.g., "1.5s") for consistency.
 */
export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format a file size in bytes to human-readable string.
 * Examples: "512 B", "1.5 KB", "2.3 MB"
 */
export function humanReadableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =============================================================================
// JSON Utilities
// =============================================================================

/**
 * Safely stringify an object for debug output.
 * Falls back to String() if JSON.stringify fails (e.g., circular references).
 */
export function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}
