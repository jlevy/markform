/**
 * Patch application for Markform documents.
 *
 * Applies patches to update field values with validation.
 */

import type {
  ApplyResult,
  ApplyStatus,
  CellResponse,
  CheckboxesValue,
  CheckboxMode,
  CheckboxValue,
  Field,
  FieldResponse,
  FieldValue,
  Id,
  InspectIssue,
  Note,
  NoteId,
  ParsedForm,
  Patch,
  PatchCoercionType,
  PatchWarning,
  SetCheckboxesPatch,
  TableRowResponse,
  TableValue,
} from './coreTypes.js';
import { parseSentinel } from './parseSentinels.js';
import { computeAllSummaries, computeFormState, isFormComplete } from './summaries.js';
import { validate } from './validate.js';

// =============================================================================
// Patch Validation
// =============================================================================

/**
 * Internal patch error type that matches PatchRejection interface.
 * Includes field info for type mismatch errors to help LLM generate correct patches.
 */
interface PatchError {
  patchIndex: number;
  message: string;
  /** Field ID if available (for type mismatch errors) */
  fieldId?: string;
  /** Field kind if available (for type mismatch errors) */
  fieldKind?: string;
  /** Column IDs if available (for table fields) */
  columnIds?: string[];
}

/** Mapping from patch op to required field kind for simple type checks. */
const PATCH_OP_TO_FIELD_KIND: Record<string, string> = {
  set_string: 'string',
  set_number: 'number',
  set_string_list: 'string_list',
  set_single_select: 'single_select',
  set_multi_select: 'multi_select',
  set_checkboxes: 'checkboxes',
  set_url: 'url',
  set_url_list: 'url_list',
  set_date: 'date',
  set_year: 'year',
  set_table: 'table',
};

/**
 * Find a field by ID in the form schema.
 */
function findField(form: ParsedForm, fieldId: Id): Field | undefined {
  for (const group of form.schema.groups) {
    for (const field of group.children) {
      if (field.id === fieldId) {
        return field;
      }
    }
  }
  return undefined;
}

/**
 * Result of normalizing a patch, including optional coercion warning.
 */
interface NormalizationResult {
  patch: Patch;
  warning?: PatchWarning;
}

/**
 * Coerce a boolean value to the appropriate checkbox string based on mode.
 */
function coerceBooleanToCheckboxValue(value: boolean, mode: CheckboxMode): CheckboxValue {
  if (mode === 'explicit') {
    return value ? 'yes' : 'no';
  }
  return value ? 'done' : 'todo';
}

/**
 * Create a patch warning for coercion.
 */
function createWarning(
  index: number,
  fieldId: string,
  coercion: PatchCoercionType,
  message: string,
): PatchWarning {
  return { patchIndex: index, fieldId, message, coercion };
}

/**
 * Normalize a patch, coercing common type mismatches with warnings.
 *
 * Coercions performed:
 * - Single string → string_list array
 * - Single URL string → url_list array
 * - Single option ID → multi_select array
 * - Boolean → checkbox string
 *
 * Returns the normalized patch and any coercion warning.
 */
