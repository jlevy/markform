/**
 * Markdown Table Parsing for Table Fields.
 *
 * Parses GFM-style pipe tables from markdown content within table-field tags.
 * Handles cell value parsing with type coercion and sentinel detection.
 */

import type {
  TableColumn,
  ColumnTypeName,
  CellResponse,
  TableRowResponse,
  TableValue,
  Id,
} from '../coreTypes.js';

// =============================================================================
// Types
// =============================================================================

/** Result of parsing a markdown table */
export type ParseTableResult = { ok: true; value: TableValue } | { ok: false; error: string };

/** Parsed raw table structure before type coercion */
export interface ParsedRawTable {
  headers: string[];
  rows: string[][];
}

// =============================================================================
// Sentinel Detection
// =============================================================================

/** Sentinel pattern: %SKIP% or %SKIP:reason% or %SKIP(reason)% */
const SKIP_PATTERN = /^%SKIP(?:[:(](.*))?[)]?%$/i;

/** Sentinel pattern: %ABORT% or %ABORT:reason% or %ABORT(reason)% */
const ABORT_PATTERN = /^%ABORT(?:[:(](.*))?[)]?%$/i;

/**
 * Detect if a cell value is a sentinel.
 */
function parseSentinel(value: string): { type: 'skip' | 'abort'; reason?: string } | null {
  const trimmed = value.trim();

  const skipMatch = SKIP_PATTERN.exec(trimmed);
  if (skipMatch) {
    return { type: 'skip', reason: skipMatch[1] };
  }

  const abortMatch = ABORT_PATTERN.exec(trimmed);
  if (abortMatch) {
    return { type: 'abort', reason: abortMatch[1] };
  }

  return null;
}

// =============================================================================
// Cell Value Parsing
// =============================================================================

/**
 * Parse a cell value according to its column type.
 * Returns a CellResponse with appropriate state.
 */
export function parseCellValue(rawValue: string, columnType: ColumnTypeName): CellResponse {
  const trimmed = rawValue.trim();

  // Check for empty cell
  if (!trimmed) {
    return { state: 'skipped' };
  }

  // Check for sentinels
  const sentinel = parseSentinel(trimmed);
  if (sentinel) {
    return {
      state: sentinel.type === 'skip' ? 'skipped' : 'aborted',
      reason: sentinel.reason,
    };
  }

  // Parse based on column type
  switch (columnType) {
    case 'string':
      return { state: 'answered', value: trimmed };

    case 'number': {
      const num = parseFloat(trimmed);
      if (isNaN(num)) {
        // Invalid number - treat as string but this will fail validation
        return { state: 'answered', value: trimmed };
      }
      return { state: 'answered', value: num };
    }

    case 'url':
      // Basic URL validation - more thorough validation happens in validate.ts
      return { state: 'answered', value: trimmed };

    case 'date':
      // Date format validation - more thorough validation happens in validate.ts
      return { state: 'answered', value: trimmed };

    case 'year': {
      const year = parseInt(trimmed, 10);
      if (isNaN(year) || !Number.isInteger(year)) {
        // Invalid year - treat as string but this will fail validation
        return { state: 'answered', value: trimmed };
      }
      return { state: 'answered', value: year };
    }
  }
}

// =============================================================================
// Raw Table Parsing
// =============================================================================

/**
 * Parse markdown table structure without type coercion.
 * Handles GFM pipe table format.
 */
export function parseRawMarkdownTable(content: string): ParseTableResult {
  const lines = content
    .trim()
    .split('\n')
    .filter((line) => line.trim());

  if (lines.length < 2) {
    // Empty table or just header is ok
    if (lines.length === 0) {
      return { ok: true, value: { kind: 'table', rows: [] } };
    }
    // Just header row without separator
    return { ok: false, error: 'Table must have at least a header and separator row' };
  }

  // Parse header row
  const headerLine = lines[0]!;
  const headers = parseTableRow(headerLine);
  if (headers.length === 0) {
    return { ok: false, error: 'Invalid table header row' };
  }

  // Validate separator row
  const separatorLine = lines[1]!;
  if (!isValidSeparator(separatorLine, headers.length)) {
    return { ok: false, error: 'Invalid table separator row' };
  }

  // Parse data rows
  const dataRows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const row = parseTableRow(lines[i]!);
    // Normalize row length to match headers
    while (row.length < headers.length) {
      row.push('');
    }
    if (row.length > headers.length) {
      row.length = headers.length;
    }
    dataRows.push(row);
  }

  return {
    ok: true,
    value: { kind: 'table', rows: [] }, // Placeholder - actual rows are built with column context
  };
}

