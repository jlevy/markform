/**
 * Low-level parsing utilities for Markdoc AST processing.
 *
 * This module provides helper functions for extracting attributes and content
 * from Markdoc AST nodes. These are used by the field parsers and form parser.
 */

import type { Node } from '@markdoc/markdoc';

import type { CheckboxValue, ValidatorRef } from './coreTypes.js';

// =============================================================================
// Error Types
// =============================================================================

/** Parse error with source location info */
export class ParseError extends Error {
  constructor(
    message: string,
    public readonly line?: number,
    public readonly col?: number,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

// =============================================================================
// Checkbox Marker Parsing
// =============================================================================

/** Map checkbox marker to state value */
export const CHECKBOX_MARKERS: Record<string, CheckboxValue> = {
  '[ ]': 'todo',
  '[x]': 'done',
  '[X]': 'done',
  '[/]': 'incomplete',
  '[*]': 'active',
  '[-]': 'na',
  '[y]': 'yes',
  '[Y]': 'yes',
  '[n]': 'no',
  '[N]': 'no',
};

// Regex to extract checkbox marker and label from text content
// Text is like "[ ] Label" or "[x] Label"
const OPTION_TEXT_PATTERN = /^(\[[^\]]\])\s*(.*?)\s*$/;

export interface ParsedMarkerText {
  marker: string;
  label: string;
}

/**
 * Parse option text to extract marker and label.
 * Text is like "[ ] Label" or "[x] Label".
 */
export function parseOptionText(text: string): ParsedMarkerText | null {
  const match = OPTION_TEXT_PATTERN.exec(text);
  if (!match) {
    return null;
  }

  const marker = match[1] ?? '';
  const label = (match[2] ?? '').trim();

  return { marker, label };
}

// =============================================================================
// Markdoc Tag Processing
// =============================================================================

/**
 * Check if a node is a tag node with specific name.
 * Works with raw AST nodes (not transformed Tags).
 */
export function isTagNode(node: Node, name?: string): boolean {
  if (typeof node !== 'object' || node === null) {
    return false;
  }
  if (node.type === 'tag' && node.tag) {
    return name === undefined || node.tag === name;
  }
  return false;
}

/**
 * Get string attribute value or undefined.
 */
export function getStringAttr(node: Node, name: string): string | undefined {
  const value: unknown = node.attributes?.[name];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Get number attribute value or undefined.
 */
export function getNumberAttr(node: Node, name: string): number | undefined {
  const value: unknown = node.attributes?.[name];
  return typeof value === 'number' ? value : undefined;
}

/**
 * Get boolean attribute value or undefined.
 */
export function getBooleanAttr(node: Node, name: string): boolean | undefined {
  const value: unknown = node.attributes?.[name];
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Get validator references from validate attribute.
 * Handles both single string and array formats.
 */
export function getValidateAttr(node: Node): ValidatorRef[] | undefined {
  const value: unknown = node.attributes?.validate;
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value as ValidatorRef[];
  }
  if (typeof value === 'string') {
    return [value];
  }
  if (typeof value === 'object') {
    // Single object validator ref like { id: "foo", param: 1 }
    return [value as ValidatorRef];
  }
  return undefined;
}

/**
 * Get string array attribute value or undefined.
 * Handles both single string (converts to array) and array formats.
 */
export function getStringArrayAttr(node: Node, name: string): string[] | undefined {
  const value: unknown = node.attributes?.[name];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    // Filter to only strings
    const strings = value.filter((v): v is string => typeof v === 'string');
    return strings.length > 0 ? strings : undefined;
  }
  if (typeof value === 'string') {
    return [value];
  }
  return undefined;
}

/**
 * Parsed option item from AST.
 */
export interface ParsedOptionItem {
  /** ID from {% #id %} annotation */
  id: string | null;
  /** Text content (e.g., "[ ] Label" or "[x] Label") */
  text: string;
}

/**
 * Extract option items from node children (for option lists).
 * Works with raw AST nodes. Collects text and ID from list items.
 */
export function extractOptionItems(node: Node): ParsedOptionItem[] {
  const items: ParsedOptionItem[] = [];

  /**
   * Collect all text content from a node tree into a single string.
   */
  function collectText(n: Node): string {
    let text = '';

    // Text nodes have content in attributes
    if (n.type === 'text' && typeof n.attributes?.content === 'string') {
      text += n.attributes.content;
    }

    // Softbreak is a newline
    if (n.type === 'softbreak') {
      text += '\n';
    }

    // Recurse into children
    if (n.children && Array.isArray(n.children)) {
      for (const c of n.children) {
        text += collectText(c);
      }
    }

    return text;
  }

  /**
   * Traverse to find list items and extract their content.
   */
  function traverse(child: Node): void {
    if (!child || typeof child !== 'object') {
      return;
    }

    // List items contain the option text and ID
    if (child.type === 'item') {
      const text = collectText(child);
      // Markdoc parses {% #id %} as an id attribute on the item
      const id = typeof child.attributes?.id === 'string' ? child.attributes.id : null;
      if (text.trim()) {
        items.push({ id, text: text.trim() });
      }
      return; // Don't recurse further into item children
    }

    // Recurse into children
    if (child.children && Array.isArray(child.children)) {
      for (const c of child.children) {
        traverse(c);
      }
    }
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      traverse(child);
    }
  }

