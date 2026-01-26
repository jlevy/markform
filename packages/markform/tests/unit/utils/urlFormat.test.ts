/**
 * Unit tests for URL formatting utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  extractDomain,
  friendlyUrlAbbrev,
  formatUrlAsMarkdownLink,
  isUrl,
} from '../../../src/utils/urlFormat.js';

describe('urlFormat', () => {
  describe('extractDomain', () => {
    // [input, expected]
    const cases: [string, string][] = [
      ['https://example.com/path', 'example.com'],
      ['http://www.example.com/path', 'www.example.com'],
      ['https://sub.example.com:8080/path', 'sub.example.com'],
      ['example.com/path', 'example.com'],
      // www. is stripped by the regex fallback for non-URL strings
      ['www.example.com/path', 'example.com'],
      // Fallback regex extracts first domain-like pattern
      ['invalid string', 'invalid'],
      ['', ''],
    ];

    it.each(cases)('extractDomain(%s) → %s', (input, expected) => {
      expect(extractDomain(input)).toBe(expected);
    });
  });

  describe('friendlyUrlAbbrev', () => {
    it('returns hostname only for URLs without path', () => {
      expect(friendlyUrlAbbrev('https://example.com')).toBe('example.com');
      expect(friendlyUrlAbbrev('https://example.com/')).toBe('example.com');
    });

    it('removes www. prefix', () => {
      expect(friendlyUrlAbbrev('https://www.example.com')).toBe('example.com');
      expect(friendlyUrlAbbrev('https://www.example.com/docs')).toBe('example.com/docs');
    });

    it('includes short paths in full', () => {
      expect(friendlyUrlAbbrev('https://example.com/docs')).toBe('example.com/docs');
      expect(friendlyUrlAbbrev('https://example.com/api/v1')).toBe('example.com/api/v1');
    });

    it('truncates long paths with ellipsis', () => {
      const result = friendlyUrlAbbrev('https://example.com/this/is/a/very/long/path');
      expect(result).toBe('example.com/this/is/a/ve…');
      expect(result.length).toBeLessThan(30);
    });

    it('respects custom maxPathChars', () => {
      expect(friendlyUrlAbbrev('https://example.com/abcdefghij', 5)).toBe('example.com/abcde…');
      expect(friendlyUrlAbbrev('https://example.com/abcde', 5)).toBe('example.com/abcde');
    });

    it('handles invalid URLs gracefully', () => {
      expect(friendlyUrlAbbrev('not-a-url')).toBe('not-a-url');
      expect(friendlyUrlAbbrev('http://www.example.com')).toBe('example.com');
    });

    it('handles very long invalid strings', () => {
      const longStr = 'a'.repeat(50);
      const result = friendlyUrlAbbrev(longStr);
      expect(result.length).toBeLessThanOrEqual(31); // 30 + ellipsis
    });
  });

  describe('formatUrlAsMarkdownLink', () => {
    it('creates markdown link with friendly display text', () => {
      expect(formatUrlAsMarkdownLink('https://example.com/docs')).toBe(
        '[example.com/docs](https://example.com/docs)',
      );
    });

    it('preserves full URL in href', () => {
      const fullUrl = 'https://www.example.com/very/long/path/to/resource';
      const result = formatUrlAsMarkdownLink(fullUrl);
      expect(result).toContain(`](${fullUrl})`);
    });
  });

  describe('isUrl', () => {
    // [input, expected]
    const cases: [string, boolean][] = [
      ['https://example.com', true],
      ['http://example.com', true],
      ['www.example.com', true],
      ['example.com', false],
      ['not a url', false],
      ['ftp://example.com', false],
      ['', false],
    ];

    it.each(cases)('isUrl(%s) → %s', (input, expected) => {
      expect(isUrl(input)).toBe(expected);
    });
  });
});