/**
 * Parse a table row into cell values.
 * Handles leading/trailing pipes and cell trimming.
 */
function parseTableRow(line: string): string[] {
  let trimmed = line.trim();

  // Remove leading pipe
  if (trimmed.startsWith('|')) {
    trimmed = trimmed.slice(1);
  }

  // Remove trailing pipe
  if (trimmed.endsWith('|')) {
    trimmed = trimmed.slice(0, -1);
  }

  // Split by pipe and trim each cell
  return trimmed.split('|').map((cell) => cell.trim());
}

/**
 * Check if a line is a valid table separator row.
 * Each cell should contain only dashes and optional colons for alignment.
 */
function isValidSeparator(line: string, expectedCols: number): boolean {
  const cells = parseTableRow(line);

  // Must have same number of columns as header
  if (cells.length !== expectedCols) {
    return false;
  }

  // Each cell must match the separator pattern
  const separatorPattern = /^:?-+:?$/;
  return cells.every((cell) => separatorPattern.test(cell.trim()));
}

// =============================================================================
// Full Table Parsing with Schema
// =============================================================================

/**
 * Parse a markdown table with column schema for type coercion.
 *
 * @param content - The markdown table content
 * @param columns - Column definitions from the table field schema
 * @param dataStartLine - Optional line index where data rows start (skips header validation)
 * @returns Parsed table value with typed cells
 */
export function parseMarkdownTable(
  content: string,
  columns: TableColumn[],
  dataStartLine?: number,
): ParseTableResult {
  const lines = content
    .trim()
    .split('\n')
    .filter((line) => line.trim());

  // Empty content - return empty table
  if (lines.length === 0) {
    return { ok: true, value: { kind: 'table', rows: [] } };
  }

  // When dataStartLine is provided, columns were already extracted inline
  // Skip header/separator validation and just parse data rows
  if (dataStartLine !== undefined) {
    const rows: TableRowResponse[] = [];

    for (let i = dataStartLine; i < lines.length; i++) {
      const rawCells = parseTableRow(lines[i]!);
      const row: TableRowResponse = {};

      for (let j = 0; j < columns.length; j++) {
        const column = columns[j]!;
        const rawValue = rawCells[j] ?? '';
        row[column.id] = parseCellValue(rawValue, column.type);
      }

      rows.push(row);
    }

    return { ok: true, value: { kind: 'table', rows } };
  }

  // Standard parsing: header + separator + data rows

  // Need at least header and separator
  if (lines.length < 2) {
    return { ok: false, error: 'Table must have at least a header and separator row' };
  }

  // Parse header row
  const headerLine = lines[0]!;
  const headers = parseTableRow(headerLine);

  // Build column ID to index mapping from headers
  // Headers should match column IDs or labels
  const columnIdToIndex = new Map<Id, number>();

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]!;
    // Find column by ID or label
    const column = columns.find((c) => c.id === header || c.label === header);
    if (column) {
      columnIdToIndex.set(column.id, i);
    }
  }

  // Validate separator row
  const separatorLine = lines[1]!;
  if (!isValidSeparator(separatorLine, headers.length)) {
    return { ok: false, error: 'Invalid table separator row' };
  }

  // Parse data rows
  const rows: TableRowResponse[] = [];

  for (let i = 2; i < lines.length; i++) {
    const rawCells = parseTableRow(lines[i]!);
    const row: TableRowResponse = {};

    // Process each column
    for (const column of columns) {
      const cellIndex = columnIdToIndex.get(column.id);
      const rawValue = cellIndex !== undefined ? (rawCells[cellIndex] ?? '') : '';
      row[column.id] = parseCellValue(rawValue, column.type);
    }

    rows.push(row);
  }

  return { ok: true, value: { kind: 'table', rows } };
}

/**
 * Parse just the raw table structure without schema.
 * Useful for validation and error reporting.
 */
export function parseRawTable(
  content: string,
): { ok: true; headers: string[]; rows: string[][] } | { ok: false; error: string } {
  const lines = content
    .trim()
    .split('\n')
    .filter((line) => line.trim());

  if (lines.length === 0) {
    return { ok: true, headers: [], rows: [] };
  }

  if (lines.length < 2) {
    return { ok: false, error: 'Table must have at least a header and separator row' };
  }

  const headers = parseTableRow(lines[0]!);
  const separatorLine = lines[1]!;

  if (!isValidSeparator(separatorLine, headers.length)) {
    return { ok: false, error: 'Invalid table separator row' };
  }

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const row = parseTableRow(lines[i]!);
    // Normalize row length
    while (row.length < headers.length) {
      row.push('');
    }
    if (row.length > headers.length) {
      row.length = headers.length;
    }
    rows.push(row);
  }

  return { ok: true, headers, rows };
}

