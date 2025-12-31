/**
 * Patch application for Markform documents.
 *
 * Applies patches to update field values with validation.
 */

import type {
  AbortFieldPatch,
  AddNotePatch,
  ApplyResult,
  CellResponse,
  CheckboxesValue,
  CheckboxValue,
  ClearFieldPatch,
  DateValue,
  Field,
  FieldResponse,
  Id,
  InspectIssue,
  MultiSelectValue,
  Note,
  NoteId,
  NumberValue,
  OptionId,
  ParsedForm,
  Patch,
  RemoveNotePatch,
  SetCheckboxesPatch,
  SetDatePatch,
  SetMultiSelectPatch,
  SetNumberPatch,
  SetSingleSelectPatch,
  SetStringListPatch,
  SetStringPatch,
  SetTablePatch,
  SetUrlListPatch,
  SetUrlPatch,
  SetYearPatch,
  SingleSelectValue,
  SkipFieldPatch,
  StringListValue,
  StringValue,
  TableRowResponse,
  TableValue,
  UrlListValue,
  UrlValue,
  YearValue,
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
 * Validate a single patch against the form schema.
 */
function validatePatch(form: ParsedForm, patch: Patch, index: number): PatchError | null {
  // Handle patches without fieldId
  if (patch.op === 'add_note') {
    // Validate that ref exists in idIndex
    if (!form.idIndex.has(patch.ref)) {
      return {
        patchIndex: index,
        message: `Reference "${patch.ref}" not found in form`,
      };
    }
    return null;
  }

  if (patch.op === 'remove_note') {
    // This patch uses 'noteId' instead of 'fieldId'
    // Validate that the note exists
    const noteExists = form.notes.some((n) => n.id === patch.noteId);
    if (!noteExists) {
      return {
        patchIndex: index,
        message: `Note with id '${patch.noteId}' not found`,
      };
    }
    return null;
  }

  // All other patches have fieldId
  const fieldId = patch.fieldId;
  const field = findField(form, fieldId);

  if (!field) {
    return {
      patchIndex: index,
      message: `Field "${fieldId}" not found`,
    };
  }

  switch (patch.op) {
    case 'set_string':
      if (field.kind !== 'string') {
        return {
          patchIndex: index,
          message: `Cannot apply set_string to ${field.kind} field "${field.id}"`,
          fieldId: field.id,
          fieldKind: field.kind,
          columnIds: field.kind === 'table' ? field.columns.map((c) => c.id) : undefined,
        };
      }
      break;

    case 'set_number':
      if (field.kind !== 'number') {
        return {
          patchIndex: index,
          message: `Cannot apply set_number to ${field.kind} field "${field.id}"`,
          fieldId: field.id,
          fieldKind: field.kind,
          columnIds: field.kind === 'table' ? field.columns.map((c) => c.id) : undefined,
        };
      }
      break;

    case 'set_string_list':
      if (field.kind !== 'string_list') {
        return {
          patchIndex: index,
          message: `Cannot apply set_string_list to ${field.kind} field "${field.id}"`,
          fieldId: field.id,
          fieldKind: field.kind,
          columnIds: field.kind === 'table' ? field.columns.map((c) => c.id) : undefined,
        };
      }
      break;

    case 'set_single_select': {
      if (field.kind !== 'single_select') {
        return {
          patchIndex: index,
          message: `Cannot apply set_single_select to ${field.kind} field "${field.id}"`,
          fieldId: field.id,
          fieldKind: field.kind,
          columnIds: field.kind === 'table' ? field.columns.map((c) => c.id) : undefined,
        };
      }
      const selectField = field;
      if (patch.selected !== null) {
        const validOptions = new Set(selectField.options.map((o) => o.id));
        if (!validOptions.has(patch.selected)) {
          return {
            patchIndex: index,
            message: `Invalid option "${patch.selected}" for field "${field.id}"`,
          };
        }
      }
      break;
    }

    case 'set_multi_select': {
      if (field.kind !== 'multi_select') {
        return {
          patchIndex: index,
          message: `Cannot apply set_multi_select to ${field.kind} field "${field.id}"`,
          fieldId: field.id,
          fieldKind: field.kind,
          columnIds: field.kind === 'table' ? field.columns.map((c) => c.id) : undefined,
        };
      }
      const multiField = field;
      const validOptions = new Set(multiField.options.map((o) => o.id));
      for (const optId of patch.selected) {
        if (!validOptions.has(optId)) {
          return {
            patchIndex: index,
            message: `Invalid option "${optId}" for field "${field.id}"`,
          };
        }
      }
      break;
    }

    case 'set_checkboxes': {
      if (field.kind !== 'checkboxes') {
        return {
          patchIndex: index,
          message: `Cannot apply set_checkboxes to ${field.kind} field "${field.id}"`,
          fieldId: field.id,
          fieldKind: field.kind,
          columnIds: field.kind === 'table' ? field.columns.map((c) => c.id) : undefined,
        };
      }
      const checkboxField = field;
      const validOptions = new Set(checkboxField.options.map((o) => o.id));
      for (const optId of Object.keys(patch.values)) {
        if (!validOptions.has(optId)) {
          return {
            patchIndex: index,
            message: `Invalid option "${optId}" for field "${field.id}"`,
          };
        }
      }
      break;
    }

    case 'set_url':
      if (field.kind !== 'url') {
        return {
          patchIndex: index,
          message: `Cannot apply set_url to ${field.kind} field "${field.id}"`,
          fieldId: field.id,
          fieldKind: field.kind,
          columnIds: field.kind === 'table' ? field.columns.map((c) => c.id) : undefined,
        };
      }
      break;

    case 'set_url_list':
      if (field.kind !== 'url_list') {
        return {
          patchIndex: index,
          message: `Cannot apply set_url_list to ${field.kind} field "${field.id}"`,
          fieldId: field.id,
          fieldKind: field.kind,
          columnIds: field.kind === 'table' ? field.columns.map((c) => c.id) : undefined,
        };
      }
      break;

    case 'set_date':
      if (field.kind !== 'date') {
        return {
          patchIndex: index,
          message: `Cannot apply set_date to ${field.kind} field "${field.id}"`,
          fieldId: field.id,
          fieldKind: field.kind,
          columnIds: field.kind === 'table' ? field.columns.map((c) => c.id) : undefined,
        };
      }
      break;

    case 'set_year':
      if (field.kind !== 'year') {
        return {
          patchIndex: index,
          message: `Cannot apply set_year to ${field.kind} field "${field.id}"`,
          fieldId: field.id,
          fieldKind: field.kind,
          columnIds: field.kind === 'table' ? field.columns.map((c) => c.id) : undefined,
        };
      }
      break;

    case 'set_table': {
      if (field.kind !== 'table') {
        return {
          patchIndex: index,
          message: `Cannot apply set_table to ${field.kind} field "${field.id}"`,
          fieldId: field.id,
          fieldKind: field.kind,
          // No columnIds since this is not a table field
        };
      }
      const tableField = field;
      // Validate column IDs in the patch rows
      const validColumns = new Set(tableField.columns.map((c) => c.id));
      for (const row of patch.rows) {
        for (const colId of Object.keys(row)) {
          if (!validColumns.has(colId)) {
            return {
              patchIndex: index,
              message: `Invalid column "${colId}" for table field "${field.id}"`,
            };
          }
        }
      }
      break;
    }

    case 'clear_field':
      // Any field can be cleared
      break;

    case 'skip_field':
      // Can only skip optional fields
      if (field.required) {
        return {
          patchIndex: index,
          message: `Cannot skip required field "${field.id}"`,
        };
      }
      break;

    case 'abort_field':
      // Any field can be aborted
      break;
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
 * Apply a set_string patch.
 */
function applySetString(responses: Record<Id, FieldResponse>, patch: SetStringPatch): void {
  responses[patch.fieldId] = {
    state: 'answered',
    value: {
      kind: 'string',
      value: patch.value,
    } as StringValue,
  };
}

/**
 * Apply a set_number patch.
 */
function applySetNumber(responses: Record<Id, FieldResponse>, patch: SetNumberPatch): void {
  responses[patch.fieldId] = {
    state: 'answered',
    value: {
      kind: 'number',
      value: patch.value,
    } as NumberValue,
  };
}

/**
 * Apply a set_string_list patch.
 */
function applySetStringList(responses: Record<Id, FieldResponse>, patch: SetStringListPatch): void {
  responses[patch.fieldId] = {
    state: 'answered',
    value: {
      kind: 'string_list',
      items: patch.items,
    } as StringListValue,
  };
}

/**
 * Apply a set_single_select patch.
 */
function applySetSingleSelect(
  responses: Record<Id, FieldResponse>,
  patch: SetSingleSelectPatch,
): void {
  responses[patch.fieldId] = {
    state: 'answered',
    value: {
      kind: 'single_select',
      selected: patch.selected,
    } as SingleSelectValue,
  };
}

/**
 * Apply a set_multi_select patch.
 */
function applySetMultiSelect(
  responses: Record<Id, FieldResponse>,
  patch: SetMultiSelectPatch,
): void {
  responses[patch.fieldId] = {
    state: 'answered',
    value: {
      kind: 'multi_select',
      selected: patch.selected,
    } as MultiSelectValue,
  };
}

/**
 * Apply a set_checkboxes patch (merges with existing values).
 */
function applySetCheckboxes(responses: Record<Id, FieldResponse>, patch: SetCheckboxesPatch): void {
  const existingResponse = responses[patch.fieldId];
  const existingValue = existingResponse?.value as CheckboxesValue | undefined;
  const existingValues = existingValue?.values ?? {};

  // Merge patch values with existing
  const merged: Record<OptionId, CheckboxValue> = {
    ...existingValues,
    ...patch.values,
  };

  responses[patch.fieldId] = {
    state: 'answered',
    value: {
      kind: 'checkboxes',
      values: merged,
    } as CheckboxesValue,
  };
}

/**
 * Apply a set_url patch.
 */
function applySetUrl(responses: Record<Id, FieldResponse>, patch: SetUrlPatch): void {
  responses[patch.fieldId] = {
    state: 'answered',
    value: {
      kind: 'url',
      value: patch.value,
    } as UrlValue,
  };
}

/**
 * Apply a set_url_list patch.
 */
function applySetUrlList(responses: Record<Id, FieldResponse>, patch: SetUrlListPatch): void {
  responses[patch.fieldId] = {
    state: 'answered',
    value: {
      kind: 'url_list',
      items: patch.items,
    } as UrlListValue,
  };
}

/**
 * Apply a set_date patch.
 */
function applySetDate(responses: Record<Id, FieldResponse>, patch: SetDatePatch): void {
  responses[patch.fieldId] = {
    state: 'answered',
    value: {
      kind: 'date',
      value: patch.value,
    } as DateValue,
  };
}

/**
 * Apply a set_year patch.
 */
function applySetYear(responses: Record<Id, FieldResponse>, patch: SetYearPatch): void {
  responses[patch.fieldId] = {
    state: 'answered',
    value: {
      kind: 'year',
      value: patch.value,
    } as YearValue,
  };
}

/**
 * Convert a patch row value to a cell response.
 */
function patchValueToCell(value: string | number | null | undefined): CellResponse {
  // null or undefined => skipped
  if (value === null || value === undefined) {
    return { state: 'skipped' };
  }

  // Handle sentinel strings
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
    // Regular string value
    return { state: 'answered', value: trimmed };
  }

  // Number value
  return { state: 'answered', value };
}

/**
 * Apply a set_table patch.
 */
function applySetTable(responses: Record<Id, FieldResponse>, patch: SetTablePatch): void {
  const rows: TableRowResponse[] = patch.rows.map((patchRow) => {
    const row: TableRowResponse = {};
    for (const [colId, value] of Object.entries(patchRow)) {
      row[colId] = patchValueToCell(value);
    }
    return row;
  });

  responses[patch.fieldId] = {
    state: 'answered',
    value: {
      kind: 'table',
      rows,
    } as TableValue,
  };
}

/**
 * Apply a clear_field patch.
 */
function applyClearField(responses: Record<Id, FieldResponse>, patch: ClearFieldPatch): void {
  responses[patch.fieldId] = {
    state: 'unanswered',
  };
}

/**
 * Apply a skip_field patch.
 * Marks the field as skipped and stores reason in FieldResponse.reason.
 */
function applySkipField(responses: Record<Id, FieldResponse>, patch: SkipFieldPatch): void {
  responses[patch.fieldId] = {
    state: 'skipped',
    ...(patch.reason && { reason: patch.reason }),
  };
}

/**
 * Apply an abort_field patch.
 * Marks the field as aborted and stores reason in FieldResponse.reason.
 */
function applyAbortField(responses: Record<Id, FieldResponse>, patch: AbortFieldPatch): void {
  responses[patch.fieldId] = {
    state: 'aborted',
    ...(patch.reason && { reason: patch.reason }),
  };
}

/**
 * Apply an add_note patch.
 * Adds a note to the form.
 */
function applyAddNote(form: ParsedForm, patch: AddNotePatch): void {
  const noteId = generateNoteId(form);
  form.notes.push({
    id: noteId,
    ref: patch.ref,
    role: patch.role,
    text: patch.text,
  });
}

/**
 * Apply a remove_note patch.
 * Removes a specific note by ID.
 */
function applyRemoveNote(form: ParsedForm, patch: RemoveNotePatch): void {
  const index = form.notes.findIndex((n) => n.id === patch.noteId);
  if (index >= 0) {
    form.notes.splice(index, 1);
  }
  // If index < 0, note not found - validation should have caught this
}

/**
 * Apply a single patch to the form.
 */
function applyPatch(form: ParsedForm, responses: Record<Id, FieldResponse>, patch: Patch): void {
  switch (patch.op) {
    case 'set_string':
      applySetString(responses, patch);
      break;
    case 'set_number':
      applySetNumber(responses, patch);
      break;
    case 'set_string_list':
      applySetStringList(responses, patch);
      break;
    case 'set_single_select':
      applySetSingleSelect(responses, patch);
      break;
    case 'set_multi_select':
      applySetMultiSelect(responses, patch);
      break;
    case 'set_checkboxes':
      applySetCheckboxes(responses, patch);
      break;
    case 'set_url':
      applySetUrl(responses, patch);
      break;
    case 'set_url_list':
      applySetUrlList(responses, patch);
      break;
    case 'set_date':
      applySetDate(responses, patch);
      break;
    case 'set_year':
      applySetYear(responses, patch);
      break;
    case 'set_table':
      applySetTable(responses, patch);
      break;
    case 'clear_field':
      applyClearField(responses, patch);
      break;
    case 'skip_field':
      applySkipField(responses, patch);
      break;
    case 'abort_field':
      applyAbortField(responses, patch);
      break;
    case 'add_note':
      applyAddNote(form, patch);
      break;
    case 'remove_note':
      applyRemoveNote(form, patch);
      break;
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
      reason: vi.severity === 'error' ? 'validation_error' : 'optional_empty',
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
