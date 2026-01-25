/**
 * ID injection utilities for checkboxes and headers.
 *
 * Provides functions to find checkboxes in markdown and inject ID annotations
 * using generator functions. Used by plan documents and programmatic ID generation.
 */

import type { CheckboxValue, SourceRange } from './coreTypes.js';
import { CHECKBOX_MARKERS } from './parseHelpers.js';
import { findEnclosingHeadings } from '../markdown/markdownHeaders.js';
import type { HeadingInfo } from '../markdown/markdownHeaders.js';

// Re-export HeadingInfo for convenience
export type { HeadingInfo };

/**
 * Information about a checkbox found in markdown.
 */
export interface CheckboxInfo {
  /** Existing ID, if any (from {% #id %} annotation) */
  id?: string;

  /** Checkbox label text */
  label: string;

  /** Current checkbox state from marker */
  state: CheckboxValue;

  /** Line number (1-indexed) where checkbox appears */
  line: number;

  /** Source position of the checkbox line */
  position: SourceRange;

  /** Enclosing headings, innermost first */
  enclosingHeadings: HeadingInfo[];
}

// Pattern to match checkbox list items: optional indent, -, [marker], text
// Captures: 1=indent, 2=marker (including brackets), 3=rest of line
const CHECKBOX_PATTERN = /^(\s*)-\s+(\[[^\]]\])\s+(.*)$/;

// Pattern to extract Markdoc ID annotation: {% #id %}
const MARKDOC_ID_PATTERN = /\{%\s*#(\w+)\s*%\}/;

// Pattern to extract HTML comment ID annotation: <!-- #id -->
const HTML_COMMENT_ID_PATTERN = /<!--\s*#(\w+)\s*-->/;

/**
 * Find all checkboxes in a markdown document.
 * Returns checkboxes in document order with enclosing heading info.
 */
export function findAllCheckboxes(markdown: string): CheckboxInfo[] {
  const lines = markdown.split('\n');
  const checkboxes: CheckboxInfo[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNumber = i + 1; // 1-indexed

    // Track code block state
    if (line.trimStart().startsWith('```') || line.trimStart().startsWith('~~~')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Skip if inside code block
    if (inCodeBlock) {
      continue;
    }

    // Check for checkbox pattern
    const match = CHECKBOX_PATTERN.exec(line);
    if (!match) {
      continue;
    }

    const marker = match[2] ?? '';
    const rest = match[3] ?? '';

    // Get checkbox state from marker
    const state = CHECKBOX_MARKERS[marker];
    if (state === undefined) {
      continue; // Invalid marker
    }

    // Extract label and ID
    let label = rest;
    let id: string | undefined;

    // Check for Markdoc ID annotation
    const markdocMatch = MARKDOC_ID_PATTERN.exec(rest);
    if (markdocMatch) {
      id = markdocMatch[1];
      label = rest.replace(MARKDOC_ID_PATTERN, '').trim();
    } else {
      // Check for HTML comment ID annotation
      const htmlMatch = HTML_COMMENT_ID_PATTERN.exec(rest);
      if (htmlMatch) {
        id = htmlMatch[1];
        label = rest.replace(HTML_COMMENT_ID_PATTERN, '').trim();
      }
    }

    // Get enclosing headings for this line
    const enclosingHeadings = findEnclosingHeadings(markdown, lineNumber);

    checkboxes.push({
      id,
      label,
      state,
      line: lineNumber,
      position: {
        start: { line: lineNumber, col: 1 },
        end: { line: lineNumber, col: line.length + 1 },
      },
      enclosingHeadings,
    });
  }

  return checkboxes;
}