// =============================================================================
// Column Extraction from Inline Table
// =============================================================================

/**
 * Result of extracting column definitions from inline table format.
 */
export type ExtractColumnsResult =
  | {
      ok: true;
      columns: TableColumn[];
      dataStartLine: number; // Line index where data rows start (after separator)
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Slugify a label to create a valid column ID.
 * Converts "Start Date" -> "start_date", "Name" -> "name", etc.
 */
function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Check if a cell value looks like a column type definition.
 * Valid formats: "string", "number", "url", "date", "year"
 * With optional ",required" suffix.
 */
function isTypeDefinition(cell: string): boolean {
  const typePattern = /^(string|number|url|date|year)(,required)?$/i;
  return typePattern.test(cell.trim());
}

/**
 * Parse a column type definition cell.
 * Format: "type" or "type,required"
 */
function parseTypeCell(cell: string): { type: ColumnTypeName; required: boolean } {
  const trimmed = cell.trim().toLowerCase();
  const parts = trimmed.split(',');
  const type = parts[0] as ColumnTypeName;
  const required = parts.length > 1 && parts[1] === 'required';
  return { type, required };
}

/**
 * Extract column definitions from inline table format.
 *
 * Supports two formats:
 * 1. Simple format (header + separator + data):
 *    | Name | Age |
 *    |------|-----|
 *    | Alice | 30 |
 *    -> Columns default to type=string, required=false
 *
 * 2. Full format (header + type row + separator + data):
 *    | Name | Age |
 *    | string,required | number |
 *    |------|-----|
 *    | Alice | 30 |
 */
export function extractColumnsFromTable(content: string): ExtractColumnsResult {
  const lines = content
    .trim()
    .split('\n')
    .filter((line) => line.trim());

  if (lines.length < 2) {
    return { ok: false, error: 'Table must have at least a header and separator row' };
  }

  // Parse header row
  const headers = parseTableRow(lines[0]!);
  if (headers.length === 0) {
    return { ok: false, error: 'Invalid table header row' };
  }

  // Check second row - is it a type row or separator?
  const secondRow = parseTableRow(lines[1]!);
  const isSecondRowTypes =
    secondRow.length > 0 && secondRow.every((cell) => isTypeDefinition(cell));

  let typeRow: { type: ColumnTypeName; required: boolean }[] | undefined;
  let separatorLineIndex: number;

  if (isSecondRowTypes) {
    // Second row is type definitions
    if (secondRow.length !== headers.length) {
      return { ok: false, error: 'Type row must have same number of columns as header' };
    }
    typeRow = secondRow.map((cell) => parseTypeCell(cell));
    separatorLineIndex = 2;

    // Validate we have a separator row
    if (lines.length < 3) {
      return { ok: false, error: 'Table with type row must have a separator row' };
    }
    if (!isValidSeparator(lines[2]!, headers.length)) {
      return { ok: false, error: 'Invalid table separator row' };
    }
  } else {
    // Second row should be separator
    if (!isValidSeparator(lines[1]!, headers.length)) {
      return { ok: false, error: 'Invalid table separator row' };
    }
    separatorLineIndex = 1;
  }

  // Build columns
  const columns: TableColumn[] = headers.map((header, i) => {
    const id = slugify(header) || `col${i}`;
    const label = header;
    const typeDef = typeRow?.[i] ?? { type: 'string' as ColumnTypeName, required: false };
    return {
      id,
      label,
      type: typeDef.type,
      required: typeDef.required,
    };
  });

  return {
    ok: true,
    columns,
    dataStartLine: separatorLineIndex + 1,
  };
}

/**
 * Parse a markdown table with columns extracted from inline format.
 * Used when columnIds attribute is not provided.
 */
export function parseInlineTable(content: string): ParseTableResult {
  const extractResult = extractColumnsFromTable(content);
  if (!extractResult.ok) {
    return { ok: false, error: extractResult.error };
  }

  const { columns, dataStartLine } = extractResult;
  const lines = content
    .trim()
    .split('\n')
    .filter((line) => line.trim());

  // Parse data rows
  const rows: TableRowResponse[] = [];
  for (let i = dataStartLine; i < lines.length; i++) {
    const rawCells = parseTableRow(lines[i]!);
    const row: TableRowResponse = {};

    for (let j = 0; j < columns.length; j++) {
      const column = columns[j]!;
      const rawValue = rawCells[j] ?? '';
      row[column.id] = parseCellValue(rawValue, column.type);
    }

    rows.push(row);
  }

  return { ok: true, value: { kind: 'table', rows } };
}
