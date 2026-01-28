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
 * Pattern to match bare URLs in text.
 * Matches http://, https://, and www. prefixed URLs.
 * Captures the URL until whitespace or end of string.
 * Excludes trailing punctuation that's likely not part of the URL.
 */
const BARE_URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>[\]()]+(?<![.,;:!?'")])/g;

/**
 * Format bare URLs in text as HTML links with abbreviated display text.
 * Preserves existing markdown links and only converts bare URLs.
 *
 * @param text - The text containing bare URLs (already HTML-escaped)
 * @param escapeHtml - Function to escape HTML entities
 * @returns Text with bare URLs converted to <a> tags
 */
export function formatBareUrlsAsHtmlLinks(text: string, escapeHtml: (s: string) => string): string {
  // First, protect existing markdown links by temporarily replacing them
  // Use a placeholder that won't appear in normal text
  const LINK_PLACEHOLDER = '<<<MDLINK:';
  const LINK_END = ':MDLINK>>>';
  const markdownLinks: string[] = [];
  let protectedText = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, ...args) => {
    const linkText = args[0] as string;
    const url = args[1] as string;
    markdownLinks.push(`[${linkText}](${url})`);
    return `${LINK_PLACEHOLDER}${markdownLinks.length - 1}${LINK_END}`;
  });

  // Now replace bare URLs with HTML links
  protectedText = protectedText.replace(BARE_URL_PATTERN, (url: string) => {
    // Normalize www. URLs to have https://
    const fullUrl = url.startsWith('www.') ? `https://${url}` : url;
    const display = friendlyUrlAbbrev(fullUrl);
    return `<a href="${escapeHtml(fullUrl)}" target="_blank" class="url-link" data-url="${escapeHtml(fullUrl)}">${escapeHtml(display)}</a>`;
  });

  // Restore markdown links
  const placeholderPattern = new RegExp(
    `${LINK_PLACEHOLDER.replace(/[<>]/g, '\\$&')}(\\d+)${LINK_END.replace(/[<>]/g, '\\$&')}`,
    'g',
  );
  protectedText = protectedText.replace(placeholderPattern, (_match, index: string) => {
    return markdownLinks[parseInt(index, 10)]!;
  });

  return protectedText;
}
