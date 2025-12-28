/**
 * Table Validation for Markform Table Fields.
 *
 * Validates table field values against schema constraints.
 */

import { parseTableCell } from './parseTable.js';
import type { TableField, TableValue, CellResponse } from '../coreTypes.js';

// =============================================================================
// Validation Types
// =============================================================================

/** Validation error for table fields */
export interface TableValidationError {
  code: string;
  message: string;
  fieldId: string;
  rowIndex?: number;
  columnId?: string;
}

// =============================================================================
// Table Validation
// =============================================================================

/**
 * Validate a table field value against its schema.
 */
export function validateTableField(field: TableField, value: TableValue): TableValidationError[] {
  const errors: TableValidationError[] = [];

  // Validate row count constraints
  if (field.minRows !== undefined && value.rows.length < field.minRows) {
    errors.push({
      code: 'MIN_ROWS_NOT_MET',
      message: `Table "${field.id}" has ${value.rows.length} rows but requires at least ${field.minRows}.`,
      fieldId: field.id,
    });
  }

  if (field.maxRows !== undefined && value.rows.length > field.maxRows) {
    errors.push({
      code: 'MAX_ROWS_EXCEEDED',
      message: `Table "${field.id}" has ${value.rows.length} rows but maximum is ${field.maxRows}.`,
      fieldId: field.id,
    });
  }

  // Validate each cell
  for (let rowIndex = 0; rowIndex < value.rows.length; rowIndex++) {
    const row = value.rows[rowIndex];
    if (!row) {
      errors.push({
        code: 'ROW_MISSING',
        message: `Row ${rowIndex + 1} is missing from table.`,
        fieldId: field.id,
        rowIndex,
      });
      continue;
    }

    for (const column of field.columns) {
      const cellResponse = row[column.id];
      if (!cellResponse) {
        errors.push({
          code: 'CELL_MISSING',
          message: `Row ${rowIndex + 1} is missing cell for column "${column.id}".`,
          fieldId: field.id,
          rowIndex,
          columnId: column.id,
        });
        continue;
      }

      // Validate cell state and value
      const cellError = validateCell(field.id, column.id, column.type, rowIndex, cellResponse);
      if (cellError) {
        errors.push(cellError);
      }
    }
  }

  return errors;
}

/**
 * Validate a single cell response.
 */
function validateCell(
  fieldId: string,
  columnId: string,
  columnType: string,
  rowIndex: number,
  cellResponse: CellResponse,
): TableValidationError | null {
  // Check for unanswered cells (empty without sentinel)
  if (cellResponse.state === 'unanswered') {
    return {
      code: 'CELL_EMPTY',
      message: `Cell at row ${rowIndex + 1}, column "${columnId}" is empty. Provide a value or use %SKIP%.`,
      fieldId,
      rowIndex,
      columnId,
    };
  }

  // For answered cells, validate the value type
  if (cellResponse.state === 'answered') {
    try {
      // Re-parse the value to validate type
      const testCell = parseTableCell(String(cellResponse.value), columnType);
      if (typeof testCell === 'string') {
        // Type validation failed
        return {
          code: 'CELL_TYPE_MISMATCH',
          message: `Cell "${cellResponse.value}" at row ${rowIndex + 1}, column "${columnId}" is not a valid ${columnType}.`,
          fieldId,
          rowIndex,
          columnId,
        };
      }
    } catch (_error) {
      return {
        code: 'CELL_TYPE_MISMATCH',
        message: `Cell "${cellResponse.value}" at row ${rowIndex + 1}, column "${columnId}" is not a valid ${columnType}.`,
        fieldId,
        rowIndex,
        columnId,
      };
    }
  }

  // Skipped and aborted states are always valid
  return null;
}
