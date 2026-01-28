/**
 * URL formatting utilities for display and markdown output.
 */

/**
 * Extract the domain (hostname) from a URL.
 * Returns the original string if parsing fails.
 *
 * @param url - The URL to extract the domain from
 * @returns The domain (e.g., "example.com") or the original string if invalid
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    // If URL parsing fails, try to extract domain-like pattern
    const match = /^(?:https?:\/\/)?(?:www\.)?([^/\s]+)/i.exec(url);
    if (match?.[1]) {
      return match[1];
    }
    // Return original if we can't extract a domain
    return url;
  }
}

/**
 * Create a friendly abbreviated display name for a URL.
 * - Drops "www." prefix from domain
 * - Adds first portion of path (up to maxPathChars) if present
 * - Adds ellipsis (…) if path is truncated
 *
 * @param url - The URL to abbreviate
 * @param maxPathChars - Maximum characters to include from the path (default: 12)
 * @returns Friendly abbreviated URL (e.g., "example.com/docs/api…")
 */
export function friendlyUrlAbbrev(url: string, maxPathChars = 12): string {
  try {
    const parsed = new URL(url);
    // Remove www. prefix from hostname
    let hostname = parsed.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }

    // Get path without leading slash, excluding query string and hash
    const path = parsed.pathname.slice(1);
    if (!path) {
      return hostname;
    }

    // Include path up to maxPathChars
    if (path.length <= maxPathChars) {
      return `${hostname}/${path}`;
    }

    // Truncate path and add ellipsis
    return `${hostname}/${path.slice(0, maxPathChars)}…`;
  } catch {
    // If URL parsing fails, try basic cleanup
    let result = url;
    // Remove protocol
    result = result.replace(/^https?:\/\//, '');
    // Remove www.
    result = result.replace(/^www\./, '');
    // Truncate if too long
    const maxLen = 30;
    if (result.length > maxLen) {
      return result.slice(0, maxLen) + '…';
    }
    return result;
  }
}

/**
 * Format a URL as a markdown link with a friendly abbreviated display text.
 * The full URL is preserved as the link target.
 *
 * @param url - The URL to format
 * @returns Markdown link in format [friendly-abbrev](url)
 */
export function formatUrlAsMarkdownLink(url: string): string {
  const display = friendlyUrlAbbrev(url);
  return `[${display}](${url})`;
}

/**
 * Check if a string looks like a URL.
 *
 * @param str - The string to check
 * @returns true if the string appears to be a URL
 */
export function isUrl(str: string): boolean {
  // Check for common URL patterns
  if (str.startsWith('http://') || str.startsWith('https://')) {
    return true;
  }
  // Check for www. prefix
  if (str.startsWith('www.')) {
    return true;
  }
  return false;
}

/**
 * Format bare URLs in text as HTML links with abbreviated display text.
 * Also handles markdown-style links [text](url) for consistency.
 *
 * Processing order:
 * 1. Escape all HTML to prevent XSS
 * 2. Convert markdown links [text](url) to <a> tags
 * 3. Convert bare URLs (not already in links) to <a> tags with abbreviated display
 *
 * @param text - The raw text containing URLs (will be HTML-escaped)
 * @param escapeHtml - Function to escape HTML entities
 * @returns HTML-safe text with URLs converted to <a> tags
 */
export function formatBareUrlsAsHtmlLinks(text: string, escapeHtml: (s: string) => string): string {
  // SECURITY: Escape the entire text first to prevent XSS
  let result = escapeHtml(text);

  // Convert markdown links [text](url) to <a> tags
  // After escaping, we need to unescape &amp; back to & for URLs
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText: string, url: string) => {
    const cleanUrl = url.replace(/&amp;/g, '&');
    return `<a href="${escapeHtml(cleanUrl)}" target="_blank" class="url-link" data-url="${escapeHtml(cleanUrl)}">${linkText}</a>`;
  });

  // Convert bare URLs to <a> tags with abbreviated display
  // Uses negative lookbehind to skip URLs already inside href="" or data-url=""
  // Pattern matches http://, https://, www. URLs not preceded by link attributes
  result = result.replace(
    /(?<!href="|data-url=")(?:https?:\/\/|www\.)[^\s<>"]+(?<![.,;:!?'")])/g,
    (url: string) => {
      // Unescape &amp; back to & for the actual URL
      const cleanUrl = url.replace(/&amp;/g, '&');
      // Normalize www. URLs to have https://
      const fullUrl = cleanUrl.startsWith('www.') ? `https://${cleanUrl}` : cleanUrl;
      const display = friendlyUrlAbbrev(fullUrl);
      return `<a href="${escapeHtml(fullUrl)}" target="_blank" class="url-link" data-url="${escapeHtml(fullUrl)}">${escapeHtml(display)}</a>`;
    },
  );

  return result;
}