function normalizePatch(form: ParsedForm, patch: Patch, index: number): NormalizationResult {
  // Handle patches without fieldId (add_note, remove_note)
  if (patch.op === 'add_note' || patch.op === 'remove_note') {
    return { patch };
  }

  const field = findField(form, patch.fieldId);
  if (!field) {
    return { patch }; // Let validation handle missing field
  }

  // Coerce single string → string_list
  if (patch.op === 'set_string_list' && field.kind === 'string_list') {
    if (typeof patch.value === 'string') {
      return {
        patch: { ...patch, value: [patch.value] },
        warning: createWarning(
          index,
          field.id,
          'string_to_list',
          `Coerced single string to string_list`,
        ),
      };
    }
  }

  // Coerce single URL → url_list
  if (patch.op === 'set_url_list' && field.kind === 'url_list') {
    if (typeof patch.value === 'string') {
      return {
        patch: { ...patch, value: [patch.value] },
        warning: createWarning(index, field.id, 'url_to_list', `Coerced single URL to url_list`),
      };
    }
  }

  // Coerce single option → multi_select
  if (patch.op === 'set_multi_select' && field.kind === 'multi_select') {
    if (typeof patch.value === 'string') {
      return {
        patch: { ...patch, value: [patch.value] },
        warning: createWarning(
          index,
          field.id,
          'option_to_array',
          `Coerced single option ID to multi_select array`,
        ),
      };
    }
  }

  // Coerce array → checkboxes object or boolean → checkbox string
  if (patch.op === 'set_checkboxes' && field.kind === 'checkboxes') {
    // Handle null/undefined values - let validation handle the error
    if (!patch.value) {
      return { patch };
    }

    // Coerce array of option IDs to checkbox object with default state
    if (Array.isArray(patch.value)) {
      const defaultState = field.checkboxMode === 'explicit' ? 'yes' : 'done';
      const values: Record<string, CheckboxValue> = {};

      for (const item of patch.value) {
        if (typeof item === 'string') {
          values[item] = defaultState;
        }
        // Invalid items will be caught by validation
      }

      // Empty array: no warning
      if (patch.value.length === 0) {
        return { patch: { ...patch, value: values } as SetCheckboxesPatch };
      }

      return {
        patch: { ...patch, value: values } as SetCheckboxesPatch,
        warning: createWarning(
          index,
          field.id,
          'array_to_checkboxes',
          `Coerced array to checkboxes object with '${defaultState}' state`,
        ),
      };
    }

    // Check if any values are booleans
    let needsNormalization = false;
    for (const value of Object.values(patch.value)) {
      if (typeof value === 'boolean') {
        needsNormalization = true;
        break;
      }
    }

    if (!needsNormalization) {
      return { patch };
    }

    // Coerce boolean values to strings
    const normalizedValues: Record<string, CheckboxValue> = {};
    for (const [optId, value] of Object.entries(patch.value)) {
      if (typeof value === 'boolean') {
        normalizedValues[optId] = coerceBooleanToCheckboxValue(value, field.checkboxMode);
      } else {
        normalizedValues[optId] = value;
      }
    }

    return {
      patch: { ...patch, value: normalizedValues } as SetCheckboxesPatch,
      warning: createWarning(
        index,
        field.id,
        'boolean_to_checkbox',
        `Coerced boolean values to checkbox state strings`,
      ),
    };
  }

  return { patch };
}

/**
 * Create a type mismatch error with field metadata for LLM guidance.
 */
function typeMismatchError(index: number, op: string, field: Field): PatchError {
  return {
    patchIndex: index,
    message: `Cannot apply ${op} to ${field.kind} field "${field.id}"`,
    fieldId: field.id,
    fieldKind: field.kind,
    columnIds: field.kind === 'table' ? field.columns.map((c) => c.id) : undefined,
  };
}

/**
 * Check if a string value contains an embedded sentinel (%SKIP% or %ABORT%).
 * This detects sentinel patterns that should be rejected in patch values -
 * agents should use skip_field/abort_field instead.
 *
 * Uses case-insensitive matching since LLMs may generate lowercase sentinels.
 * First tries exact case using parseSentinel, then falls back to case-insensitive check.
 *
 * @param value - The string value to check
 * @returns The detected sentinel type ('skip' | 'abort') or null if no sentinel found
 */
function detectEmbeddedSentinel(value: string | null | undefined): 'skip' | 'abort' | null {
  if (value == null) return null;

  // First try exact case match using parseSentinel (canonical format)
  const sentinel = parseSentinel(value);
  if (sentinel) {
    return sentinel.type;
  }

  // Fall back to case-insensitive check for LLM-generated lowercase variants
  const trimmed = value.trim().toUpperCase();
  if (trimmed.startsWith('%SKIP%')) {
    return 'skip';
  }
  if (trimmed.startsWith('%ABORT%')) {
    return 'abort';
  }

  return null;
}

/**
 * Create an error for embedded sentinel in patch value.
 */
function embeddedSentinelError(
  index: number,
  fieldId: string,
  sentinelType: 'skip' | 'abort',
): PatchError {
  const operation = sentinelType === 'skip' ? 'skip_field' : 'abort_field';
  const sentinel = sentinelType === 'skip' ? '%SKIP%' : '%ABORT%';
  return {
    patchIndex: index,
    message: `Value contains ${sentinel} sentinel for field "${fieldId}". Use ${operation} operation instead of embedding sentinel in value.`,
    fieldId,
  };
}

/**
 * Validate a single patch against the form schema.
 */