  return items;
}

/**
 * Extract fence value from node children.
 * Looks for ```value code blocks.
 */
export function extractFenceValue(node: Node): string | null {
  function traverse(child: Node): string | null {
    if (!child || typeof child !== 'object') {
      return null;
    }

    // Check if this is a fence node with language="value"
    if (child.type === 'fence') {
      const lang = child.attributes?.language as string | undefined;
      if (lang === 'value') {
        return typeof child.attributes?.content === 'string' ? child.attributes.content : null;
      }
    }

    // Traverse children
    if (child.children && Array.isArray(child.children)) {
      for (const c of child.children) {
        const result = traverse(c);
        if (result !== null) {
          return result;
        }
      }
    }

    return null;
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      const result = traverse(child);
      if (result !== null) {
        return result;
      }
    }
  }

  return null;
}

/**
 * Extract table content from node children.
 * Handles both raw text and Markdoc-parsed table nodes.
 * Reconstructs markdown table format from the AST.
 */
export function extractTableContent(node: Node): string | null {
  const lines: string[] = [];

  function extractTextFromNode(n: Node): string {
    if (!n || typeof n !== 'object') return '';
    if (n.type === 'text' && typeof n.attributes?.content === 'string') {
      return n.attributes.content;
    }
    if (n.children && Array.isArray(n.children)) {
      return n.children.map(extractTextFromNode).join('');
    }
    return '';
  }

  function extractTableRow(trNode: Node): string {
    if (!trNode.children || !Array.isArray(trNode.children)) return '';
    const cells = trNode.children
      .filter((c: Node) => c.type === 'th' || c.type === 'td')
      .map((c: Node) => extractTextFromNode(c).trim());
    return `| ${cells.join(' | ')} |`;
  }

  function processNode(child: Node): void {
    if (!child || typeof child !== 'object') return;

    // Paragraph containing text (like "| Name | Role |")
    if (child.type === 'paragraph' || child.type === 'inline') {
      const text = extractTextFromNode(child).trim();
      if (text) {
        lines.push(text);
      }
      return;
    }

    // Text node directly
    if (child.type === 'text' && typeof child.attributes?.content === 'string') {
      const text = child.attributes.content.trim();
      if (text) {
        lines.push(text);
      }
      return;
    }

    // Markdoc table node - reconstruct as markdown
    if (child.type === 'table') {
      // Process thead
      const thead = child.children?.find((c: Node) => c.type === 'thead');
      if (thead?.children) {
        for (const tr of thead.children.filter((c: Node) => c.type === 'tr')) {
          lines.push(extractTableRow(tr));
        }
      }

      // If we have header rows, add separator
      if (thead?.children?.length) {
        const firstTr = thead.children.find((c: Node) => c.type === 'tr');
        if (firstTr?.children) {
          const colCount = firstTr.children.filter(
            (c: Node) => c.type === 'th' || c.type === 'td',
          ).length;
          const separatorCells = Array(colCount).fill('----');
          lines.push(`| ${separatorCells.join(' | ')} |`);
        }
      }

      // Process tbody
      const tbody = child.children?.find((c: Node) => c.type === 'tbody');
      if (tbody?.children) {
        for (const tr of tbody.children.filter((c: Node) => c.type === 'tr')) {
          lines.push(extractTableRow(tr));
        }
      }
      return;
    }

    // Traverse children for other node types
    if (child.children && Array.isArray(child.children)) {
      for (const c of child.children) {
        processNode(c);
      }
    }
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      processNode(child);
    }
  }

  const result = lines.join('\n').trim();
  return result || null;
}
