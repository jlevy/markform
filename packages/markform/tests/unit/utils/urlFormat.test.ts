/**
 * Unit tests for URL formatting utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  extractDomain,
  friendlyUrlAbbrev,
  formatUrlAsMarkdownLink,
  formatBareUrlsAsHtmlLinks,
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

  describe('formatBareUrlsAsHtmlLinks', () => {
    // Simple escapeHtml for testing
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    it('converts bare https URL to link', () => {
      const input = 'Check out https://example.com/docs for more info';
      const result = formatBareUrlsAsHtmlLinks(input, escapeHtml);
      expect(result).toContain('<a href="https://example.com/docs"');
      expect(result).toContain('target="_blank"');
      expect(result).toContain('class="url-link"');
      expect(result).toContain('data-url="https://example.com/docs"');
      expect(result).toContain('>example.com/docs</a>');
    });

    it('converts bare http URL to link', () => {
      const input = 'See http://example.com/page';
      const result = formatBareUrlsAsHtmlLinks(input, escapeHtml);
      expect(result).toContain('<a href="http://example.com/page"');
    });

    it('converts www. URL to link with https:// prefix', () => {
      const input = 'Visit www.example.com for details';
      const result = formatBareUrlsAsHtmlLinks(input, escapeHtml);
      expect(result).toContain('<a href="https://www.example.com"');
    });

    it('converts markdown links to HTML links with original text', () => {
      const input = 'See [docs](https://example.com/docs) for more';
      const result = formatBareUrlsAsHtmlLinks(input, escapeHtml);
      // Markdown link converted to <a> tag with original link text
      expect(result).toContain('<a href="https://example.com/docs"');
      expect(result).toContain('>docs</a>');
      // Should not have raw markdown syntax
      expect(result).not.toContain('[docs]');
    });

    it('handles text with both markdown and bare URLs', () => {
      const input = 'See [docs](https://example.com/docs) and also https://other.com/page';
      const result = formatBareUrlsAsHtmlLinks(input, escapeHtml);
      // Markdown link converted to HTML
      expect(result).toContain('<a href="https://example.com/docs"');
      expect(result).toContain('>docs</a>');
      // Bare URL also converted with abbreviated display
      expect(result).toContain('<a href="https://other.com/page"');
      expect(result).toContain('>other.com/page</a>');
    });

    it('handles multiple bare URLs', () => {
      const input = 'https://a.com and https://b.com';
      const result = formatBareUrlsAsHtmlLinks(input, escapeHtml);
      expect(result).toContain('<a href="https://a.com"');
      expect(result).toContain('<a href="https://b.com"');
    });

    it('excludes trailing punctuation from URL', () => {
      const input = 'See https://example.com/page.';
      const result = formatBareUrlsAsHtmlLinks(input, escapeHtml);
      expect(result).toContain('href="https://example.com/page"');
      expect(result).toContain('</a>.');
    });

    it('handles text without any URLs', () => {
      const input = 'Just plain text here';
      const result = formatBareUrlsAsHtmlLinks(input, escapeHtml);
      expect(result).toBe('Just plain text here');
    });

    it('abbreviates long URLs in display text', () => {
      const input = 'See https://example.com/very/long/path/to/resource';
      const result = formatBareUrlsAsHtmlLinks(input, escapeHtml);
      // Full URL in href
      expect(result).toContain('href="https://example.com/very/long/path/to/resource"');
      // Abbreviated display
      expect(result).toContain('>example.com/very/long/pa…</a>');
    });

    it('escapes HTML in non-URL text to prevent XSS', () => {
      const input = '<script>alert("xss")</script> https://example.com';
      const result = formatBareUrlsAsHtmlLinks(input, escapeHtml);
      // Script tag should be escaped
      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<script>');
      // URL should still be converted to link
      expect(result).toContain('<a href="https://example.com"');
    });

    it('escapes HTML in text with img onerror XSS vector', () => {
      const input = '<img onerror=alert(1) src=x> See https://example.com';
      const result = formatBareUrlsAsHtmlLinks(input, escapeHtml);
      // Img tag should be escaped
      expect(result).toContain('&lt;img');
      expect(result).not.toContain('<img');
      // URL should still be converted
      expect(result).toContain('<a href="https://example.com"');
    });

    it('handles URLs with query parameters containing &', () => {
      const input = 'See https://example.com/search?a=1&b=2';
      const result = formatBareUrlsAsHtmlLinks(input, escapeHtml);
      // URL in href should have proper escaping
      expect(result).toContain('href="https://example.com/search?a=1&amp;b=2"');
    });
  });
});
