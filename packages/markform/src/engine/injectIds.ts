/**
 * ID injection utilities for checkboxes and headers.
 *
 * Provides functions to find checkboxes in markdown and inject ID annotations
 * using generator functions. Used by plan documents and programmatic ID generation.
 */

import type { CheckboxValue, SourceRange } from './coreTypes.js';
import { CHECKBOX_MARKERS } from './parseHelpers.js';
import { findAllHeadings, findEnclosingHeadings } from '../markdown/markdownHeaders.js';
import type { HeadingInfo } from '../markdown/markdownHeaders.js';
import { MarkformParseError } from '../errors.js';

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

/**
 * Options for ID injection.
 */
export interface InjectCheckboxIdsOptions {
  /**
   * Generator function to create IDs for checkboxes.
   * Receives checkbox info and 0-based index of checkboxes needing IDs.
   */
  generator: (info: CheckboxInfo, index: number) => string;

  /**
   * If true (default), only inject IDs for checkboxes missing them.
   * If false, replace all IDs.
   */
  onlyMissing?: boolean;
}

/**
 * Result of ID injection.
 */
export interface InjectIdsResult {
  /** Updated markdown with injected IDs */
  markdown: string;

  /** Number of IDs that were injected */
  injectedCount: number;

  /** Map of checkbox label to injected ID */
  injectedIds: Map<string, string>;
}

/**
 * Inject IDs into checkboxes in a markdown document.
 *
 * Uses a generator function to create unique IDs for each checkbox.
 * Throws if duplicate IDs are generated or if generated IDs conflict
 * with existing ones.
 */
export function injectCheckboxIds(
  markdown: string,
  options: InjectCheckboxIdsOptions,
): InjectIdsResult {
  const { generator, onlyMissing = true } = options;
  const checkboxes = findAllCheckboxes(markdown);

  // Collect existing IDs (to check for conflicts)
  const existingIds = new Set<string>();
  for (const checkbox of checkboxes) {
    if (checkbox.id && onlyMissing) {
      existingIds.add(checkbox.id);
    }
  }

  // Determine which checkboxes need IDs
  const needsId = checkboxes.filter((cb) => (onlyMissing ? !cb.id : true));

  // Generate IDs and check for duplicates/conflicts
  const generatedIds = new Map<string, string>(); // label -> id
  const allGeneratedIds = new Set<string>();

  for (let i = 0; i < needsId.length; i++) {
    const checkbox = needsId[i]!;
    const newId = generator(checkbox, i);

    // Check for duplicate generated IDs
    if (allGeneratedIds.has(newId)) {
      throw new MarkformParseError(
        `Duplicate generated ID '${newId}' for checkbox '${checkbox.label}'`,
        { line: checkbox.line },
      );
    }

    // Check for conflict with existing IDs (only when onlyMissing=true)
    if (onlyMissing && existingIds.has(newId)) {
      throw new MarkformParseError(`Generated ID '${newId}' conflicts with existing ID`, {
        line: checkbox.line,
      });
    }

    allGeneratedIds.add(newId);
    generatedIds.set(checkbox.label, newId);
  }

  // If no changes needed, return original markdown
  if (needsId.length === 0) {
    return {
      markdown,
      injectedCount: 0,
      injectedIds: new Map(),
    };
  }

  // Apply changes to markdown (process in reverse order to preserve line numbers)
  const lines = markdown.split('\n');
  const sortedByLine = [...needsId].sort((a, b) => b.line - a.line);

  for (const checkbox of sortedByLine) {
    const lineIndex = checkbox.line - 1;
    const line = lines[lineIndex]!;
    const newId = generatedIds.get(checkbox.label)!;

    // Remove existing ID annotation if replacing
    let updatedLine = line;
    if (!onlyMissing || checkbox.id) {
      // Remove existing Markdoc ID
      updatedLine = updatedLine.replace(MARKDOC_ID_PATTERN, '').trim();
      // Remove existing HTML comment ID
      updatedLine = updatedLine.replace(HTML_COMMENT_ID_PATTERN, '').trim();
    }

    // Append new ID annotation
    lines[lineIndex] = `${updatedLine} {% #${newId} %}`;
  }

  return {
    markdown: lines.join('\n'),
    injectedCount: needsId.length,
    injectedIds: generatedIds,
  };
}

/**
 * Options for header ID injection.
 */
