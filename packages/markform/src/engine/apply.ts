/**
 * Patch application for Markform documents.
 *
 * Applies patches to update field values with validation.
 */

import type {
  ApplyResult,
  CellResponse,
  CheckboxesValue,
  Field,
  FieldResponse,
  FieldValue,
  Id,
  InspectIssue,
  Note,
  NoteId,
  ParsedForm,
  Patch,
  TableRowResponse,
  TableValue,
} from './coreTypes.js';
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

  // Additional validation for container types, select/checkbox options, and table columns
  if (patch.op === 'set_string_list' && field.kind === 'string_list') {
    // Validate items is a non-null array
    if (!Array.isArray(patch.items)) {
      return {
        patchIndex: index,
        message: `Invalid set_string_list patch for field "${field.id}": items must be an array of strings`,
        fieldId: field.id,
        fieldKind: field.kind,
      };
    }
  } else if (patch.op === 'set_single_select' && field.kind === 'single_select') {
    if (patch.selected !== null) {
      const validOptions = new Set(field.options.map((o) => o.id));
      if (!validOptions.has(patch.selected)) {
        return {
          patchIndex: index,
          message: `Invalid option "${patch.selected}" for field "${field.id}"`,
        };
      }
    }
  } else if (patch.op === 'set_multi_select' && field.kind === 'multi_select') {
    // Validate selected is a non-null array
    if (!Array.isArray(patch.selected)) {
      return {
        patchIndex: index,
        message: `Invalid set_multi_select patch for field "${field.id}": selected must be an array of option IDs`,
        fieldId: field.id,
        fieldKind: field.kind,
      };
    }
    const validOptions = new Set(field.options.map((o) => o.id));
    for (const optId of patch.selected) {
      if (!validOptions.has(optId)) {
        return { patchIndex: index, message: `Invalid option "${optId}" for field "${field.id}"` };
      }
    }
  } else if (patch.op === 'set_checkboxes' && field.kind === 'checkboxes') {
    // Validate values is a non-null object (not array, string, undefined, null)
    if (patch.values == null || typeof patch.values !== 'object' || Array.isArray(patch.values)) {
      return {
        patchIndex: index,
        message: `Invalid set_checkboxes patch for field "${field.id}": values must be an object mapping option IDs to booleans`,
        fieldId: field.id,
        fieldKind: field.kind,
      };
    }
    const validOptions = new Set(field.options.map((o) => o.id));
    for (const optId of Object.keys(patch.values)) {
      if (!validOptions.has(optId)) {
        return { patchIndex: index, message: `Invalid option "${optId}" for field "${field.id}"` };
      }
    }
  } else if (patch.op === 'set_url_list' && field.kind === 'url_list') {
    // Validate items is a non-null array
    if (!Array.isArray(patch.items)) {
      return {
        patchIndex: index,
        message: `Invalid set_url_list patch for field "${field.id}": items must be an array of URLs`,
        fieldId: field.id,
        fieldKind: field.kind,
      };
    }
  } else if (patch.op === 'set_table' && field.kind === 'table') {
    // Validate rows is a non-null array
    if (!Array.isArray(patch.rows)) {
      return {
        patchIndex: index,
        message: `Invalid set_table patch for field "${field.id}": rows must be an array of row objects`,
        fieldId: field.id,
        fieldKind: field.kind,
        columnIds: field.columns.map((c) => c.id),
      };
    }
    const validColumns = new Set(field.columns.map((c) => c.id));
    for (const row of patch.rows) {
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

/**
 * Validate all patches against the form schema.
 */
function validatePatches(form: ParsedForm, patches: Patch[]): PatchError[] {
  const errors: PatchError[] = [];
  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];
    if (patch) {
      const error = validatePatch(form, patch, i);
      if (error) {
        errors.push(error);
      }
    }
  }
  return errors;
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
      setListValue(responses, patch.fieldId, 'string_list', patch.items);
      break;
    case 'set_url_list':
      setListValue(responses, patch.fieldId, 'url_list', patch.items);
      break;

    // Select types
    case 'set_single_select':
      setSingleSelectValue(responses, patch.fieldId, patch.selected);
      break;

    case 'set_multi_select':
      setMultiSelectValue(responses, patch.fieldId, patch.selected);
      break;

    // Checkboxes (merge with existing)
    case 'set_checkboxes': {
      const existing =
        (responses[patch.fieldId]?.value as CheckboxesValue | undefined)?.values ?? {};
      responses[patch.fieldId] = {
        state: 'answered',
        value: { kind: 'checkboxes', values: { ...existing, ...patch.values } } as CheckboxesValue,
      };
      break;
    }

    // Table
    case 'set_table': {
      const rows: TableRowResponse[] = (patch.rows ?? []).map((patchRow) => {
        const row: TableRowResponse = {};
        if (patchRow != null) {
          for (const [colId, value] of Object.entries(patchRow)) {
            row[colId] = patchValueToCell(value);
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
 * Uses transaction semantics - all patches succeed or none are applied.
 *
 * @param form - The parsed form to update
 * @param patches - Array of patches to apply
 * @returns Apply result with new summaries and status
 */
export function applyPatches(form: ParsedForm, patches: Patch[]): ApplyResult {
  // Validate all patches first (transaction semantics)
  const errors = validatePatches(form, patches);
  if (errors.length > 0) {
    // Reject - compute summaries from current state
    const issues = convertToInspectIssues(form);
    const summaries = computeAllSummaries(form.schema, form.responsesByFieldId, form.notes, issues);

    return {
      applyStatus: 'rejected',
      structureSummary: summaries.structureSummary,
      progressSummary: summaries.progressSummary,
      issues,
      isComplete: summaries.isComplete,
      formState: summaries.formState,
      rejectedPatches: errors,
    };
  }

  // Create new responses and notes (don't mutate original)
  const newResponses: Record<Id, FieldResponse> = { ...form.responsesByFieldId };
  const newNotes: Note[] = [...form.notes];

  // Save original notes to restore on failure (currently unused in transaction logic)
  const _originalNotes = form.notes;
  form.notes = newNotes;

  // Apply all patches
  for (const patch of patches) {
    applyPatch(form, newResponses, patch);
  }

  // Update form with new responses
  form.responsesByFieldId = newResponses;

  // Compute new summaries
  const issues = convertToInspectIssues(form);
  const summaries = computeAllSummaries(form.schema, newResponses, newNotes, issues);

  return {
    applyStatus: 'applied',
    structureSummary: summaries.structureSummary,
    progressSummary: summaries.progressSummary,
    issues,
    isComplete: isFormComplete(summaries.progressSummary),
    formState: computeFormState(summaries.progressSummary),
    rejectedPatches: [],
  };
}
