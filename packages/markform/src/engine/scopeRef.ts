/**
 * Scope Reference Parsing - Parse and serialize scope references for error reporting.
 *
 * Scope references identify specific elements in forms:
 * - "field_id" - field-level reference
 * - "field_id.option_id" - option reference (select/checkbox fields)
 * - "field_id.column_id" - column reference (table fields)
 * - "field_id.column_id[row_index]" - cell reference (table fields)
 */

import type { Id, IssueScope } from './coreTypes.js';

// =============================================================================
// Types
// =============================================================================

/** Parsed scope reference - discriminated union */
export type ParsedScopeRef =
  | { type: 'field'; fieldId: Id }
  | { type: 'option'; fieldId: Id; optionId: Id }
  | { type: 'column'; fieldId: Id; columnId: Id }
  | { type: 'cell'; fieldId: Id; columnId: Id; rowIndex: number };

/** Result of parsing a scope ref string */
export interface ParseScopeRefResult {
  ok: boolean;
  ref?: ParsedScopeRef;
  error?: string;
}

export interface ValidateScopeRefResult {
  ok: boolean;
  scope?: IssueScope;
  error?: string;
}

// =============================================================================
// Regex Patterns
// =============================================================================

const PATTERNS = {
  // field.column[row] - must check first (most specific)
  cell: /^([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\[(\d+)\]$/,
  // field.qualifier - could be option or column (disambiguate later)
  qualified: /^([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)$/,
  // simple field id
  field: /^[a-z][a-z0-9_]*$/,
} as const;

// =============================================================================
// Parsing Functions
// =============================================================================

/**
 * Parse a scope reference string into structured form.
 * This is pure parsing - no schema validation.
 */
export function parseScopeRef(ref: string): ParseScopeRefResult {
  // Try cell pattern first (most specific)
  const cellMatch = PATTERNS.cell.exec(ref);
  if (cellMatch) {
    const [, fieldId, columnId, rowStr] = cellMatch;
    if (!fieldId || !columnId || !rowStr) {
      return { ok: false, error: `Invalid cell reference format: "${ref}"` };
    }
    const rowIndex = parseInt(rowStr, 10);
    if (rowIndex < 0 || !Number.isFinite(rowIndex)) {
      return { ok: false, error: `Invalid row index: ${rowStr}` };
    }
    return { ok: true, ref: { type: 'cell', fieldId, columnId, rowIndex } };
  }

  // Try qualified pattern (option or column - can't tell yet)
  const qualifiedMatch = PATTERNS.qualified.exec(ref);
  if (qualifiedMatch) {
    const [, fieldId, qualifierId] = qualifiedMatch;
    if (!fieldId || !qualifierId) {
      return { ok: false, error: `Invalid qualified reference format: "${ref}"` };
    }
    // Return as 'option' by default; caller uses schema to disambiguate
    return { ok: true, ref: { type: 'option', fieldId, optionId: qualifierId } };
  }

  // Try simple field pattern
  if (PATTERNS.field.test(ref)) {
    return { ok: true, ref: { type: 'field', fieldId: ref } };
  }

  return { ok: false, error: `Invalid scope reference format: "${ref}"` };
}

/**
 * Serialize a parsed scope ref back to string form.
 */
export function serializeScopeRef(ref: ParsedScopeRef): string {
  switch (ref.type) {
    case 'field':
      return ref.fieldId;
    case 'option':
      return `${ref.fieldId}.${ref.optionId}`;
    case 'column':
      return `${ref.fieldId}.${ref.columnId}`;
    case 'cell':
      return `${ref.fieldId}.${ref.columnId}[${ref.rowIndex}]`;
  }
}
