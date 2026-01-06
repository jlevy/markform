/**
 * Trace file utilities for CLI logging.
 *
 * This module provides utilities for trace file output during command execution.
 * For general string formatting utilities, see src/utils/formatUtils.ts.
 */

import { appendFileSync, writeFileSync } from 'node:fs';

import { stripAnsi } from '../../utils/formatUtils.js';

// Re-export common utilities for convenience (backward compatibility)
export {
  stripAnsi,
  safeTruncate,
  formatDuration,
  humanReadableSize,
  safeStringify,
} from '../../utils/formatUtils.js';

// Alias for backward compatibility
export { safeTruncate as truncate } from '../../utils/formatUtils.js';

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
