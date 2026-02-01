/**
 * Time utilities - Shared helpers for time and ID generation.
 *
 * Centralizes time-related operations for:
 * - Consistent behavior across the codebase
 * - Easy mocking in tests
 * - Clear audit of time-dependent code
 */

import { ulid } from 'ulid';

/**
 * Get the current time as an ISO 8601 string.
 *
 * All code that needs "now" should call this function instead of
 * `new Date()` directly. This allows:
 * - Consistent timestamp format (ISO 8601)
 * - Clear visibility into time-dependent code
 * - Future support for clock mocking in tests
 *
 * @returns ISO 8601 timestamp string
 *
 * @example
 * ```typescript
 * const startedAt = currentTime();
 * // ... do work ...
 * const completedAt = currentTime();
 * ```
 */
export function currentTime(): string {
  return new Date().toISOString();
}

/**
 * Get the current time in milliseconds since Unix epoch.
 *
 * Use this when you need numeric timestamps for duration calculations.
 *
 * @returns Milliseconds since Unix epoch
 */
export function currentTimeMs(): number {
  return Date.now();
}

/**
 * Generate a unique session ID using ULID with a "sess-" prefix.
 *
 * ULIDs are:
 * - Lexicographically sortable by time
 * - 128-bit compatible with UUID
 * - URL-safe (no special characters)
 * - Monotonically increasing within the same millisecond
 *
 * The "sess-" prefix makes IDs self-identifying, following the policy
 * that all IDs should indicate their type at a glance. The ULID is
 * lowercased for consistency and readability.
 *
 * @returns Prefixed lowercase ULID string (31 characters: "sess-" + 26-char ULID)
 *
 * @example
 * ```typescript
 * const sessionId = generateSessionId();
 * // => "sess-01arz3ndektsv4rrffq69g5fav"
 * ```
 */
export function generateSessionId(): string {
  return `sess-${ulid().toLowerCase()}`;
}
