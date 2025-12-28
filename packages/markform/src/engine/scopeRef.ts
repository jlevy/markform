/**
 * Scope Reference Parsing and Serialization.
 *
 * Handles parsing and serialization of scope reference strings used in issues and validation.
 *
 * Scope reference formats:
 * - `fieldId` - simple field reference
 * - `fieldId.optionId` - qualified option/column reference (context-dependent)
 * - `fieldId[row].columnId` - cell reference (tables only)
 *
 * The distinction between option and column references is made during resolution
 * with schema context (see scopeRefValidation.ts).
 */

import type { Id } from './coreTypes.js';

// =============================================================================
// Types
// =============================================================================

/** Simple field reference */
export interface FieldScopeRef {
  type: 'field';
  fieldId: Id;
}

/**
 * Qualified reference - could be option or column.
 * Disambiguation happens during resolution with schema context.
 */
export interface QualifiedScopeRef {
  type: 'qualified';
  fieldId: Id;
  qualifierId: Id; // optionId or columnId
}

/** Cell reference - table field specific */
export interface CellScopeRef {
  type: 'cell';
  fieldId: Id;
  row: number; // 0-indexed row number
  columnId: Id;
}

/** Union of all parsed scope reference types */
export type ParsedScopeRef = FieldScopeRef | QualifiedScopeRef | CellScopeRef;

/** Result of parsing a scope reference */
export type ParseScopeRefResult = { ok: true; ref: ParsedScopeRef } | { ok: false; error: string };

// =============================================================================
// Regex Patterns
// =============================================================================

/**
 * Pattern for cell reference: fieldId[row].columnId
 * - fieldId: identifier (letters, digits, underscores, hyphens)
 * - row: non-negative integer
 * - columnId: identifier
 */
const CELL_REF_PATTERN = /^([a-zA-Z_][a-zA-Z0-9_-]*)\[(\d+)\]\.([a-zA-Z_][a-zA-Z0-9_-]*)$/;

/**
 * Pattern for qualified reference: fieldId.qualifierId
 * - fieldId: identifier
 * - qualifierId: identifier (optionId or columnId)
 */
const QUALIFIED_REF_PATTERN = /^([a-zA-Z_][a-zA-Z0-9_-]*)\.([a-zA-Z_][a-zA-Z0-9_-]*)$/;

/**
 * Pattern for simple field reference: fieldId
 * - fieldId: identifier
 */
const FIELD_REF_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

// =============================================================================
// Parsing
// =============================================================================

/**
 * Parse a scope reference string into a structured format.
 *
 * @param refStr - The scope reference string to parse
 * @returns Parsed scope reference or error
 *
 * @example
 * parseScopeRef('myField')
 * // => { ok: true, ref: { type: 'field', fieldId: 'myField' } }
 *
 * parseScopeRef('myField.optA')
 * // => { ok: true, ref: { type: 'qualified', fieldId: 'myField', qualifierId: 'optA' } }
 *
 * parseScopeRef('myTable[2].name')
 * // => { ok: true, ref: { type: 'cell', fieldId: 'myTable', row: 2, columnId: 'name' } }
 */
export function parseScopeRef(refStr: string): ParseScopeRefResult {
  // Trim whitespace
  const trimmed = refStr.trim();

  if (!trimmed) {
    return { ok: false, error: 'Empty scope reference' };
  }

  // Try cell reference first (most specific pattern)
  const cellMatch = CELL_REF_PATTERN.exec(trimmed);
  if (cellMatch) {
    const fieldId = cellMatch[1]!;
    const rowStr = cellMatch[2]!;
    const columnId = cellMatch[3]!;
    const row = parseInt(rowStr, 10);
    if (row < 0 || !Number.isInteger(row)) {
      return { ok: false, error: `Invalid row index: ${rowStr}` };
    }
    return {
      ok: true,
      ref: { type: 'cell', fieldId, row, columnId },
    };
  }

  // Try qualified reference
  const qualifiedMatch = QUALIFIED_REF_PATTERN.exec(trimmed);
  if (qualifiedMatch) {
    const fieldId = qualifiedMatch[1]!;
    const qualifierId = qualifiedMatch[2]!;
    return {
      ok: true,
      ref: { type: 'qualified', fieldId, qualifierId },
    };
  }

  // Try simple field reference
  if (FIELD_REF_PATTERN.test(trimmed)) {
    return {
      ok: true,
      ref: { type: 'field', fieldId: trimmed },
    };
  }

  return { ok: false, error: `Invalid scope reference format: ${refStr}` };
}

// =============================================================================
// Serialization
// =============================================================================

/**
 * Serialize a parsed scope reference back to a string.
 *
 * @param ref - The parsed scope reference
 * @returns Serialized string
 *
 * @example
 * serializeScopeRef({ type: 'field', fieldId: 'myField' })
 * // => 'myField'
 *
 * serializeScopeRef({ type: 'qualified', fieldId: 'myField', qualifierId: 'optA' })
 * // => 'myField.optA'
 *
 * serializeScopeRef({ type: 'cell', fieldId: 'myTable', row: 2, columnId: 'name' })
 * // => 'myTable[2].name'
 */
export function serializeScopeRef(ref: ParsedScopeRef): string {
  switch (ref.type) {
    case 'field':
      return ref.fieldId;
    case 'qualified':
      return `${ref.fieldId}.${ref.qualifierId}`;
    case 'cell':
      return `${ref.fieldId}[${ref.row}].${ref.columnId}`;
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if a scope reference is a cell reference.
 */
export function isCellRef(ref: ParsedScopeRef): ref is CellScopeRef {
  return ref.type === 'cell';
}

/**
 * Check if a scope reference is a qualified reference.
 */
export function isQualifiedRef(ref: ParsedScopeRef): ref is QualifiedScopeRef {
  return ref.type === 'qualified';
}

/**
 * Check if a scope reference is a simple field reference.
 */
export function isFieldRef(ref: ParsedScopeRef): ref is FieldScopeRef {
  return ref.type === 'field';
}

/**
 * Extract the field ID from any scope reference.
 */
export function getFieldId(ref: ParsedScopeRef): Id {
  return ref.fieldId;
}