function validatePatch(form: ParsedForm, patch: Patch, index: number): PatchError | null {
  // Handle patches without fieldId
  if (patch.op === 'add_note') {
    if (!form.idIndex.has(patch.ref)) {
      return { patchIndex: index, message: `Reference "${patch.ref}" not found in form` };
    }
    return null;
  }

  if (patch.op === 'remove_note') {
    const noteExists = form.notes.some((n) => n.id === patch.noteId);
    if (!noteExists) {
      return { patchIndex: index, message: `Note with id '${patch.noteId}' not found` };
    }
    return null;
  }

  // All other patches have fieldId
  const field = findField(form, patch.fieldId);
  if (!field) {
    return { patchIndex: index, message: `Field "${patch.fieldId}" not found` };
  }

  // Check field kind match for set_* patches
  const expectedKind = PATCH_OP_TO_FIELD_KIND[patch.op];
  if (expectedKind && field.kind !== expectedKind) {
    return typeMismatchError(index, patch.op, field);
  }

  // Check for embedded sentinels in string values (issue #119)
  // Agents should use skip_field/abort_field operations instead of embedding sentinels
  if (patch.op === 'set_string' || patch.op === 'set_url' || patch.op === 'set_date') {
    const sentinelType = detectEmbeddedSentinel(patch.value);
    if (sentinelType) {
      return embeddedSentinelError(index, field.id, sentinelType);
    }
  }

  // Additional validation for container types, select/checkbox options, and table columns
  if (patch.op === 'set_string_list' && field.kind === 'string_list') {
    // Validate value is a non-null array
    if (!Array.isArray(patch.value)) {
      return {
        patchIndex: index,
        message: `Invalid set_string_list patch for field "${field.id}": value must be an array of strings`,
        fieldId: field.id,
        fieldKind: field.kind,
      };
    }
    // Check for embedded sentinels in list items (issue #119)
    for (const item of patch.value) {
      const sentinelType = detectEmbeddedSentinel(item);
      if (sentinelType) {
        return embeddedSentinelError(index, field.id, sentinelType);
      }
    }
  } else if (patch.op === 'set_single_select' && field.kind === 'single_select') {
    if (patch.value !== null) {
      const validOptions = new Set(field.options.map((o) => o.id));
      if (!validOptions.has(patch.value)) {
        return {
          patchIndex: index,
          message: `Invalid option "${patch.value}" for field "${field.id}"`,
        };
      }
    }
  } else if (patch.op === 'set_multi_select' && field.kind === 'multi_select') {
    // Validate value is a non-null array
    if (!Array.isArray(patch.value)) {
      return {
        patchIndex: index,
        message: `Invalid set_multi_select patch for field "${field.id}": value must be an array of option IDs`,
        fieldId: field.id,
        fieldKind: field.kind,
      };
    }
    const validOptions = new Set(field.options.map((o) => o.id));
    for (const optId of patch.value) {
      if (!validOptions.has(optId)) {
        return { patchIndex: index, message: `Invalid option "${optId}" for field "${field.id}"` };
      }
    }
  } else if (patch.op === 'set_checkboxes' && field.kind === 'checkboxes') {
    // Validate value is a non-null object (not array, string, undefined, null)
    if (patch.value == null || typeof patch.value !== 'object' || Array.isArray(patch.value)) {
      return {
        patchIndex: index,
        message: `Invalid set_checkboxes patch for field "${field.id}": value must be an object mapping option IDs to checkbox state strings (e.g. "todo", "done", "yes", "no")`,
        fieldId: field.id,
        fieldKind: field.kind,
      };
    }
    const validOptions = new Set(field.options.map((o) => o.id));
    for (const optId of Object.keys(patch.value)) {
      if (!validOptions.has(optId)) {
        return { patchIndex: index, message: `Invalid option "${optId}" for field "${field.id}"` };
      }
    }
  } else if (patch.op === 'set_url_list' && field.kind === 'url_list') {
    // Validate value is a non-null array
    if (!Array.isArray(patch.value)) {
      return {
        patchIndex: index,
        message: `Invalid set_url_list patch for field "${field.id}": value must be an array of URLs`,
        fieldId: field.id,
        fieldKind: field.kind,
      };
    }
    // Check for embedded sentinels in list items (issue #119)
    for (const item of patch.value) {
      const sentinelType = detectEmbeddedSentinel(item);
      if (sentinelType) {
        return embeddedSentinelError(index, field.id, sentinelType);
      }
    }
  } else if (patch.op === 'set_table' && field.kind === 'table') {
    // Validate value is a non-null array
    const columnIds = field.columns.map((c) => c.id);
    if (!Array.isArray(patch.value)) {
      return {
        patchIndex: index,
        message: `Invalid set_table patch for field "${field.id}": value must be an array of row objects. Each row should map column IDs to values. Columns: [${columnIds.join(', ')}]`,
        fieldId: field.id,
        fieldKind: field.kind,
        columnIds,
      };
    }
    const validColumns = new Set(columnIds);
    for (const row of patch.value) {
      if (row != null) {
        for (const colId of Object.keys(row)) {
          if (!validColumns.has(colId)) {
            return {
              patchIndex: index,
              message: `Invalid column "${colId}" for table field "${field.id}"`,
            };
          }
        }
      }
    }
  } else if (patch.op === 'skip_field' && field.required) {
    return { patchIndex: index, message: `Cannot skip required field "${field.id}"` };
  }

  return null;
}

