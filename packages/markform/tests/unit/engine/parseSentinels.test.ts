/**
 * Unit tests for sentinel value parsing.
 */

import { describe, it, expect } from 'vitest';
import {
  parseSentinel,
  SENTINEL_SKIP,
  SENTINEL_ABORT,
} from '../../../src/engine/parseSentinels.js';

describe('parseSentinels', () => {
  describe('parseSentinel', () => {
    // Basic skip sentinels
    describe('skip sentinel', () => {
      it('parses plain %SKIP%', () => {
        const result = parseSentinel('%SKIP%');
        expect(result).toEqual({ type: 'skip' });
      });

      it('requires exact case %SKIP%', () => {
        // Case-sensitive: lowercase doesn't match
        const result = parseSentinel('%skip%');
        expect(result).toBeNull();
      });

      it('parses %SKIP% with parenthesized reason', () => {
        const result = parseSentinel('%SKIP%(Not applicable)');
        expect(result).toEqual({ type: 'skip', reason: 'Not applicable' });
      });

      it('parses %SKIP% with space before reason', () => {
        const result = parseSentinel('%SKIP% (out of scope)');
        expect(result).toEqual({ type: 'skip', reason: 'out of scope' });
      });

      it('trims reason whitespace', () => {
        const result = parseSentinel('%SKIP%(  extra spaces  )');
        expect(result).toEqual({ type: 'skip', reason: 'extra spaces' });
      });

      it('returns null for %SKIP% with non-parenthesized content', () => {
        // Invalid format: text after %SKIP% but not in parentheses
        const result = parseSentinel('%SKIP% some reason without parens');
        expect(result).toBeNull();
      });

      it('returns null for %SKIP% with colon-style reason', () => {
        // Old format no longer supported
        const result = parseSentinel('%SKIP:reason%');
        expect(result).toBeNull();
      });
    });

    // Basic abort sentinels
    describe('abort sentinel', () => {
      it('parses plain %ABORT%', () => {
        const result = parseSentinel('%ABORT%');
        expect(result).toEqual({ type: 'abort' });
      });

      it('requires exact case %ABORT%', () => {
        // Case-sensitive: lowercase doesn't match
        const result = parseSentinel('%abort%');
        expect(result).toBeNull();
      });

      it('parses %ABORT% with parenthesized reason', () => {
        const result = parseSentinel('%ABORT%(API error)');
        expect(result).toEqual({ type: 'abort', reason: 'API error' });
      });

      it('parses %ABORT% with space before reason', () => {
        const result = parseSentinel('%ABORT% (network failure)');
        expect(result).toEqual({ type: 'abort', reason: 'network failure' });
      });

      it('trims reason whitespace', () => {
        const result = parseSentinel('%ABORT%(  timeout  )');
        expect(result).toEqual({ type: 'abort', reason: 'timeout' });
      });

      it('returns null for %ABORT% with non-parenthesized content', () => {
        // Invalid format: text after %ABORT% but not in parentheses
        const result = parseSentinel('%ABORT% some reason without parens');
        expect(result).toBeNull();
      });

      it('returns null for %ABORT% with colon-style reason', () => {
        // Old format no longer supported
        const result = parseSentinel('%ABORT:error%');
        expect(result).toBeNull();
      });
    });

    // Non-sentinel values
    describe('non-sentinel values', () => {
      it('returns null for empty string', () => {
        expect(parseSentinel('')).toBeNull();
      });

      it('returns null for null input', () => {
        expect(parseSentinel(null)).toBeNull();
      });

      it('returns null for regular text', () => {
        expect(parseSentinel('Hello World')).toBeNull();
      });

      it('returns null for text containing SKIP', () => {
        expect(parseSentinel('Please SKIP this step')).toBeNull();
      });

      it('returns null for text containing %SKIP', () => {
        expect(parseSentinel('%SKIP without closing')).toBeNull();
      });

      it('returns null for whitespace only', () => {
        expect(parseSentinel('   ')).toBeNull();
      });
    });

    // Edge cases
    describe('edge cases', () => {
      it('handles sentinel with surrounding whitespace', () => {
        const result = parseSentinel('  %SKIP%  ');
        expect(result).toEqual({ type: 'skip' });
      });

      it('rejects mixed case sentinel (case-sensitive)', () => {
        const result = parseSentinel('%Skip%');
        expect(result).toBeNull();
      });

      it('rejects mixed case abort (case-sensitive)', () => {
        const result = parseSentinel('%Abort%');
        expect(result).toBeNull();
      });

      it('handles abort with surrounding whitespace', () => {
        const result = parseSentinel('  %ABORT%  ');
        expect(result).toEqual({ type: 'abort' });
      });
    });
  });

  describe('sentinel constants', () => {
    it('SENTINEL_SKIP is %SKIP%', () => {
      expect(SENTINEL_SKIP).toBe('%SKIP%');
    });

    it('SENTINEL_ABORT is %ABORT%', () => {
      expect(SENTINEL_ABORT).toBe('%ABORT%');
    });
  });
});
