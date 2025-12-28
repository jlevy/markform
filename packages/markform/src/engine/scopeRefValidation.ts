/**
 * Scope Reference Validation - Schema-aware validation of scope references.
 *
 * Validates parsed scope references against form schema:
 * - Field existence
 * - Option/column existence
 * - Cell bounds checking
 * - Type compatibility (option vs column disambiguation)
 */

import type { FormSchema, Id } from './coreTypes.js';
import type { ParsedScopeRef, ValidateScopeRefResult } from './scopeRef.js';

/**
 * Validate a parsed scope ref against the form schema.
 * Checks that referenced elements exist and are valid for their type.
 */
export function validateScopeRef(
  ref: ParsedScopeRef,
  schema: FormSchema,
  rowCounts?: Record<Id, number>, // for cell bounds checking
): ValidateScopeRefResult {
  // Check field exists
  const field = findField(schema, ref.fieldId);
  if (!field) {
    return { ok: false, error: `Unknown field: "${ref.fieldId}"` };
  }

  switch (ref.type) {
    case 'field':
      return { ok: true, scope: 'field' };

    case 'option': {
      // Check if it's an option (select/checkbox field)
      if (isSelectableField(field.kind)) {
        // Type assertion for selectable fields - we know this is safe due to isSelectableField check
        const selectableField = field as { options: { id: string }[] };
        if (selectableField.options.some((o) => o.id === ref.optionId)) {
          return { ok: true, scope: 'option' };
        }
        const validOptions = selectableField.options.map((o) => o.id).join(', ');
        return {
          ok: false,
          error:
            `Unknown option "${ref.optionId}" in ${field.kind} field "${ref.fieldId}". ` +
            `Valid options: ${validOptions}`,
        };
      }
      // Maybe it's a column? Check if field is a table
      if (field.kind === 'table') {
        // Re-interpret as column ref
        return validateColumnRef(ref.fieldId, ref.optionId, schema);
      }
      return {
        ok: false,
        error:
          `Qualified ref "${ref.fieldId}.${ref.optionId}" invalid: ` +
          `field "${ref.fieldId}" is ${field.kind}, not selectable or table`,
      };
    }

    case 'column': {
      if (field.kind !== 'table') {
        return {
          ok: false,
          error:
            `Column ref "${ref.fieldId}.${ref.columnId}" invalid: ` +
            `field "${ref.fieldId}" is ${field.kind}, not table`,
        };
      }
      return validateColumnRef(ref.fieldId, ref.columnId, schema);
    }

    case 'cell': {
      if (field.kind !== 'table') {
        return {
          ok: false,
          error:
            `Cell ref "${serializeScopeRef(ref)}" invalid: ` +
            `field "${ref.fieldId}" is ${field.kind}, not table`,
        };
      }
      // Validate column exists
      const colResult = validateColumnRef(ref.fieldId, ref.columnId, schema);
      if (!colResult.ok) return colResult;

      // Validate row index bounds (if row counts provided)
      if (rowCounts) {
        const rowCount = rowCounts[ref.fieldId] ?? 0;
        if (ref.rowIndex >= rowCount) {
          return {
            ok: false,
            error:
              `Cell ref "${serializeScopeRef(ref)}" invalid: ` +
              `row index ${ref.rowIndex} out of bounds (table has ${rowCount} rows)`,
          };
        }
      }
      return { ok: true, scope: 'cell' };
    }
  }
}

/** Helper: Check if field kind supports options */
function isSelectableField(kind: string): boolean {
  return kind === 'single_select' || kind === 'multi_select' || kind === 'checkboxes';
}

/** Helper: Find field by ID in schema */
function findField(schema: FormSchema, fieldId: Id) {
  for (const group of schema.groups) {
    for (const field of group.children) {
      if (field.id === fieldId) {
        return field;
      }
    }
  }
  return null;
}

/** Helper: Validate column reference within a table field */
function validateColumnRef(fieldId: Id, columnId: Id, schema: FormSchema): ValidateScopeRefResult {
  // Find the table field and check column exists
  for (const group of schema.groups) {
    for (const field of group.children) {
      if (field.id === fieldId && field.kind === 'table') {
        const column = field.columns.find((c) => c.id === columnId);
        if (!column) {
          const validColumns = field.columns.map((c) => c.id).join(', ');
          return {
            ok: false,
            error:
              `Unknown column "${columnId}" in table "${fieldId}". ` +
              `Valid columns: ${validColumns}`,
          };
        }
        return { ok: true, scope: 'column' };
      }
    }
  }
  return { ok: false, error: `Table field "${fieldId}" not found` };
}

/** Helper: Serialize scope ref for error messages */
function serializeScopeRef(ref: ParsedScopeRef): string {
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
