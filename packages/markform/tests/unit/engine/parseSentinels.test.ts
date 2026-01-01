/**
 * Unit tests for sentinel value parsing.
 * Uses table-driven tests for comprehensive coverage with minimal code.
 */

import { describe, it, expect } from 'vitest';
import {
  parseSentinel,
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
