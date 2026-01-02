/**
 * Unified value coercion layer for converting raw input values to typed Patches.
 *
 * This module provides the single source of truth for:
 * - Field lookup by ID (using idIndex for O(1) lookups)
 * - Coercing raw values to typed Patches with validation
 * - Batch coercion of InputContext with warnings/errors
 */

import type {
  CheckboxValue,
  Field,
  OptionId,
  ParsedForm,
  Patch,
  TableRowPatch,
} from './coreTypes.js';

// =============================================================================
// Raw Input Types
// =============================================================================

/** Raw value that can be coerced to a field value. */
export type RawFieldValue = string | number | boolean | string[] | Record<string, unknown> | null;

/** Input context is a map of field IDs to raw values. */
export type InputContext = Record<string, RawFieldValue>;

// =============================================================================
// Coercion Results
// =============================================================================

export type CoercionResult =
  | { ok: true; patch: Patch }
  | { ok: true; patch: Patch; warning: string }
  | { ok: false; error: string };

export interface CoerceInputContextResult {
  patches: Patch[];
  /** Non-fatal warnings (e.g., "coerced '123' to number for field X") */
  warnings: string[];
  /** Fatal errors (e.g., "field 'foo' not found") */
  errors: string[];
}

// =============================================================================
// Field Lookup
// =============================================================================

/**
 * Find a field by ID.
 *
 * Uses idIndex for O(1) validation that the ID exists and is a field,
 * then retrieves the Field object from the schema.
 */
export function findFieldById(form: ParsedForm, fieldId: string): Field | undefined {
  // O(1) check: verify the ID exists and is a field
  const entry = form.idIndex.get(fieldId);
  if (entry?.nodeType !== 'field') {
    return undefined;
  }

  // Retrieve the Field object from the schema
  for (const group of form.schema.groups) {
    for (const field of group.children) {
      if (field.id === fieldId) {
        return field;
      }
    }
  }

  return undefined;
}

// =============================================================================
// Coercion Helpers
// =============================================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

// =============================================================================
// Field-Specific Coercion
// =============================================================================

function coerceToString(fieldId: string, rawValue: RawFieldValue): CoercionResult {
  if (rawValue === null) {
    return {
      ok: true,
      patch: { op: 'set_string', fieldId, value: null },
    };
  }

  if (typeof rawValue === 'string') {
    return {
      ok: true,
      patch: { op: 'set_string', fieldId, value: rawValue },
    };
  }

  if (typeof rawValue === 'number') {
    return {
      ok: true,
      patch: { op: 'set_string', fieldId, value: String(rawValue) },
      warning: `Coerced number ${rawValue} to string for field '${fieldId}'`,
    };
  }

  if (typeof rawValue === 'boolean') {
    return {
      ok: true,
      patch: { op: 'set_string', fieldId, value: String(rawValue) },
      warning: `Coerced boolean ${rawValue} to string for field '${fieldId}'`,
    };
  }

  return {
    ok: false,
    error: `Cannot coerce ${typeof rawValue} to string for field '${fieldId}'`,
  };
}

function coerceToNumber(fieldId: string, rawValue: RawFieldValue): CoercionResult {
  if (rawValue === null) {
    return {
      ok: true,
      patch: { op: 'set_number', fieldId, value: null },
    };
  }

  if (typeof rawValue === 'number') {
    return {
      ok: true,
      patch: { op: 'set_number', fieldId, value: rawValue },
    };
  }

  if (typeof rawValue === 'string') {
    const parsed = Number(rawValue);
    if (!Number.isNaN(parsed)) {
      return {
        ok: true,
        patch: { op: 'set_number', fieldId, value: parsed },
        warning: `Coerced string '${rawValue}' to number for field '${fieldId}'`,
      };
    }
    return {
      ok: false,
      error: `Cannot coerce non-numeric string '${rawValue}' to number for field '${fieldId}'`,
    };
  }

  return {
    ok: false,
    error: `Cannot coerce ${typeof rawValue} to number for field '${fieldId}'`,
  };
}

