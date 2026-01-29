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
 * Generate a unique session ID using ULID.
 *
 * ULIDs are:
 * - Lexicographically sortable by time
 * - 128-bit compatible with UUID
 * - URL-safe (no special characters)
 * - Monotonically increasing within the same millisecond
 *
 * Use this instead of crypto.randomUUID() for session IDs
 * to avoid crypto dependency and gain sortability.
 *
 * @returns ULID string (26 characters)
 *
 * @example
 * ```typescript
 * const sessionId = generateSessionId();
 * // => "01ARZ3NDEKTSV4RRFFQ69G5FAV"
 * ```
 */
export function generateSessionId(): string {
  return ulid();
}
