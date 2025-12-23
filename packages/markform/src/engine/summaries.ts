/**
 * Summary computation for Markform documents.
 *
 * Computes structure and progress summaries from parsed forms.
 */

import type {
  CheckboxesField,
  CheckboxesValue,
  CheckboxProgressCounts,
  Field,
  FieldKind,
  FieldProgress,
  FieldValue,
  FormSchema,
  Id,
  InspectIssue,
  MultiSelectValue,
  NumberValue,
  ProgressCounts,
  ProgressState,
  ProgressSummary,
  QualifiedOptionRef,
  SingleSelectValue,
  StringListValue,
  StringValue,
  StructureSummary,
} from "./types.js";

// =============================================================================
// Structure Summary Computation
// =============================================================================

/**
 * Compute a structure summary from a form schema.
 *
 * @param schema - The form schema to summarize
 * @returns Structure summary with counts and indices
 */
export function computeStructureSummary(schema: FormSchema): StructureSummary {
  const fieldCountByKind: Record<FieldKind, number> = {
    string: 0,
    number: 0,
    string_list: 0,
    checkboxes: 0,
    single_select: 0,
    multi_select: 0,
  };

  const groupsById: Record<Id, "field_group"> = {};
  const fieldsById: Record<Id, FieldKind> = {};
  const optionsById: Record<
    QualifiedOptionRef,
    { parentFieldId: Id; parentFieldKind: FieldKind }
  > = {};

  let groupCount = 0;
  let fieldCount = 0;
  let optionCount = 0;

  for (const group of schema.groups) {
    groupCount++;
    groupsById[group.id] = "field_group";

    for (const field of group.children) {
      fieldCount++;
      fieldCountByKind[field.kind]++;
      fieldsById[field.id] = field.kind;

      // Count options for select/checkbox fields
      if ("options" in field) {
        for (const opt of field.options) {
          optionCount++;
          const qualifiedRef: QualifiedOptionRef = `${field.id}.${opt.id}`;
          optionsById[qualifiedRef] = {
            parentFieldId: field.id,
            parentFieldKind: field.kind,
          };
        }
      }
    }
  }

  return {
    groupCount,
    fieldCount,
    optionCount,
    fieldCountByKind,
    groupsById,
    fieldsById,
    optionsById,
  };
}

// =============================================================================
// Field Progress Computation
// =============================================================================

/**
 * Determine if a field value is "submitted" (has some user input).
 */
function isFieldSubmitted(field: Field, value: FieldValue | undefined): boolean {
  if (!value) {
    return false;
  }

  switch (field.kind) {
    case "string": {
      const v = value as StringValue;
      return v.value !== null && v.value.trim() !== "";
    }
    case "number": {
      const v = value as NumberValue;
      return v.value !== null;
    }
    case "string_list": {
      const v = value as StringListValue;
      return v.items.length > 0;
    }
    case "single_select": {
      const v = value as SingleSelectValue;
      return v.selected !== null;
    }
    case "multi_select": {
      const v = value as MultiSelectValue;
      return v.selected.length > 0;
    }
    case "checkboxes": {
      const v = value as CheckboxesValue;
      const checkboxField = field;
      // For checkboxes, check if any option has been changed from default
      const mode = checkboxField.checkboxMode ?? "multi";

      for (const opt of checkboxField.options) {
        const state = v.values[opt.id];
        if (mode === "explicit") {
          // In explicit mode, "unfilled" is default, anything else is submitted
          if (state !== "unfilled") {
            return true;
          }
        } else {
          // In multi/simple mode, "todo" is default, anything else is submitted
          if (state !== "todo") {
            return true;
          }
        }
      }
      return false;
    }
  }
}

/**
 * Compute checkbox progress counts for a checkboxes field.
 */
function computeCheckboxProgress(
  field: CheckboxesField,
  value: CheckboxesValue | undefined
): CheckboxProgressCounts {
  const result: CheckboxProgressCounts = {
    total: field.options.length,
    todo: 0,
    done: 0,
    incomplete: 0,
    active: 0,
    na: 0,
    unfilled: 0,
    yes: 0,
    no: 0,
  };

  if (!value) {
    // All options in default state
    const defaultState = field.checkboxMode === "explicit" ? "unfilled" : "todo";
    for (const _opt of field.options) {
      result[defaultState]++;
    }
    return result;
  }

  for (const opt of field.options) {
    const state = value.values[opt.id] ?? "todo";
    result[state]++;
  }

  return result;
}

/**
 * Check if a checkboxes field is complete based on its mode.
 */
function isCheckboxesComplete(
  field: CheckboxesField,
  value: CheckboxesValue | undefined
): boolean {
  if (!value) {
    return false;
  }

  const mode = field.checkboxMode ?? "multi";

  for (const opt of field.options) {
    const state = value.values[opt.id];
    if (mode === "explicit") {
      // Explicit mode: must be yes or no (not unfilled)
      if (state === "unfilled") {
        return false;
      }
    } else if (mode === "multi") {
      // Multi mode: must be done or na (not todo, incomplete, or active)
      if (state === "todo" || state === "incomplete" || state === "active") {
        return false;
      }
    }
    // Simple mode: any state is valid (just checked or unchecked)
  }

  return true;
}