function coerceToStringList(fieldId: string, rawValue: RawFieldValue): CoercionResult {
  if (rawValue === null) {
    return {
      ok: true,
      patch: { op: 'set_string_list', fieldId, items: [] },
    };
  }

  if (isStringArray(rawValue)) {
    return {
      ok: true,
      patch: { op: 'set_string_list', fieldId, items: rawValue },
    };
  }

  if (typeof rawValue === 'string') {
    return {
      ok: true,
      patch: { op: 'set_string_list', fieldId, items: [rawValue] },
      warning: `Coerced single string to array for field '${fieldId}'`,
    };
  }

  if (Array.isArray(rawValue)) {
    // Try to coerce non-string items
    const items: string[] = [];
    for (const item of rawValue) {
      if (typeof item === 'string') {
        items.push(item);
      } else if (typeof item === 'number' || typeof item === 'boolean') {
        items.push(String(item));
      } else {
        return {
          ok: false,
          error: `Cannot coerce array with non-string items to string_list for field '${fieldId}'`,
        };
      }
    }
    return {
      ok: true,
      patch: { op: 'set_string_list', fieldId, items },
      warning: `Coerced array items to strings for field '${fieldId}'`,
    };
  }

  return {
    ok: false,
    error: `Cannot coerce ${typeof rawValue} to string_list for field '${fieldId}'`,
  };
}

function coerceToSingleSelect(field: Field, rawValue: RawFieldValue): CoercionResult {
  if (field.kind !== 'single_select') {
    return { ok: false, error: `Field '${field.id}' is not a single_select field` };
  }

  if (rawValue === null) {
    return {
      ok: true,
      patch: { op: 'set_single_select', fieldId: field.id, selected: null },
    };
  }

  if (typeof rawValue !== 'string') {
    return {
      ok: false,
      error: `single_select field '${field.id}' requires a string option ID, got ${typeof rawValue}`,
    };
  }

  const validOptions = new Set(field.options.map((o) => o.id));
  if (!validOptions.has(rawValue)) {
    return {
      ok: false,
      error: `Invalid option '${rawValue}' for single_select field '${field.id}'. Valid options: ${Array.from(validOptions).join(', ')}`,
    };
  }

  return {
    ok: true,
    patch: { op: 'set_single_select', fieldId: field.id, selected: rawValue },
  };
}

function coerceToMultiSelect(field: Field, rawValue: RawFieldValue): CoercionResult {
  if (field.kind !== 'multi_select') {
    return { ok: false, error: `Field '${field.id}' is not a multi_select field` };
  }

  if (rawValue === null) {
    return {
      ok: true,
      patch: { op: 'set_multi_select', fieldId: field.id, selected: [] },
    };
  }

  const validOptions = new Set(field.options.map((o) => o.id));
  let selected: string[];
  let warning: string | undefined;

  if (typeof rawValue === 'string') {
    selected = [rawValue];
    warning = `Coerced single string to array for multi_select field '${field.id}'`;
  } else if (isStringArray(rawValue)) {
    selected = rawValue;
  } else {
    return {
      ok: false,
      error: `multi_select field '${field.id}' requires a string or string array, got ${typeof rawValue}`,
    };
  }

  // Validate all options
  for (const optId of selected) {
    if (!validOptions.has(optId)) {
      return {
        ok: false,
        error: `Invalid option '${optId}' for multi_select field '${field.id}'. Valid options: ${Array.from(validOptions).join(', ')}`,
      };
    }
  }

  const patch: Patch = { op: 'set_multi_select', fieldId: field.id, selected };
  return warning ? { ok: true, patch, warning } : { ok: true, patch };
}

