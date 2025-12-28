/**
 * Table Serialization for Markform Table Fields.
 *
 * Serializes table field values back to canonical markdown table format.
 */

import { escapeTableCell } from './parseTable.js';
import type { TableField, TableRowResponse } from '../coreTypes.js';

// =============================================================================
// Table Serialization
// =============================================================================

/**
 * Serialize a table field to markdown format.
 */
export function serializeTableField(field: TableField, rows: TableRowResponse[]): string {
  const lines: string[] = [];

  // Build attribute line
  const attrs: string[] = [
    `id="${field.id}"`,
    `label="${field.label}"`,
    `columnIds=[${field.columns.map((c) => `"${c.id}"`).join(', ')}]`,
    `columnLabels=[${field.columns.map((c) => `"${c.label}"`).join(', ')}]`,
  ];

  // Add columnTypes only if not all strings
  const hasNonStringTypes = field.columns.some((c) => c.type !== 'string');
  if (hasNonStringTypes) {
    attrs.push(`columnTypes=[${field.columns.map((c) => `"${c.type}"`).join(', ')}]`);
  }

  // Add other attributes
  if (field.required) attrs.push('required=true');
  if (field.minRows !== undefined) attrs.push(`minRows=${field.minRows}`);
  if (field.maxRows !== undefined) attrs.push(`maxRows=${field.maxRows}`);
  if (field.role !== 'agent') attrs.push(`role="${field.role}"`);
  if (field.priority !== 'medium') attrs.push(`priority="${field.priority}"`);
  if (field.report === false) attrs.push('report=false');

  lines.push(`{% table-field ${attrs.join(' ')} %}`);

  // Header row
  const headers = field.columns.map((c) => c.label);
  lines.push(`| ${headers.join(' | ')} |`);

  // Separator row
  const separators = field.columns.map(() => '---');
  lines.push(`| ${separators.join(' | ')} |`);

  // Data rows
  for (const row of rows) {
    const cells = field.columns.map((column) => {
      const cellResponse = row[column.id];
      return serializeCell(cellResponse);
    });
    lines.push(`| ${cells.join(' | ')} |`);
  }

  lines.push('{% /table-field %}');

  return lines.join('\n');
}

/**
 * Serialize a cell response to string format.
 */
function serializeCell(cell: any): string {
  if (cell.state === 'skipped') {
    return `%SKIP%${cell.reason ? ` (${cell.reason})` : ''}`;
  }
  if (cell.state === 'aborted') {
    return `%ABORT%${cell.reason ? ` (${cell.reason})` : ''}`;
  }
  if (cell.state === 'answered') {
    return escapeTableCell(String(cell.value));
  }
  // unanswered cells shouldn't exist in serialization
  return '';
}