/**
 * Compute the progress state for a field.
 */
function computeFieldState(
  field: Field,
  value: FieldValue | undefined,
  issueCount: number
): ProgressState {
  const submitted = isFieldSubmitted(field, value);

  if (!submitted) {
    return "empty";
  }

  if (issueCount > 0) {
    return "invalid";
  }

  // For checkboxes, check if all items are in a "complete" state
  if (field.kind === "checkboxes" && value?.kind === "checkboxes") {
    const checkboxField = field;
    if (!isCheckboxesComplete(checkboxField, value)) {
      return "incomplete";
    }
  }

  return "complete";
}

/**
 * Compute progress for a single field.
 */
function computeFieldProgress(
  field: Field,
  value: FieldValue | undefined,
  issues: InspectIssue[]
): FieldProgress {
  const fieldIssues = issues.filter((i) => i.fieldId === field.id);
  const issueCount = fieldIssues.length;
  const submitted = isFieldSubmitted(field, value);
  const valid = issueCount === 0;
  const state = computeFieldState(field, value, issueCount);

  const progress: FieldProgress = {
    kind: field.kind,
    required: field.required ?? false,
    submitted,
    state,
    valid,
    issueCount,
  };

  // Add checkbox progress for checkboxes fields
  if (field.kind === "checkboxes") {
    progress.checkboxProgress = computeCheckboxProgress(
      field,
      value as CheckboxesValue | undefined
    );
  }

  return progress;
}

// =============================================================================
// Progress Summary Computation
// =============================================================================

/**
 * Compute a progress summary for a form.
 *
 * @param schema - The form schema
 * @param values - Current field values
 * @param issues - Validation issues (from inspect)
 * @returns Progress summary with field states and counts
 */
export function computeProgressSummary(
  schema: FormSchema,
  values: Record<Id, FieldValue>,
  issues: InspectIssue[]
): ProgressSummary {
  const fields: Record<Id, FieldProgress> = {};
  const counts: ProgressCounts = {
    totalFields: 0,
    requiredFields: 0,
    submittedFields: 0,
    completeFields: 0,
    incompleteFields: 0,
    invalidFields: 0,
    emptyRequiredFields: 0,
    emptyOptionalFields: 0,
  };

  for (const group of schema.groups) {
    for (const field of group.children) {
      const value = values[field.id];
      const progress = computeFieldProgress(field, value, issues);
      fields[field.id] = progress;

      // Update counts
      counts.totalFields++;
      if (progress.required) {
        counts.requiredFields++;
      }
      if (progress.submitted) {
        counts.submittedFields++;
      }
      if (progress.state === "complete") {
        counts.completeFields++;
      }
      if (progress.state === "incomplete") {
        counts.incompleteFields++;
      }
      if (progress.state === "invalid") {
        counts.invalidFields++;
      }
      if (progress.state === "empty") {
        if (progress.required) {
          counts.emptyRequiredFields++;
        } else {
          counts.emptyOptionalFields++;
        }
      }
    }
  }

  return { counts, fields };
}

// =============================================================================
// Form State Computation
// =============================================================================

/**
 * Compute the overall form state from progress summary.
 *
 * @param progress - The progress summary
 * @returns The overall form state
 */
export function computeFormState(progress: ProgressSummary): ProgressState {
  // If any field is invalid, form is invalid
  if (progress.counts.invalidFields > 0) {
    return "invalid";
  }

  // If any field is incomplete, form is incomplete
  if (progress.counts.incompleteFields > 0) {
    return "incomplete";
  }

  // If all required fields are complete and no invalid fields
  if (progress.counts.emptyRequiredFields === 0) {
    return "complete";
  }

  // If any field is submitted but not all complete
  if (progress.counts.submittedFields > 0) {
    return "incomplete";
  }

  return "empty";
}

/**
 * Determine if the form is complete (ready for submission).
 *
 * @param progress - The progress summary
 * @returns True if the form is complete
 */
export function isFormComplete(progress: ProgressSummary): boolean {
  return (
    progress.counts.invalidFields === 0 &&
    progress.counts.incompleteFields === 0 &&
    progress.counts.emptyRequiredFields === 0
  );
}

// =============================================================================
// Helper to compute all summaries at once
// =============================================================================

export interface ComputedSummaries {
  structureSummary: StructureSummary;
  progressSummary: ProgressSummary;
  formState: ProgressState;
  isComplete: boolean;
}

/**
 * Compute all summaries for a parsed form.
 *
 * @param schema - The form schema
 * @param values - Current field values
 * @param issues - Validation issues
 * @returns All computed summaries
 */
export function computeAllSummaries(
  schema: FormSchema,
  values: Record<Id, FieldValue>,
  issues: InspectIssue[]
): ComputedSummaries {
  const structureSummary = computeStructureSummary(schema);
  const progressSummary = computeProgressSummary(schema, values, issues);
  const formState = computeFormState(progressSummary);
  const isComplete = isFormComplete(progressSummary);

  return {
    structureSummary,
    progressSummary,
    formState,
    isComplete,
  };
}