function coerceToCheckboxes(field: Field, rawValue: RawFieldValue): CoercionResult {
  if (field.kind !== 'checkboxes') {
    return { ok: false, error: `Field '${field.id}' is not a checkboxes field` };
  }

  if (rawValue === null) {
    return {
      ok: true,
      patch: { op: 'set_checkboxes', fieldId: field.id, values: {} },
    };
  }

  if (!isPlainObject(rawValue)) {
    return {
      ok: false,
      error: `checkboxes field '${field.id}' requires a Record<string, CheckboxValue>, got ${typeof rawValue}`,
    };
  }

  const validOptions = new Set(field.options.map((o) => o.id));
  const checkboxMode = field.checkboxMode;
  const values: Record<OptionId, CheckboxValue> = {};
  let hadBooleanCoercion = false;

  // Valid checkbox values based on mode
  const validValues = new Set<string>(
    checkboxMode === 'explicit'
      ? ['unfilled', 'yes', 'no']
      : checkboxMode === 'simple'
        ? ['todo', 'done']
        : ['todo', 'done', 'incomplete', 'active', 'na'],
  );

  for (const [optId, value] of Object.entries(rawValue)) {
    if (!validOptions.has(optId)) {
      return {
        ok: false,
        error: `Invalid option '${optId}' for checkboxes field '${field.id}'. Valid options: ${Array.from(validOptions).join(', ')}`,
      };
    }

    // Coerce boolean values to appropriate checkbox strings
    if (typeof value === 'boolean') {
      hadBooleanCoercion = true;
      if (checkboxMode === 'explicit') {
        values[optId] = value ? 'yes' : 'no';
      } else {
        values[optId] = value ? 'done' : 'todo';
      }
      continue;
    }

    if (typeof value !== 'string' || !validValues.has(value)) {
      return {
        ok: false,
        error: `Invalid checkbox value '${String(value)}' for option '${optId}' in field '${field.id}'. Valid values for ${checkboxMode} mode: ${Array.from(validValues).join(', ')} (or use true/false)`,
      };
    }

    values[optId] = value as CheckboxValue;
  }

  const patch: Patch = { op: 'set_checkboxes', fieldId: field.id, values };
  if (hadBooleanCoercion) {
    return {
      ok: true,
      patch,
      warning: `Coerced boolean values to checkbox strings for field '${field.id}'`,
    };
  }
  return { ok: true, patch };
}

function coerceToUrl(fieldId: string, rawValue: RawFieldValue): CoercionResult {
  if (rawValue === null) {
    return {
      ok: true,
      patch: { op: 'set_url', fieldId, value: null },
    };
  }

  if (typeof rawValue === 'string') {
    return {
      ok: true,
      patch: { op: 'set_url', fieldId, value: rawValue },
    };
  }

  return {
    ok: false,
    error: `Cannot coerce ${typeof rawValue} to url for field '${fieldId}'`,
  };
}

function coerceToUrlList(fieldId: string, rawValue: RawFieldValue): CoercionResult {
  if (rawValue === null) {
    return {
      ok: true,
      patch: { op: 'set_url_list', fieldId, items: [] },
    };
  }

  if (isStringArray(rawValue)) {
    return {
      ok: true,
      patch: { op: 'set_url_list', fieldId, items: rawValue },
    };
  }

  if (typeof rawValue === 'string') {
    return {
      ok: true,
      patch: { op: 'set_url_list', fieldId, items: [rawValue] },
      warning: `Coerced single string to array for field '${fieldId}'`,
    };
  }

  if (Array.isArray(rawValue)) {
    // Try to coerce non-string items
    const items: string[] = [];
    for (const item of rawValue) {
      if (typeof item === 'string') {
        items.push(item);
      } else {
        return {
          ok: false,
          error: `Cannot coerce array with non-string items to url_list for field '${fieldId}'`,
        };
      }
    }
    return {
      ok: true,
      patch: { op: 'set_url_list', fieldId, items },
    };
  }

  return {
    ok: false,
    error: `Cannot coerce ${typeof rawValue} to url_list for field '${fieldId}'`,
  };
}

function coerceToDate(fieldId: string, rawValue: RawFieldValue): CoercionResult {
  if (rawValue === null) {
    return {
      ok: true,
      patch: { op: 'set_date', fieldId, value: null },
    };
  }

  if (typeof rawValue === 'string') {
    return {
      ok: true,
      patch: { op: 'set_date', fieldId, value: rawValue },
    };
  }

  return {
    ok: false,
    error: `Cannot coerce ${typeof rawValue} to date for field '${fieldId}'`,
  };
}