export interface InjectHeaderIdsOptions {
  /**
   * Generator function to create IDs for headings.
   * Receives heading info and 0-based index of headings needing IDs.
   */
  generator: (info: HeadingInfo, index: number) => string;

  /**
   * If true (default), only inject IDs for headings missing them.
   * If false, replace all IDs.
   */
  onlyMissing?: boolean;

  /**
   * Heading levels to process. Defaults to all levels [1, 2, 3, 4, 5, 6].
   */
  levels?: number[];
}

/**
 * Extended HeadingInfo that includes existing ID if present.
 */
interface HeadingWithId extends HeadingInfo {
  id?: string;
}

/**
 * Find all headings with their existing IDs.
 */
function findAllHeadingsWithIds(markdown: string): HeadingWithId[] {
  const headings = findAllHeadings(markdown);
  const lines = markdown.split('\n');

  return headings.map((heading) => {
    const line = lines[heading.line - 1] ?? '';

    // Check for existing ID annotation
    let id: string | undefined;
    const markdocMatch = MARKDOC_ID_PATTERN.exec(line);
    if (markdocMatch) {
      id = markdocMatch[1];
    } else {
      const htmlMatch = HTML_COMMENT_ID_PATTERN.exec(line);
      if (htmlMatch) {
        id = htmlMatch[1];
      }
    }

    return { ...heading, id };
  });
}

/**
 * Inject IDs into headings in a markdown document.
 *
 * Uses a generator function to create unique IDs for each heading.
 * Throws if duplicate IDs are generated or if generated IDs conflict
 * with existing ones.
 */
export function injectHeaderIds(
  markdown: string,
  options: InjectHeaderIdsOptions,
): InjectIdsResult {
  const { generator, onlyMissing = true, levels = [1, 2, 3, 4, 5, 6] } = options;
  const allHeadings = findAllHeadingsWithIds(markdown);

  // Filter by levels
  const levelSet = new Set(levels);
  const headings = allHeadings.filter((h) => levelSet.has(h.level));

  // Collect existing IDs (to check for conflicts)
  const existingIds = new Set<string>();
  for (const heading of headings) {
    if (heading.id && onlyMissing) {
      existingIds.add(heading.id);
    }
  }

  // Determine which headings need IDs
  const needsId = headings.filter((h) => (onlyMissing ? !h.id : true));

  // Generate IDs and check for duplicates/conflicts
  const generatedIds = new Map<string, string>(); // title -> id
  const allGeneratedIds = new Set<string>();

  for (let i = 0; i < needsId.length; i++) {
    const heading = needsId[i]!;
    const newId = generator(heading, i);

    // Check for duplicate generated IDs
    if (allGeneratedIds.has(newId)) {
      throw new MarkformParseError(
        `Duplicate generated ID '${newId}' for heading '${heading.title}'`,
        { line: heading.line },
      );
    }

    // Check for conflict with existing IDs (only when onlyMissing=true)
    if (onlyMissing && existingIds.has(newId)) {
      throw new MarkformParseError(`Generated ID '${newId}' conflicts with existing ID`, {
        line: heading.line,
      });
    }

    allGeneratedIds.add(newId);
    generatedIds.set(heading.title, newId);
  }

  // If no changes needed, return original markdown
  if (needsId.length === 0) {
    return {
      markdown,
      injectedCount: 0,
      injectedIds: new Map(),
    };
  }

  // Apply changes to markdown (process in reverse order to preserve line numbers)
  const lines = markdown.split('\n');
  const sortedByLine = [...needsId].sort((a, b) => b.line - a.line);

  for (const heading of sortedByLine) {
    const lineIndex = heading.line - 1;
    const line = lines[lineIndex]!;
    const newId = generatedIds.get(heading.title)!;

    // Remove existing ID annotation if replacing
    let updatedLine = line;
    if (!onlyMissing || heading.id) {
      // Remove existing Markdoc ID
      updatedLine = updatedLine.replace(MARKDOC_ID_PATTERN, '').trim();
      // Remove existing HTML comment ID
      updatedLine = updatedLine.replace(HTML_COMMENT_ID_PATTERN, '').trim();
    }

    // Append new ID annotation
    lines[lineIndex] = `${updatedLine} {% #${newId} %}`;
  }

  return {
    markdown: lines.join('\n'),
    injectedCount: needsId.length,
    injectedIds: generatedIds,
  };
}