// =============================================================================
// Patch Application
// =============================================================================

/**
 * Generate a unique note ID for the form.
 */
function generateNoteId(form: ParsedForm): NoteId {
  const existingIds = new Set(form.notes.map((n) => n.id));
  let counter = 1;
  while (existingIds.has(`n${counter}`)) {
    counter++;
  }
  return `n${counter}`;
}

/**
 * Set a simple value response (string, number, url, date, year).
 */
function setSimpleValue(
  responses: Record<Id, FieldResponse>,
  fieldId: Id,
  kind: string,
  value: string | number | null,
): void {
  responses[fieldId] = { state: 'answered', value: { kind, value } as FieldValue };
}

/**
 * Set a list value response (string_list, url_list).
 */
function setListValue(
  responses: Record<Id, FieldResponse>,
  fieldId: Id,
  kind: string,
  items: string[],
): void {
  responses[fieldId] = { state: 'answered', value: { kind, items } as FieldValue };
}

/**
 * Set a single select value response.
 */
function setSingleSelectValue(
  responses: Record<Id, FieldResponse>,
  fieldId: Id,
  selected: string | null,
): void {
  responses[fieldId] = {
    state: 'answered',
    value: { kind: 'single_select', selected } as FieldValue,
  };
}

/**
 * Set a multi select value response.
 */
function setMultiSelectValue(
  responses: Record<Id, FieldResponse>,
  fieldId: Id,
  selected: string[],
): void {
  responses[fieldId] = {
    state: 'answered',
    value: { kind: 'multi_select', selected } as FieldValue,
  };
}

/**
 * Convert a patch row value to a cell response.
 */
function patchValueToCell(value: string | number | null | undefined): CellResponse {
  if (value === null || value === undefined) {
    return { state: 'skipped' };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const skipMatch = /^%SKIP(?:[:(](.*))?[)]?%$/i.exec(trimmed);
    if (skipMatch) {
      return { state: 'skipped', reason: skipMatch[1] };
    }
    const abortMatch = /^%ABORT(?:[:(](.*))?[)]?%$/i.exec(trimmed);
    if (abortMatch) {
      return { state: 'aborted', reason: abortMatch[1] };
    }
    return { state: 'answered', value: trimmed };
  }

  return { state: 'answered', value };
}

/**
 * Apply a single patch to the form.
 */
function applyPatch(form: ParsedForm, responses: Record<Id, FieldResponse>, patch: Patch): void {
  switch (patch.op) {
    // Simple string value types
    case 'set_string':
      setSimpleValue(responses, patch.fieldId, 'string', patch.value);
      break;
    case 'set_url':
      setSimpleValue(responses, patch.fieldId, 'url', patch.value);
      break;
    case 'set_date':
      setSimpleValue(responses, patch.fieldId, 'date', patch.value);
      break;

    // Simple number value types
    case 'set_number':
      setSimpleValue(responses, patch.fieldId, 'number', patch.value);
      break;
    case 'set_year':
      setSimpleValue(responses, patch.fieldId, 'year', patch.value);
      break;

    // List types
    case 'set_string_list':
      setListValue(responses, patch.fieldId, 'string_list', patch.value);
      break;
    case 'set_url_list':
      setListValue(responses, patch.fieldId, 'url_list', patch.value);
      break;

    // Select types
    case 'set_single_select':
      setSingleSelectValue(responses, patch.fieldId, patch.value);
      break;

    case 'set_multi_select':
      setMultiSelectValue(responses, patch.fieldId, patch.value);
      break;

    // Checkboxes (merge with existing)
    case 'set_checkboxes': {
      const existing =
        (responses[patch.fieldId]?.value as CheckboxesValue | undefined)?.values ?? {};
      responses[patch.fieldId] = {
        state: 'answered',
        value: { kind: 'checkboxes', values: { ...existing, ...patch.value } } as CheckboxesValue,
      };
      break;
    }

    // Table
    case 'set_table': {
      const rows: TableRowResponse[] = (patch.value ?? []).map((patchRow) => {
        const row: TableRowResponse = {};
        if (patchRow != null) {
          for (const [colId, cellValue] of Object.entries(patchRow)) {
            row[colId] = patchValueToCell(cellValue);
          }
        }
        return row;
      });
      responses[patch.fieldId] = {
        state: 'answered',
        value: { kind: 'table', rows } as TableValue,
      };
      break;
    }

    // State changes
    case 'clear_field':
      responses[patch.fieldId] = { state: 'unanswered' };
      break;

    case 'skip_field':
      responses[patch.fieldId] = {
        state: 'skipped',
        ...(patch.reason && { reason: patch.reason }),
      };
      break;

    case 'abort_field':
      responses[patch.fieldId] = {
        state: 'aborted',
        ...(patch.reason && { reason: patch.reason }),
      };
      break;

    // Notes
    case 'add_note': {
      const noteId = generateNoteId(form);
      form.notes.push({ id: noteId, ref: patch.ref, role: patch.role, text: patch.text });
      break;
    }

    case 'remove_note': {
      const idx = form.notes.findIndex((n) => n.id === patch.noteId);
      if (idx >= 0) form.notes.splice(idx, 1);
      break;
    }
  }
}

