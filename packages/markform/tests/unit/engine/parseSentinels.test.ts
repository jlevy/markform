/**
 * Unit tests for sentinel value parsing.
 * Uses table-driven tests for comprehensive coverage with minimal code.
 */

import { describe, it, expect } from 'vitest';
import {
  parseSentinel,
  detectSentinel,
  SENTINEL_SKIP,
  SENTINEL_ABORT,
} from '../../../src/engine/parseSentinels.js';

describe('parseSentinels', () => {
  // Valid sentinel cases: [input, expected]
  const VALID_CASES: [string, { type: 'skip' | 'abort'; reason?: string }][] = [
    // Skip sentinels
    ['%SKIP%', { type: 'skip' }],
    ['%SKIP%(Not applicable)', { type: 'skip', reason: 'Not applicable' }],
    ['%SKIP% (out of scope)', { type: 'skip', reason: 'out of scope' }],
    ['%SKIP%(  extra spaces  )', { type: 'skip', reason: 'extra spaces' }],
    ['  %SKIP%  ', { type: 'skip' }],
    // Abort sentinels
    ['%ABORT%', { type: 'abort' }],
    ['%ABORT%(API error)', { type: 'abort', reason: 'API error' }],
    ['%ABORT% (network failure)', { type: 'abort', reason: 'network failure' }],
    ['%ABORT%(  timeout  )', { type: 'abort', reason: 'timeout' }],
    ['  %ABORT%  ', { type: 'abort' }],
  ];

  // Invalid sentinel cases (should return null)
  const INVALID_CASES: (string | null)[] = [
    null,
    '',
    '   ',
    'Hello World',
    'Please SKIP this step',
    '%SKIP without closing',
    '%skip%', // case-sensitive
    '%abort%', // case-sensitive
    '%Skip%', // mixed case
    '%Abort%', // mixed case
    '%SKIP% some reason without parens',
    '%ABORT% some reason without parens',
    '%SKIP:reason%', // old format
    '%ABORT:error%', // old format
  ];

  it.each(VALID_CASES)('parses "%s" correctly', (input, expected) => {
    expect(parseSentinel(input)).toEqual(expected);
  });

  it.each(INVALID_CASES)('returns null for: %s', (input) => {
    expect(parseSentinel(input)).toBeNull();
  });

  it('exports correct sentinel constants', () => {
    expect(SENTINEL_SKIP).toBe('%SKIP%');
    expect(SENTINEL_ABORT).toBe('%ABORT%');
  });
});

/**
 * Tests for detectSentinel - the flexible, case-insensitive sentinel detector
 * used for patch validation and table cell parsing.
 *
 * This function is more permissive than parseSentinel because it needs to
 * catch all the variations that LLMs might generate.
 */
describe('detectSentinel', () => {
  // Valid sentinel cases that detectSentinel should recognize
  const DETECT_VALID_CASES: [string, { type: 'skip' | 'abort'; reason?: string }][] = [
    // Canonical format (uppercase)
    ['%SKIP%', { type: 'skip' }],
    ['%ABORT%', { type: 'abort' }],
    ['%SKIP% (reason)', { type: 'skip', reason: 'reason' }],
    ['%ABORT% (reason)', { type: 'abort', reason: 'reason' }],

    // Case-insensitive variants (LLM might generate these)
    ['%skip%', { type: 'skip' }],
    ['%abort%', { type: 'abort' }],
    ['%Skip%', { type: 'skip' }],
    ['%Abort%', { type: 'abort' }],
    ['%SKIP% (lowercase)', { type: 'skip', reason: 'lowercase' }],
    ['%skip% (also lowercase)', { type: 'skip', reason: 'also lowercase' }],

    // Compact formats: %SKIP:reason%
    ['%SKIP:not available%', { type: 'skip', reason: 'not available' }],
    ['%ABORT:data error%', { type: 'abort', reason: 'data error' }],
    ['%skip:lowercase%', { type: 'skip', reason: 'lowercase' }],

    // Compact formats: %SKIP(reason)%
    ['%SKIP(inline reason)%', { type: 'skip', reason: 'inline reason' }],
    ['%ABORT(inline reason)%', { type: 'abort', reason: 'inline reason' }],

    // With extra whitespace
    ['  %SKIP%  ', { type: 'skip' }],
    ['  %ABORT%  ', { type: 'abort' }],
    ['%SKIP% (  trimmed reason  )', { type: 'skip', reason: 'trimmed reason' }],

    // Trailing content without parens (still detected)
    ['%SKIP% some text', { type: 'skip' }],
    ['%ABORT% more text', { type: 'abort' }],
  ];

  // Values that should NOT be detected as sentinels
  const DETECT_INVALID_CASES: unknown[] = [
    null,
    undefined,
    '',
    '   ',
    'Hello World',
    'Please skip this step', // "skip" without percent signs
    'Skip this',
    123, // number
    { key: 'value' }, // object
    ['array'], // array
    '%NOTASKIP%',
    '%SKIP', // missing closing %
    'SKIP%', // missing opening %
  ];

  it.each(DETECT_VALID_CASES)('detects "%s" correctly', (input, expected) => {
    expect(detectSentinel(input)).toEqual(expected);
  });

  it.each(DETECT_INVALID_CASES)('returns null for: %j', (input) => {
    expect(detectSentinel(input)).toBeNull();
  });

  it('handles non-string values safely', () => {
    expect(detectSentinel(123)).toBeNull();
    expect(detectSentinel(null)).toBeNull();
    expect(detectSentinel(undefined)).toBeNull();
    expect(detectSentinel({ foo: 'bar' })).toBeNull();
    expect(detectSentinel(['%SKIP%'])).toBeNull();
    expect(detectSentinel(true)).toBeNull();
  });
});
