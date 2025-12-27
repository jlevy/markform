/**
 * Sentinel value parsing for Markform fields.
 *
 * Sentinel values (|SKIP| and |ABORT|) are special markers that indicate
 * a field was intentionally skipped or aborted rather than filled in.
 */

import type { Node } from '@markdoc/markdoc';

import type { FieldResponse } from './coreTypes.js';
import { extractFenceValue, getStringAttr, ParseError } from './parseHelpers.js';

// =============================================================================
// Sentinel Constants
// =============================================================================

/** Sentinel values for text fields */
export const SENTINEL_SKIP = '|SKIP|';
export const SENTINEL_ABORT = '|ABORT|';

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
 * Parse a sentinel value with optional parenthesized reason.
 * Formats: `|SKIP|`, `|SKIP| (reason text)`, `|ABORT|`, `|ABORT| (reason text)`
 * Returns null if the content is not a sentinel.
 */
export function parseSentinel(content: string | null): ParsedSentinel | null {
  if (!content) {
    return null;
  }

  const trimmed = content.trim();
  const reasonPattern = /^\((.+)\)$/s;

  // Check for |SKIP| with optional reason
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
    // Invalid format - just |SKIP| with non-parenthesized content
    return null;
  }

  // Check for |ABORT| with optional reason
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
    // Invalid format - just |ABORT| with non-parenthesized content
    return null;
  }

  return null;
}

/**
 * Check for sentinel values in fence content and validate against state attribute.
 * Handles the common pattern of checking for |SKIP| and |ABORT| sentinels in field values.
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
      throw new ParseError(
        `Field '${fieldId}' has conflicting state='${stateAttr}' with |SKIP| sentinel`,
      );
    }
    if (required) {
      throw new ParseError(
        `Field '${fieldId}' is required but has |SKIP| sentinel. Cannot skip required fields.`,
      );
    }
    return { state: 'skipped', ...(sentinel.reason && { reason: sentinel.reason }) };
  }

  if (sentinel.type === 'abort') {
    if (stateAttr !== undefined && stateAttr !== 'aborted') {
      throw new ParseError(
        `Field '${fieldId}' has conflicting state='${stateAttr}' with |ABORT| sentinel`,
      );
    }
    return { state: 'aborted', ...(sentinel.reason && { reason: sentinel.reason }) };
  }

  return null;
}