// =============================================================================
// Issue Conversion (ValidationIssue -> InspectIssue)
// =============================================================================

/**
 * Convert validation issues to inspect issues with priorities.
 */
function convertToInspectIssues(form: ParsedForm): InspectIssue[] {
  const result = validate(form, { skipCodeValidators: true });
  const issues: InspectIssue[] = [];
  let priority = 1;

  for (const vi of result.issues) {
    issues.push({
      ref: vi.ref ?? '',
      scope: 'field', // Default to field scope; can be refined based on validator context
      reason: vi.severity === 'error' ? 'validation_error' : 'optional_unanswered',
      message: vi.message,
      severity: vi.severity === 'error' ? 'required' : 'recommended',
      priority: priority++,
    });
  }

  return issues;
}

// =============================================================================
// Main Apply Function
// =============================================================================

/**
 * Apply patches to a parsed form.
 *
 * Uses best-effort semantics: valid patches are applied even when some fail.
 * Invalid patches are rejected with detailed error messages.
 *
 * @param form - The parsed form to update
 * @param patches - Array of patches to apply
 * @returns Apply result with new summaries, status, and detailed feedback
 */
export function applyPatches(form: ParsedForm, patches: Patch[]): ApplyResult {
  // Normalize patches and collect coercion warnings
  const normalized: NormalizationResult[] = patches.map((p, i) => normalizePatch(form, p, i));
  const warnings: PatchWarning[] = normalized.filter((r) => r.warning).map((r) => r.warning!);
  const normalizedPatches = normalized.map((r) => r.patch);

  // Validate each patch independently (best-effort semantics)
  const validPatches: Patch[] = [];
  const errors: PatchError[] = [];

  for (let i = 0; i < normalizedPatches.length; i++) {
    const patch = normalizedPatches[i];
    if (patch) {
      const error = validatePatch(form, patch, i);
      if (error) {
        errors.push(error);
      } else {
        validPatches.push(patch);
      }
    }
  }

  // If all patches failed, return rejected (no changes to form)
  if (validPatches.length === 0 && errors.length > 0) {
    const issues = convertToInspectIssues(form);
    const summaries = computeAllSummaries(form.schema, form.responsesByFieldId, form.notes, issues);

    return {
      applyStatus: 'rejected',
      structureSummary: summaries.structureSummary,
      progressSummary: summaries.progressSummary,
      issues,
      isComplete: summaries.isComplete,
      formState: summaries.formState,
      appliedPatches: [],
      rejectedPatches: errors,
      warnings: [], // No warnings if nothing applied
    };
  }

  // Create new responses and notes (don't mutate original)
  const newResponses: Record<Id, FieldResponse> = { ...form.responsesByFieldId };
  const newNotes: Note[] = [...form.notes];
  form.notes = newNotes;

  // Apply only valid patches
  for (const patch of validPatches) {
    applyPatch(form, newResponses, patch);
  }

  // Update form with new responses
  form.responsesByFieldId = newResponses;

  // Compute new summaries
  const issues = convertToInspectIssues(form);
  const summaries = computeAllSummaries(form.schema, newResponses, newNotes, issues);

  // Determine status: 'applied' if all succeeded, 'partial' if some failed
  const applyStatus: ApplyStatus = errors.length > 0 ? 'partial' : 'applied';

  return {
    applyStatus,
    structureSummary: summaries.structureSummary,
    progressSummary: summaries.progressSummary,
    issues,
    isComplete: isFormComplete(summaries.progressSummary),
    formState: computeFormState(summaries.progressSummary),
    appliedPatches: validPatches,
    rejectedPatches: errors,
    warnings,
  };
}
