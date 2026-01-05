/**
 * Trace file utilities for CLI logging.
 *
 * This module provides shared utilities for trace file output, including:
 * - ANSI code stripping for clean file output
 * - Trace file initialization and writing
 * - String truncation for debug output
 * - Duration formatting
 */

import { appendFileSync, writeFileSync } from 'node:fs';

import { DEBUG_OUTPUT_TRUNCATION_LIMIT } from '../../settings.js';

// =============================================================================
// ANSI Utilities
// =============================================================================

/**
 * Strip ANSI escape codes from a string for file output.
 * This is necessary because console output uses colors (via picocolors)
 * but trace files should contain plain text.
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// =============================================================================
// Trace File Utilities
// =============================================================================

/** Function type for writing to trace file */
export type TraceFn = (line: string) => void;

/**
 * Create a trace function that writes to a file if traceFile is provided.
 * Returns a no-op function if no trace file is configured.
 *
 * The trace file is initialized with a header containing timestamp and model info.
 * Each call to the returned function appends a line (with ANSI codes stripped).
 */
export function createTracer(
  traceFile: string | undefined,
  modelId: string | undefined,
  commandName = 'Markform',
): TraceFn {
  if (!traceFile) {
    return () => undefined; // No-op
  }

  // Initialize trace file with header
  const timestamp = new Date().toISOString();
  const header = `# ${commandName} Trace Log\n# Started: ${timestamp}\n# Model: ${modelId ?? 'unknown'}\n\n`;
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

// =============================================================================
// String Utilities
// =============================================================================

/**
 * Truncate a string to a maximum length with ellipsis indicator.
 * Useful for debug output where full content would be too verbose.
 */
export function truncate(str: string, maxLength: number = DEBUG_OUTPUT_TRUNCATION_LIMIT): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...[truncated]';
}

/**
 * Format duration in milliseconds to human-readable string.
 * Uses seconds format (e.g., "1.5s") for consistency.
 */
export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format a file size in bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