function coerceToYear(fieldId: string, rawValue: RawFieldValue): CoercionResult {
  if (rawValue === null) {
    return {
      ok: true,
      patch: { op: 'set_year', fieldId, value: null },
    };
  }

  if (typeof rawValue === 'number') {
    if (!Number.isInteger(rawValue)) {
      return {
        ok: false,
        error: `Year must be an integer for field '${fieldId}', got ${rawValue}`,
      };
    }
    return {
      ok: true,
      patch: { op: 'set_year', fieldId, value: rawValue },
    };
  }

  if (typeof rawValue === 'string') {
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) {
      return {
        ok: false,
        error: `Cannot coerce non-numeric string '${rawValue}' to year for field '${fieldId}'`,
      };
    }
    return {
      ok: true,
      patch: { op: 'set_year', fieldId, value: parsed },
      warning: `Coerced string '${rawValue}' to year for field '${fieldId}'`,
    };
  }

  return {
    ok: false,
    error: `Cannot coerce ${typeof rawValue} to year for field '${fieldId}'`,
  };
}

/**
 * Coerce raw value to SetTablePatch.
 * Accepts:
 * - Array of row objects: [{ col1: value1, col2: value2 }, ...]
 * - Empty array: [] (valid for optional tables or minRows=0)
 */
function coerceToTable(fieldId: string, rawValue: RawFieldValue): CoercionResult {
  // Handle null as clear
  if (rawValue === null) {
    return {
      ok: true,
      patch: { op: 'set_table', fieldId, rows: [] },
    };
  }

  // Must be an array
  if (!Array.isArray(rawValue)) {
    return {
      ok: false,
      error: `Table value for field '${fieldId}' must be an array of rows, got ${typeof rawValue}`,
    };
  }

  // Empty array is valid
  if (rawValue.length === 0) {
    return {
      ok: true,
      patch: { op: 'set_table', fieldId, rows: [] },
    };
  }

  // Process each row
  const rows: TableRowPatch[] = [];
  for (let i = 0; i < rawValue.length; i++) {
    const row = rawValue[i];
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      return {
        ok: false,
        error: `Row ${i} for table field '${fieldId}' must be an object, got ${Array.isArray(row) ? 'array' : typeof row}`,
      };
    }
    rows.push(row as TableRowPatch);
  }

  return {
    ok: true,
    patch: { op: 'set_table', fieldId, rows },
  };
}

// =============================================================================
// Main Coercion Functions
// =============================================================================

/**
 * Coerce a raw value to a Patch for a specific field.
 */
export function coerceToFieldPatch(
  form: ParsedForm,
  fieldId: string,
  rawValue: RawFieldValue,
): CoercionResult {
  const field = findFieldById(form, fieldId);
  if (!field) {
    return { ok: false, error: `Field '${fieldId}' not found` };
  }

  switch (field.kind) {
    case 'string':
      return coerceToString(fieldId, rawValue);
    case 'number':
      return coerceToNumber(fieldId, rawValue);
    case 'string_list':
      return coerceToStringList(fieldId, rawValue);
    case 'single_select':
      return coerceToSingleSelect(field, rawValue);
    case 'multi_select':
      return coerceToMultiSelect(field, rawValue);
    case 'checkboxes':
      return coerceToCheckboxes(field, rawValue);
    case 'url':
      return coerceToUrl(fieldId, rawValue);
    case 'url_list':
      return coerceToUrlList(fieldId, rawValue);
    case 'date':
      return coerceToDate(fieldId, rawValue);
    case 'year':
      return coerceToYear(fieldId, rawValue);
    case 'table':
      return coerceToTable(fieldId, rawValue);
    default: {
      // Exhaustiveness check - TypeScript will error if a case is missing
      const _exhaustive: never = field;
      throw new Error(`Unhandled field kind: ${(_exhaustive as { kind: string }).kind}`);
    }
  }
}

/**
 * Coerce an entire InputContext to patches.
 *
 * Returns patches for valid entries, collects warnings for coercions,
 * and errors for invalid entries.
 */
export function coerceInputContext(
  form: ParsedForm,
  inputContext: InputContext,
): CoerceInputContextResult {
  const patches: Patch[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const [fieldId, rawValue] of Object.entries(inputContext)) {
    // Skip null values (no-op, field unchanged)
    if (rawValue === null) {
      continue;
    }

    const result = coerceToFieldPatch(form, fieldId, rawValue);

    if (result.ok) {
      patches.push(result.patch);
      if ('warning' in result && result.warning) {
        warnings.push(result.warning);
      }
    } else {
      errors.push(result.error);
    }
  }

  return { patches, warnings, errors };
}
