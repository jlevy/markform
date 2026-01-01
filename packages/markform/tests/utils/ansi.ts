/**
 * ANSI escape code utilities for tests.
 *
 * Provides helpers for stripping and detecting ANSI codes in test output.
 * Import this instead of defining inline stripAnsi helpers.
 */

// The ESC character used in ANSI escape sequences
const ESC = String.fromCharCode(0x1b);

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*[A-Za-z]/g;

/**
 * Strip all ANSI escape codes from a string.
 * Handles colors, cursor movement, and other control sequences.
 */
export function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, '');
}

/**
 * Check if a string contains ANSI escape codes.
 * Uses the ESC character (0x1b) followed by '[' as the indicator.
 */
export function hasAnsi(str: string): boolean {
  // Check for the ANSI escape sequence opener: ESC (0x1b) + [
  return str.includes(ESC + '[');
}

/**
 * Common ANSI codes for testing color output.
 * Use these to verify specific colors are applied.
 */
export const ANSI = {
  RESET: `${ESC}[0m`,
  BOLD: `${ESC}[1m`,
  DIM: `${ESC}[2m`,
  RED: `${ESC}[31m`,
  GREEN: `${ESC}[32m`,
  YELLOW: `${ESC}[33m`,
  BLUE: `${ESC}[34m`,
  MAGENTA: `${ESC}[35m`,
  CYAN: `${ESC}[36m`,
  WHITE: `${ESC}[37m`,
  // Bright variants
  BRIGHT_RED: `${ESC}[91m`,
  BRIGHT_GREEN: `${ESC}[92m`,
  BRIGHT_YELLOW: `${ESC}[93m`,
  BRIGHT_BLUE: `${ESC}[94m`,
} as const;
