/**
 * Patch application for Markform documents.
 *
 * Applies patches to update field values with validation.
 */

import type {
  ApplyResult,
  CheckboxesValue,
  CheckboxValue,
  ClearFieldPatch,
  Field,
  FieldValue,
  Id,
  InspectIssue,
  MultiSelectValue,
  NumberValue,
  OptionId,
  ParsedForm,
  Patch,
  SetCheckboxesPatch,
  SetMultiSelectPatch,
  SetNumberPatch,
  SetSingleSelectPatch,
  SetStringListPatch,
  SetStringPatch,
  SingleSelectValue,
  SkipFieldPatch,
  SkipInfo,
  StringListValue,
  StringValue,
} from "./coreTypes.js";
import {
  computeAllSummaries,
  computeFormState,
  isFormComplete,
} from "./summaries.js";
import { validate } from "./validate.js";

// =============================================================================
// Patch Validation
// =============================================================================

interface PatchError {
  patchIndex: number;
  message: string;
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
function validatePatch(
  form: ParsedForm,
  patch: Patch,
  index: number,
): PatchError | null {
  const field = findField(form, patch.fieldId);

  if (!field) {
    return {
      patchIndex: index,
      message: `Field "${patch.fieldId}" not found`,
    };
  }

  switch (patch.op) {
    case "set_string":
      if (field.kind !== "string") {
        return {
          patchIndex: index,
          message: `Cannot apply set_string to ${field.kind} field "${field.id}"`,
        };
      }
      break;

    case "set_number":
      if (field.kind !== "number") {
        return {
          patchIndex: index,
          message: `Cannot apply set_number to ${field.kind} field "${field.id}"`,
        };
      }
      break;

    case "set_string_list":
      if (field.kind !== "string_list") {
        return {
          patchIndex: index,
          message: `Cannot apply set_string_list to ${field.kind} field "${field.id}"`,
        };
      }
      break;

    case "set_single_select": {
      if (field.kind !== "single_select") {
        return {
          patchIndex: index,
          message: `Cannot apply set_single_select to ${field.kind} field "${field.id}"`,
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

    case "set_multi_select": {
      if (field.kind !== "multi_select") {
        return {
          patchIndex: index,
          message: `Cannot apply set_multi_select to ${field.kind} field "${field.id}"`,
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

    case "set_checkboxes": {
      if (field.kind !== "checkboxes") {
        return {
          patchIndex: index,
          message: `Cannot apply set_checkboxes to ${field.kind} field "${field.id}"`,
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

    case "clear_field":
      // Any field can be cleared
      break;

    case "skip_field":
      // Can only skip optional fields
      if (field.required) {
        return {
          patchIndex: index,
          message: `Cannot skip required field "${field.id}"`,
        };
      }
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
 * Apply a set_string patch.
 */
function applySetString(
  values: Record<Id, FieldValue>,
  patch: SetStringPatch,
): void {
  values[patch.fieldId] = {
    kind: "string",
    value: patch.value,
  } as StringValue;
}

/**
 * Apply a set_number patch.
 */
function applySetNumber(
  values: Record<Id, FieldValue>,
  patch: SetNumberPatch,
): void {
  values[patch.fieldId] = {
    kind: "number",
    value: patch.value,
  } as NumberValue;
}

/**
 * Apply a set_string_list patch.
 */
function applySetStringList(
  values: Record<Id, FieldValue>,
  patch: SetStringListPatch,
): void {
  values[patch.fieldId] = {
    kind: "string_list",
    items: patch.items,
  } as StringListValue;
}

/**
 * Apply a set_single_select patch.
 */
function applySetSingleSelect(
  values: Record<Id, FieldValue>,
  patch: SetSingleSelectPatch,
): void {
  values[patch.fieldId] = {
    kind: "single_select",
    selected: patch.selected,
  } as SingleSelectValue;
}

/**
 * Apply a set_multi_select patch.
 */
function applySetMultiSelect(
  values: Record<Id, FieldValue>,
  patch: SetMultiSelectPatch,
): void {
  values[patch.fieldId] = {
    kind: "multi_select",
    selected: patch.selected,
  } as MultiSelectValue;
}

/**
 * Apply a set_checkboxes patch (merges with existing values).
 */
function applySetCheckboxes(
  values: Record<Id, FieldValue>,
  patch: SetCheckboxesPatch,
): void {
  const existing = values[patch.fieldId] as CheckboxesValue | undefined;
  const existingValues = existing?.values ?? {};

  // Merge patch values with existing
  const merged: Record<OptionId, CheckboxValue> = {
    ...existingValues,
    ...patch.values,
  };

  values[patch.fieldId] = {
    kind: "checkboxes",
    values: merged,
  } as CheckboxesValue;
}

/**
 * Apply a clear_field patch.
 */
function applyClearField(
  form: ParsedForm,
  values: Record<Id, FieldValue>,
  patch: ClearFieldPatch,
): void {
  const field = findField(form, patch.fieldId);
  if (!field) {
return;
}

  // Create empty value based on field kind
  switch (field.kind) {
    case "string":
      values[patch.fieldId] = { kind: "string", value: null } as StringValue;
      break;
    case "number":
      values[patch.fieldId] = { kind: "number", value: null } as NumberValue;
      break;
    case "string_list":
      values[patch.fieldId] = { kind: "string_list", items: [] } as StringListValue;
      break;
    case "single_select":
      values[patch.fieldId] = { kind: "single_select", selected: null } as SingleSelectValue;
      break;
    case "multi_select":
      values[patch.fieldId] = { kind: "multi_select", selected: [] } as MultiSelectValue;
      break;
    case "checkboxes":
      values[patch.fieldId] = { kind: "checkboxes", values: {} } as CheckboxesValue;
      break;
  }
}

/**
 * Apply a skip_field patch.
 * Marks the field as skipped and clears any existing value.
 */
function applySkipField(
  form: ParsedForm,
  values: Record<Id, FieldValue>,
  skips: Record<Id, SkipInfo>,
  patch: SkipFieldPatch,
): void {
  const field = findField(form, patch.fieldId);
  if (!field) {
    return;
  }

  // Mark field as skipped
  skips[patch.fieldId] = {
    skipped: true,
    reason: patch.reason,
  };

  // Clear any existing value (skipped fields have no value)
  delete values[patch.fieldId];
}

/**
 * Apply a single patch to the values and skips.
 */
function applyPatch(
  form: ParsedForm,
  values: Record<Id, FieldValue>,
  skips: Record<Id, SkipInfo>,
  patch: Patch,
): void {
  switch (patch.op) {
    case "set_string":
      applySetString(values, patch);
      // Setting a value un-skips the field
      delete skips[patch.fieldId];
      break;
    case "set_number":
      applySetNumber(values, patch);
      delete skips[patch.fieldId];
      break;
    case "set_string_list":
      applySetStringList(values, patch);
      delete skips[patch.fieldId];
      break;
    case "set_single_select":
      applySetSingleSelect(values, patch);
      delete skips[patch.fieldId];
      break;
    case "set_multi_select":
      applySetMultiSelect(values, patch);
      delete skips[patch.fieldId];
      break;
    case "set_checkboxes":
      applySetCheckboxes(values, patch);
      delete skips[patch.fieldId];
      break;
    case "clear_field":
      applyClearField(form, values, patch);
      // Clearing also un-skips (different from skip)
      delete skips[patch.fieldId];
      break;
    case "skip_field":
      applySkipField(form, values, skips, patch);
      break;
  }
}

// =============================================================================
// Issue Conversion (ValidationIssue -> InspectIssue)
// =============================================================================

/**
 * Convert validation issues to inspect issues with priorities.
 */
function convertToInspectIssues(
  form: ParsedForm,
): InspectIssue[] {
  const result = validate(form, { skipCodeValidators: true });
  const issues: InspectIssue[] = [];
  let priority = 1;

  for (const vi of result.issues) {
    issues.push({
      ref: vi.ref ?? "",
      scope: "field", // Default to field scope; can be refined based on validator context
      reason: vi.severity === "error" ? "validation_error" : "optional_empty",
      message: vi.message,
      severity: vi.severity === "error" ? "required" : "recommended",
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
export function applyPatches(
  form: ParsedForm,
  patches: Patch[],
): ApplyResult {
  // Validate all patches first (transaction semantics)
  const errors = validatePatches(form, patches);
  if (errors.length > 0) {
    // Reject - compute summaries from current state
    const summaries = computeAllSummaries(form.schema, form.valuesByFieldId, [], form.skipsByFieldId);
    const issues = convertToInspectIssues(form);

    return {
      applyStatus: "rejected",
      structureSummary: summaries.structureSummary,
      progressSummary: summaries.progressSummary,
      issues,
      isComplete: summaries.isComplete,
      formState: summaries.formState,
    };
  }

  // Create new values and skips objects (don't mutate original)
  const newValues: Record<Id, FieldValue> = { ...form.valuesByFieldId };
  const newSkips: Record<Id, SkipInfo> = { ...form.skipsByFieldId };

  // Apply all patches
  for (const patch of patches) {
    applyPatch(form, newValues, newSkips, patch);
  }

  // Update form with new values and skips
  form.valuesByFieldId = newValues;
  form.skipsByFieldId = newSkips;

  // Compute new summaries
  const issues = convertToInspectIssues(form);
  const summaries = computeAllSummaries(form.schema, newValues, issues, newSkips);

  return {
    applyStatus: "applied",
    structureSummary: summaries.structureSummary,
    progressSummary: summaries.progressSummary,
    issues,
    isComplete: isFormComplete(summaries.progressSummary),
    formState: computeFormState(summaries.progressSummary),
  };
}
