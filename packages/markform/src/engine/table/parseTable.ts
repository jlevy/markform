/**
 * Table Parsing for Markform Table Fields.
 *
 * Parses Markdoc AST table nodes into structured data, handling escaping and sentinel values.
 */

import Markdoc from '@markdoc/markdoc';
import type { Node } from '@markdoc/markdoc';
import { parseSentinel } from '../parseSentinels.js';

// =============================================================================
// Types
// =============================================================================

/** Result of parsing a markdown table */
export interface ParseTableResult {
  headers: string[];
  rows: string[][];
}

// =============================================================================
// Markdown Table Parsing
// =============================================================================

/**
 * Parse Markdoc AST table nodes into headers and rows.
 * Extracts text content from the node and parses it using Markdoc.
 */
export function parseMarkdownTable(node: Node): ParseTableResult {
  // Extract text content from the node (similar to extractOptionItems)
  const content = extractTextContent(node);

  if (!content.trim()) {
    return { headers: [], rows: [] };
  }

  // Parse the content using Markdoc
  const ast = Markdoc.parse(content);
  const headers: string[] = [];
  const rows: string[][] = [];

  // Traverse the parsed AST to extract table data
  traverseTable(ast, headers, rows);

  return { headers, rows };
}

/**
 * Extract text content from a Markdoc node tree.
 */
function extractTextContent(node: Node): string {
  let content = '';

  function collectText(n: Node): void {
    if (!n || typeof n !== 'object') return;

    // Text nodes have content in attributes
    if (n.type === 'text' && typeof n.attributes?.content === 'string') {
      content += n.attributes.content;
    }

    // Softbreak is a newline
    if (n.type === 'softbreak') {
      content += '\n';
    }

    // Recurse into children
    if (n.children && Array.isArray(n.children)) {
      for (const c of n.children) {
        collectText(c);
      }
    }
  }

  collectText(node);
  return content;
}

/**
 * Traverse Markdoc AST to extract table data.
 */
function traverseTable(node: Node, headers: string[], rows: string[][]): void {
  if (!node || typeof node !== 'object') return;

  // Look for table node
  if (node.type === 'table') {
    // Find thead and tbody
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        if (child.type === 'thead') {
          extractHeaderRow(child, headers);
        } else if (child.type === 'tbody') {
          extractBodyRows(child, rows);
        }
      }
    }
  }

  // Recurse into children for nested structures
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      traverseTable(child, headers, rows);
    }
  }
}

/**
 * Extract header row from thead.
 */
function extractHeaderRow(node: Node, headers: string[]): void {
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child.type === 'tr') {
        const rowHeaders = extractRowCells(child);
        headers.push(...rowHeaders);
        break; // Only take first header row
      }
    }
  }
}

/**
 * Extract data rows from tbody.
 */
function extractBodyRows(node: Node, rows: string[][]): void {
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child.type === 'tr') {
        const rowCells = extractRowCells(child);
        if (rowCells.length > 0) {
          rows.push(rowCells);
        }
      }
    }
  }
}

/**
 * Extract cell content from a table row.
 */
function extractRowCells(node: Node): string[] {
  const cells: string[] = [];

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child.type === 'td' || child.type === 'th') {
        const content = extractCellContent(child);
        cells.push(content);
      }
    }
  }

  return cells;
}

/**
 * Extract text content from a table cell.
 */
function extractCellContent(node: Node): string {
  let content = '';

  function collectText(n: Node): void {
    if (!n || typeof n !== 'object') return;

    // Text nodes have content in attributes or directly
    if (n.type === 'text' || n.type === 'inline') {
      if (typeof n.attributes?.content === 'string') {
        content += n.attributes.content;
      }
    }

    // Recurse into children
    if (n.children && Array.isArray(n.children)) {
      for (const c of n.children) {
        collectText(c);
      }
    }
  }

  collectText(node);
  return content.trim();
}

// =============================================================================
// Cell Value Escaping/Unescaping
// =============================================================================

/**
 * Escape special characters in table cell values for serialization.
 * Follows markdown table escaping rules.
 */
export function escapeTableCell(value: string): string {
  // Reject newlines and control characters
  if (value.includes('\n') || value.includes('\r')) {
    throw new Error('Cell value cannot contain newlines');
  }
  // Check for control characters (0x00-0x1F except \t and \n)
  for (let i = 0; i < value.length; i++) {
    const charCode = value.charCodeAt(i);
    if (charCode < 32 && charCode !== 9) {
      // Allow tab (9), reject others
      throw new Error('Cell value contains invalid control characters');
    }
  }

  // Escape backslash-before-pipe first, then standalone pipes
  return value.replace(/\\\|/g, '\\\\|').replace(/\|/g, '\\|');
}

/**
 * Unescape markdown table cell values for parsing.
 * Reverses the escaping done during serialization.
 */
export function unescapeTableCell(escaped: string): string {
  // Reverse: unescape \\| → \| and \| → |
  const placeholder = 'ESCAPED_BACKSLASH_PIPE_PLACEHOLDER';
  return escaped
    .replace(/\\\\\|/g, placeholder)
    .replace(/\\\|/g, '|')
    .replace(new RegExp(placeholder, 'g'), '\\|');
}

// =============================================================================
// Cell Value Parsing with Sentinels
// =============================================================================

/**
 * Parse a cell value, checking for sentinel patterns first.
 * Returns the parsed cell response or raw value.
 */
export function parseTableCell(
  cellText: string,
  columnType: string,
): { state: 'answered' | 'skipped' | 'aborted'; value?: string | number | null; reason?: string } {
  // Check for sentinel pattern first
  const sentinel = parseSentinel(cellText);
  if (sentinel) {
    return {
      state: sentinel.type === 'skip' ? 'skipped' : 'aborted',
      reason: sentinel.reason,
    };
  }

  // Not a sentinel, parse as typed value
  const trimmed = cellText.trim();
  if (trimmed === '') {
    // Empty cells represent null values (no value provided)
    return { state: 'answered', value: null };
  }

  // Parse according to column type
  const value = parseTypedValue(trimmed, columnType);
  return { state: 'answered', value };
}

/**
 * Parse a string value according to column type.
 */
function parseTypedValue(value: string, type: string): string | number {
  switch (type) {
    case 'string':
      return value;
    case 'number': {
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`Invalid number: "${value}"`);
      }
      return num;
    }
    case 'url': {
      try {
        new URL(value);
        return value;
      } catch {
        throw new Error(`Invalid URL: "${value}"`);
      }
    }
    case 'date': {
      // Basic ISO date validation (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`Invalid date format: "${value}". Use YYYY-MM-DD.`);
      }
      // Could add more validation here
      return value;
    }
    case 'year': {
      const year = parseInt(value, 10);
      if (isNaN(year) || year < 1000 || year > 9999) {
        throw new Error(`Invalid year: "${value}". Must be 4-digit year.`);
      }
      return year;
    }
    default:
      throw new Error(`Unknown column type: "${type}"`);
  }
}
