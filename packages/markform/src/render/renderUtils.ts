/**
 * Rendering utility functions for HTML generation.
 *
 * Pure utility functions used across all renderers. No CLI or server dependencies.
 */

/**
 * Escape HTML special characters.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format milliseconds as human-readable duration.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format a rate value with appropriate significant figures.
 * >= 10s: 1 decimal (e.g., 12.3s/field)
 * >= 1s: 2 decimals (e.g., 3.45s/field)
 * < 1s: show as ms (e.g., 450ms/field)
 */
export function formatRate(ms: number, unit: string): string {
  const seconds = ms / 1000;
  if (seconds >= 10) {
    return `${seconds.toFixed(1)}s/${unit}`;
  }
  if (seconds >= 1) {
    return `${seconds.toFixed(2)}s/${unit}`;
  }
  return `${Math.round(ms)}ms/${unit}`;
}

/**
 * Format token count with K suffix for large numbers.
 */
export function formatTokens(count: number): string {
  if (count >= 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toLocaleString();
}
