/**
 * Schema-aware Scope Reference Resolution.
 *
 * Resolves parsed scope references against a FormSchema to disambiguate
 * qualified references (option vs column) and validate references exist.
 */

import type { FormSchema, Field, Id, TableField, TableColumn } from './coreTypes.js';
import type { ParsedScopeRef, QualifiedScopeRef, CellScopeRef, FieldScopeRef } from './scopeRef.js';

// =============================================================================
// Types
// =============================================================================

/** Resolved field reference */
export interface ResolvedFieldRef {
  type: 'field';
  field: Field;
}

/** Resolved option reference (for select/checkbox fields) */
export interface ResolvedOptionRef {
  type: 'option';
  field: Field;
  optionId: Id;
}

/** Resolved column reference (for table fields) */
export interface ResolvedColumnRef {
  type: 'column';
  field: TableField;
  column: TableColumn;
}

/** Resolved cell reference (for table fields) */
export interface ResolvedCellRef {
  type: 'cell';
  field: TableField;
  column: TableColumn;
  row: number;
}

/** Union of all resolved scope reference types */
export type ResolvedScopeRef =
  | ResolvedFieldRef
  | ResolvedOptionRef
  | ResolvedColumnRef
  | ResolvedCellRef;

/** Result of resolving a scope reference */
export type ResolveScopeRefResult =
  | { ok: true; resolved: ResolvedScopeRef }
  | { ok: false; error: string };

// =============================================================================
// Helpers
// =============================================================================

/**
 * Find a field by ID in the form schema.
 */
function findField(schema: FormSchema, fieldId: Id): Field | undefined {
  for (const group of schema.groups) {
    for (const field of group.children) {
      if (field.id === fieldId) {
        return field;
      }
    }
  }
  return undefined;
}

/**
 * Check if a field has options (select/checkbox fields).
 */
function hasOptions(field: Field): field is Field & { options: { id: Id }[] } {
  return 'options' in field && Array.isArray(field.options);
}

/**
 * Check if a field is a table field.
 */
function isTableField(field: Field): field is TableField {
  return field.kind === 'table';
}

/**
 * Find an option in a field by ID.
 */
function findOption(field: Field, optionId: Id): { id: Id } | undefined {
  if (!hasOptions(field)) return undefined;
  return field.options.find((opt) => opt.id === optionId);
}

/**
 * Find a column in a table field by ID.
 */
function findColumn(field: TableField, columnId: Id): TableColumn | undefined {
  return field.columns.find((col) => col.id === columnId);
}

// =============================================================================
// Resolution
// =============================================================================

/**
 * Resolve a field reference against the schema.
 */
function resolveFieldRef(schema: FormSchema, ref: FieldScopeRef): ResolveScopeRefResult {
  const field = findField(schema, ref.fieldId);
  if (!field) {
    return { ok: false, error: `Field '${ref.fieldId}' not found` };
  }
  return { ok: true, resolved: { type: 'field', field } };
}

/**
 * Resolve a qualified reference against the schema.
 * Disambiguates between option and column references based on field kind.
 */
function resolveQualifiedRef(schema: FormSchema, ref: QualifiedScopeRef): ResolveScopeRefResult {
  const field = findField(schema, ref.fieldId);
  if (!field) {
    return { ok: false, error: `Field '${ref.fieldId}' not found` };
  }

  // Check if it's a table field - try column first
  if (isTableField(field)) {
    const column = findColumn(field, ref.qualifierId);
    if (column) {
      return { ok: true, resolved: { type: 'column', field, column } };
    }
    return {
      ok: false,
      error: `Column '${ref.qualifierId}' not found in table field '${ref.fieldId}'`,
    };
  }

  // Check if it's a field with options
  if (hasOptions(field)) {
    const option = findOption(field, ref.qualifierId);
    if (option) {
      return { ok: true, resolved: { type: 'option', field, optionId: ref.qualifierId } };
    }
    return {
      ok: false,
      error: `Option '${ref.qualifierId}' not found in field '${ref.fieldId}'`,
    };
  }

  return {
    ok: false,
    error: `Field '${ref.fieldId}' does not support qualified references (not a table or option field)`,
  };
}

/**
 * Resolve a cell reference against the schema.
 * Note: Row bounds are not validated here (requires value context).
 */
function resolveCellRef(schema: FormSchema, ref: CellScopeRef): ResolveScopeRefResult {
  const field = findField(schema, ref.fieldId);
  if (!field) {
    return { ok: false, error: `Field '${ref.fieldId}' not found` };
  }

  if (!isTableField(field)) {
    return {
      ok: false,
      error: `Cell references are only valid for table fields, but '${ref.fieldId}' is a ${field.kind} field`,
    };
  }

  const column = findColumn(field, ref.columnId);
  if (!column) {
    return {
      ok: false,
      error: `Column '${ref.columnId}' not found in table field '${ref.fieldId}'`,
    };
  }

  // Row validation would require value context - just validate non-negative here
  if (ref.row < 0) {
    return { ok: false, error: `Invalid row index: ${ref.row}` };
  }

  return {
    ok: true,
    resolved: { type: 'cell', field, column, row: ref.row },
  };
}

/**
 * Resolve a parsed scope reference against a form schema.
 *
 * @param schema - The form schema to resolve against
 * @param ref - The parsed scope reference to resolve
 * @returns Resolved reference or error
 *
 * @example
 * resolveScopeRef(schema, { type: 'qualified', fieldId: 'myTable', qualifierId: 'name' })
 * // => { ok: true, resolved: { type: 'column', field: {...}, column: {...} } }
 */
export function resolveScopeRef(schema: FormSchema, ref: ParsedScopeRef): ResolveScopeRefResult {
  switch (ref.type) {
    case 'field':
      return resolveFieldRef(schema, ref);
    case 'qualified':
      return resolveQualifiedRef(schema, ref);
    case 'cell':
      return resolveCellRef(schema, ref);
  }
}

/**
 * Validate that a cell reference row is within bounds.
 * Requires actual table value to check bounds.
 *
 * @param ref - The resolved cell reference
 * @param rowCount - The current number of rows in the table
 * @returns true if valid, error message if invalid
 */
export function validateCellRowBounds(ref: ResolvedCellRef, rowCount: number): true | string {
  if (ref.row < 0) {
    return `Row index ${ref.row} is negative`;
  }
  if (ref.row >= rowCount) {
    return `Row index ${ref.row} is out of bounds (table has ${rowCount} rows)`;
  }
  return true;
}
