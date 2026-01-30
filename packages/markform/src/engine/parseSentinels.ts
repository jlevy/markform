/**
 * Sentinel value parsing for Markform fields.
 *
 * Sentinel values (%SKIP% and %ABORT%) are special markers that indicate
 * a field was intentionally skipped or aborted rather than filled in.
 */

import type { Node } from '@markdoc/markdoc';

import type { FieldResponse } from './coreTypes.js';
import { extractFenceValue, getStringAttr } from './parseHelpers.js';
import { MarkformParseError } from '../errors.js';

// =============================================================================
// Sentinel Constants
// =============================================================================

/** Sentinel values for text fields */
export const SENTINEL_SKIP = '%SKIP%';
export const SENTINEL_ABORT = '%ABORT%';

// =============================================================================
// Sentinel Parsing
// =============================================================================

/**
 * Parsed sentinel value.
 */
export interface ParsedSentinel {
  type: 'skip' | 'abort';
  reason?: string;
}

/**
 * Detect if a value contains a sentinel pattern (%SKIP% or %ABORT%).
 *
 * This is the shared low-level detection function used for:
 * - Form parsing validation (strict format)
 * - Patch value validation (reject embedded sentinels)
 * - Table cell parsing (convert to skipped/aborted state)
 *
 * Supports multiple formats that LLMs might generate:
 * - `%SKIP%` or `%skip%` (case-insensitive)
 * - `%SKIP% (reason)` - canonical format
 * - `%SKIP:reason%` or `%SKIP(reason)%` - compact formats
 *
 * @param value - The value to check (returns null for non-strings)
 * @returns Detected sentinel type and optional reason, or null if no sentinel
 */
export function detectSentinel(value: unknown): ParsedSentinel | null {
  if (value == null || typeof value !== 'string') return null;

  const trimmed = value.trim();

  // Pattern for compact formats: %SKIP:reason% or %SKIP(reason)%
  // Case-insensitive, supports both : and ( as separators
  // Use non-greedy (.*?) to avoid capturing the closing ) or trailing %
  const compactSkipMatch = /^%SKIP(?:[:(](.*?))?[)]?%$/i.exec(trimmed);
  if (compactSkipMatch) {
    const reason = compactSkipMatch[1]?.trim();
    return { type: 'skip', ...(reason && { reason }) };
  }

  const compactAbortMatch = /^%ABORT(?:[:(](.*?))?[)]?%$/i.exec(trimmed);
  if (compactAbortMatch) {
    const reason = compactAbortMatch[1]?.trim();
    return { type: 'abort', ...(reason && { reason }) };
  }

  // Pattern for canonical format: %SKIP% (reason) - case-insensitive
  const upper = trimmed.toUpperCase();
  if (upper.startsWith('%SKIP%')) {
    const rest = trimmed.slice(6).trim(); // 6 = '%SKIP%'.length
    if (rest === '') {
      return { type: 'skip' };
    }
    // Extract reason from parentheses
    const reasonMatch = /^\((.+)\)$/s.exec(rest);
    if (reasonMatch?.[1]) {
      return { type: 'skip', reason: reasonMatch[1].trim() };
    }
    // Has trailing content but not in parentheses - still a sentinel
    return { type: 'skip' };
  }

  if (upper.startsWith('%ABORT%')) {
    const rest = trimmed.slice(7).trim(); // 7 = '%ABORT%'.length
    if (rest === '') {
      return { type: 'abort' };
    }
    // Extract reason from parentheses
    const reasonMatch = /^\((.+)\)$/s.exec(rest);
    if (reasonMatch?.[1]) {
      return { type: 'abort', reason: reasonMatch[1].trim() };
    }
    // Has trailing content but not in parentheses - still a sentinel
    return { type: 'abort' };
  }

  return null;
}

/**
 * Parse a sentinel value with optional parenthesized reason (strict format).
 *
 * This is the strict parser used during form parsing, where we want to
 * validate the exact format. For patch validation, use detectSentinel().
 *
 * Formats: `%SKIP%`, `%SKIP% (reason text)`, `%ABORT%`, `%ABORT% (reason text)`
 * Returns null if the content is not a valid sentinel format.
 */
export function parseSentinel(content: string | null): ParsedSentinel | null {
  if (!content) {
    return null;
  }

  const trimmed = content.trim();
  const reasonPattern = /^\((.+)\)$/s;

  // Check for %SKIP% with optional reason (case-sensitive for strict parsing)
  if (trimmed.startsWith(SENTINEL_SKIP)) {
    const rest = trimmed.slice(SENTINEL_SKIP.length).trim();
    if (rest === '') {
      return { type: 'skip' };
    }
    // Extract reason from parentheses
    const match = reasonPattern.exec(rest);
    if (match?.[1]) {
      return { type: 'skip', reason: match[1].trim() };
    }
    // Invalid format - just %SKIP% with non-parenthesized content
    return null;
  }

  // Check for %ABORT% with optional reason (case-sensitive for strict parsing)
  if (trimmed.startsWith(SENTINEL_ABORT)) {
    const rest = trimmed.slice(SENTINEL_ABORT.length).trim();
    if (rest === '') {
      return { type: 'abort' };
    }
    // Extract reason from parentheses
    const match = reasonPattern.exec(rest);
    if (match?.[1]) {
      return { type: 'abort', reason: match[1].trim() };
    }
    // Invalid format - just %ABORT% with non-parenthesized content
    return null;
  }

  return null;
}

/**
 * Check for sentinel values in fence content and validate against state attribute.
 * Handles the common pattern of checking for %SKIP% and %ABORT% sentinels in field values.
 *
 * @param node - The field node to check
 * @param fieldId - The field ID for error messages
 * @param required - Whether the field is required (skip not allowed on required fields)
 * @returns A FieldResponse if a sentinel is found, null otherwise
 */
export function tryParseSentinelResponse(
  node: Node,
  fieldId: string,
  required: boolean,
): FieldResponse | null {
  const fenceContent = extractFenceValue(node);
  const stateAttr = getStringAttr(node, 'state');

  const sentinel = parseSentinel(fenceContent);
  if (!sentinel) {
    return null;
  }

  if (sentinel.type === 'skip') {
    if (stateAttr !== undefined && stateAttr !== 'skipped') {
      throw new MarkformParseError(
        `Field '${fieldId}' has conflicting state='${stateAttr}' with %SKIP% sentinel`,
      );
    }
    if (required) {
      throw new MarkformParseError(
        `Field '${fieldId}' is required but has %SKIP% sentinel. Cannot skip required fields.`,
      );
    }
    return { state: 'skipped', ...(sentinel.reason && { reason: sentinel.reason }) };
  }

  if (sentinel.type === 'abort') {
    if (stateAttr !== undefined && stateAttr !== 'aborted') {
      throw new MarkformParseError(
        `Field '${fieldId}' has conflicting state='${stateAttr}' with %ABORT% sentinel`,
      );
    }
    return { state: 'aborted', ...(sentinel.reason && { reason: sentinel.reason }) };
  }

  return null;
}
