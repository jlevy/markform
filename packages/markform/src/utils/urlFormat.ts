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
 * Format a URL as a markdown link with the domain as display text.
 * The full URL is preserved as the link target.
 *
 * @param url - The URL to format
 * @returns Markdown link in format [domain](url)
 */
export function formatUrlAsMarkdownLink(url: string): string {
  const domain = extractDomain(url);
  return `[${domain}](${url})`;
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
