/**
 * Low-level utilities for extracting heading information from markdown.
 *
 * This module provides functions to find headings and determine which headings
 * enclose a given position. Used by plan documents and ID injection.
 */

import type { SourceRange } from '../engine/coreTypes.js';

/**
 * Information about a markdown heading.
 */
export interface HeadingInfo {
  /** Heading level (1-6 for h1-h6) */
  level: number;

  /** Heading text content (without # prefix) */
  title: string;

  /** Line number (1-indexed) where heading starts */
  line: number;

  /** Full source position */
  position: SourceRange;
}

// ATX heading pattern: 1-6 # chars, space, then title
const ATX_HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;

/**
 * Find all headings in a markdown document.
 * Returns headings in document order.
 *
 * Only ATX-style headings (# Title) are recognized.
 * Headings inside fenced code blocks are ignored.
 */
export function findAllHeadings(markdown: string): HeadingInfo[] {
  const lines = markdown.split('\n');
  const headings: HeadingInfo[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNumber = i + 1; // 1-indexed

    // Track code block state
    if (line.startsWith('```') || line.startsWith('~~~')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Skip if inside code block
    if (inCodeBlock) {
      continue;
    }

    // Check for ATX heading
    const match = ATX_HEADING_PATTERN.exec(line);
    if (match) {
      const hashes = match[1] ?? '';
      const title = (match[2] ?? '').trim();

      headings.push({
        level: hashes.length,
        title,
        line: lineNumber,
        position: {
          start: { line: lineNumber, col: 1 },
          end: { line: lineNumber, col: line.length + 1 },
        },
      });
    }
  }

  return headings;
}

/**
 * Find all headings that enclose a given line position.
 * Returns headings from innermost (most specific) to outermost (least specific).
 *
 * A heading "encloses" a line if:
 * 1. The heading appears before the line
 * 2. No heading of equal or higher level appears between them
 *
 * @param markdown - The markdown source text
 * @param line - The line number (1-indexed)
 * @returns Array of enclosing headings, innermost first
 */
export function findEnclosingHeadings(markdown: string, line: number): HeadingInfo[] {
  if (line <= 0) {
    return [];
  }

  const allHeadings = findAllHeadings(markdown);

  // Filter to headings that appear before this line (not on the line)
  const precedingHeadings = allHeadings.filter((h) => h.line < line);

  if (precedingHeadings.length === 0) {
    return [];
  }

  // Build the enclosing headings list
  // Walk backwards through preceding headings and collect those that aren't
  // "shadowed" by a heading of equal or higher level
  const result: HeadingInfo[] = [];
  let minLevelSeen = Infinity;

  for (let i = precedingHeadings.length - 1; i >= 0; i--) {
    const heading = precedingHeadings[i];
    if (!heading) continue;

    // If this heading is at a higher level (smaller number) than any we've seen,
    // it encloses the position
    if (heading.level < minLevelSeen) {
      result.push(heading);
      minLevelSeen = heading.level;
    }
  }

  return result;
}
