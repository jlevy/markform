/**
 * Summary computation for Markform documents.
 *
 * Computes structure and progress summaries from parsed forms.
 */

import type {
  CheckboxesField,
  CheckboxesValue,
  CheckboxProgressCounts,
  ColumnTypeName,
  DateValue,
  Field,
  FieldKind,
  FieldProgress,
  FieldResponse,
  FieldValue,
  FormSchema,
  Id,
  InspectIssue,
  MultiSelectValue,
  Note,
  NumberValue,
  ProgressCounts,
  ProgressState,
  ProgressSummary,
  QualifiedColumnRef,
  QualifiedOptionRef,
  AnswerState,
  SingleSelectValue,
  StringListValue,
  StringValue,
  StructureSummary,
  TableValue,
  UrlListValue,
  UrlValue,
  YearValue,
} from './coreTypes.js';

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
    url: 0,
    url_list: 0,
    date: 0,
    year: 0,
    table: 0,
  };

  const groupsById: Record<Id, 'field_group'> = {};
  const fieldsById: Record<Id, FieldKind> = {};
  const optionsById: Record<QualifiedOptionRef, { parentFieldId: Id; parentFieldKind: FieldKind }> =
    {};
  const columnsById: Record<QualifiedColumnRef, { parentFieldId: Id; columnType: ColumnTypeName }> =
    {};

  let groupCount = 0;
  let fieldCount = 0;
  let optionCount = 0;
  let columnCount = 0;

  for (const group of schema.groups) {
    groupCount++;
    groupsById[group.id] = 'field_group';

    for (const field of group.children) {
      fieldCount++;
      fieldCountByKind[field.kind]++;
      fieldsById[field.id] = field.kind;

      // Count options for select/checkbox fields
      if ('options' in field) {
        for (const opt of field.options) {
          optionCount++;
          const qualifiedRef: QualifiedOptionRef = `${field.id}.${opt.id}`;
          optionsById[qualifiedRef] = {
            parentFieldId: field.id,
            parentFieldKind: field.kind,
          };
        }
      }

      // Count columns for table fields
      if (field.kind === 'table') {
        for (const column of field.columns) {
          columnCount++;
          const qualifiedRef: QualifiedColumnRef = `${field.id}.${column.id}`;
          columnsById[qualifiedRef] = {
            parentFieldId: field.id,
            columnType: column.type,
          };
        }
      }
    }
  }

  return {
    groupCount,
    fieldCount,
    optionCount,
    columnCount,
    fieldCountByKind,
    groupsById,
    fieldsById,
    optionsById,
    columnsById,
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
    case 'string': {
      const v = value as StringValue;
      return v.value !== null && v.value.trim() !== '';
    }
    case 'number': {
      const v = value as NumberValue;
      return v.value !== null;
    }
    case 'string_list': {
      const v = value as StringListValue;
      return v.items.length > 0;
    }
    case 'single_select': {
      const v = value as SingleSelectValue;
      return v.selected !== null;
    }
    case 'multi_select': {
      const v = value as MultiSelectValue;
      return v.selected.length > 0;
    }
    case 'checkboxes': {
      const v = value as CheckboxesValue;
      const checkboxField = field;
      // For checkboxes, check if any option has been changed from default
      const mode = checkboxField.checkboxMode ?? 'multi';

      for (const opt of checkboxField.options) {
        const state = v.values[opt.id];
        if (mode === 'explicit') {
          // In explicit mode, "unfilled" is default, anything else is submitted
          if (state !== 'unfilled') {
            return true;
          }
        } else {
          // In multi/simple mode, "todo" is default, anything else is submitted
          if (state !== 'todo') {
            return true;
          }
        }
      }
      return false;
    }
    case 'url': {
      const v = value as UrlValue;
      return v.value !== null && v.value.trim() !== '';
    }
    case 'url_list': {
      const v = value as UrlListValue;
      return v.items.length > 0;
    }
    case 'date': {
      const v = value as DateValue;
      return v.value !== null && v.value.trim() !== '';
    }
    case 'year': {
      const v = value as YearValue;
      return v.value !== null;
    }
    case 'table': {
      const v = value as TableValue;
      return v.rows.length > 0;
    }
    default: {
      // Exhaustiveness check - TypeScript will error if a case is missing
      const _exhaustive: never = field;
      throw new Error(`Unhandled field kind: ${(_exhaustive as { kind: string }).kind}`);
    }
  }
}

/**
 * Compute checkbox progress counts for a checkboxes field.
 */
function computeCheckboxProgress(
  field: CheckboxesField,
  value: CheckboxesValue | undefined,
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
    const defaultState = field.checkboxMode === 'explicit' ? 'unfilled' : 'todo';
    for (const _opt of field.options) {
      result[defaultState]++;
    }
    return result;
  }

  for (const opt of field.options) {
    const state = value.values[opt.id] ?? 'todo';
    result[state]++;
  }

  return result;
}

/**
 * Compute whether a field is empty (has no value).
 */
function isFieldEmpty(field: Field, value: FieldValue | undefined): boolean {
  return !isFieldSubmitted(field, value);
}

/**
 * Compute progress for a single field.
 */
function computeFieldProgress(
  field: Field,
  response: FieldResponse,
  notes: Note[],
  issues: InspectIssue[],
): FieldProgress {
  const fieldIssues = issues.filter((i) => i.ref === field.id);
  const issueCount = fieldIssues.length;
  const value = response.value;
  const empty = isFieldEmpty(field, value);

  // Determine validity:
  // - Skipped/aborted fields with any issues are invalid (they've been addressed but problematic)
  // - Empty unanswered fields with only "required_missing" issues are NOT invalid (just empty)
  // - Fields with value validation issues are invalid
  let valid = true;
  if (response.state === 'skipped' || response.state === 'aborted') {
    // Skipped/aborted fields with any issues are invalid
    valid = issueCount === 0;
  } else if (empty) {
    // Empty unanswered fields: only invalid if they have issues OTHER than required_missing
    const valueIssues = fieldIssues.filter((i) => i.reason !== 'required_missing');
    valid = valueIssues.length === 0;
  } else {
    // Filled fields: invalid if any issues
    valid = issueCount === 0;
  }

  // Compute note-related fields
  const fieldNotes = notes.filter((n) => n.ref === field.id);
  const hasNotes = fieldNotes.length > 0;
  const noteCount = fieldNotes.length;

  const progress: FieldProgress = {
    kind: field.kind,
    required: field.required,
    answerState: response.state,
    hasNotes,
    noteCount,
    empty,
    valid,
    issueCount,
  };

  // Add checkbox progress for checkboxes fields
  if (field.kind === 'checkboxes') {
    progress.checkboxProgress = computeCheckboxProgress(
      field,
      value as CheckboxesValue | undefined,
    );
  }

  return progress;
}

// =============================================================================
// Progress Summary Computation
// =============================================================================

/**
 * Get the response state from a field response.
 * Helper function for progress computation.
 *
 * @param response - The field response (may be undefined)
 * @returns The response state
 */

function _getAnswerState(response: FieldResponse | undefined): AnswerState {
  if (!response) {
    return 'unanswered';
  }
  return response.state;
}

/**
 * Compute a progress summary for a form.
 *
 * @param schema - The form schema
 * @param responsesByFieldId - Current field responses (state + optional value)
 * @param notes - Notes attached to fields/groups/form
 * @param issues - Validation issues (from inspect)
 * @returns Progress summary with field states and counts
 */
export function computeProgressSummary(
  schema: FormSchema,
  responsesByFieldId: Record<Id, FieldResponse>,
  notes: Note[],
  issues: InspectIssue[],
): ProgressSummary {
  const fields: Record<Id, FieldProgress> = {};
  const counts: ProgressCounts = {
    totalFields: 0,
    requiredFields: 0,
    // Dimension 1: AnswerState
    unansweredFields: 0,
    answeredFields: 0,
    skippedFields: 0,
    abortedFields: 0,
    // Dimension 2: Validity
    validFields: 0,
    invalidFields: 0,
    // Dimension 3: Value presence
    emptyFields: 0,
    filledFields: 0,
    // Derived
    emptyRequiredFields: 0,
    totalNotes: notes.length,
  };

  for (const group of schema.groups) {
    for (const field of group.children) {
      const response = responsesByFieldId[field.id] ?? { state: 'unanswered' };
      const progress = computeFieldProgress(field, response, notes, issues);
      fields[field.id] = progress;

      // Update counts
      counts.totalFields++;
      if (progress.required) {
        counts.requiredFields++;
      }

      // Dimension 1: AnswerState (mutually exclusive)
      if (progress.answerState === 'answered') {
        counts.answeredFields++;
      } else if (progress.answerState === 'skipped') {
        counts.skippedFields++;
      } else if (progress.answerState === 'aborted') {
        counts.abortedFields++;
      } else if (progress.answerState === 'unanswered') {
        counts.unansweredFields++;
      }

      // Dimension 2: Validity (mutually exclusive)
      if (progress.valid) {
        counts.validFields++;
      } else {
        counts.invalidFields++;
      }

      // Dimension 3: Value presence (mutually exclusive)
      if (progress.empty) {
        counts.emptyFields++;
        if (progress.required) {
          counts.emptyRequiredFields++;
        }
      } else {
        counts.filledFields++;
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
  // Aborted fields = invalid state
  if (progress.counts.abortedFields > 0) {
    return 'invalid';
  }

  // If any field is invalid, form is invalid
  if (progress.counts.invalidFields > 0) {
    return 'invalid';
  }

  // If all required fields are filled and valid
  if (progress.counts.emptyRequiredFields === 0) {
    return 'complete';
  }

  // If any field is answered but not all required fields filled
  if (progress.counts.answeredFields > 0) {
    return 'incomplete';
  }

  return 'empty';
}

/**
 * Determine if the form is complete (ready for submission).
 *
 * A form is complete when:
 * 1. No aborted fields (aborted fields block completion)
 * 2. No required fields are empty
 * 3. No fields have validation errors
 * 4. No fields are in incomplete state (e.g., partial checkbox completion)
 * 5. All fields must be addressed (answered + skipped == total)
 *
 * Every field must be explicitly addressed - either filled with a value or
 * skipped with a reason. This ensures agents fully process all fields.
 *
 * @param progress - The progress summary
 * @returns True if the form is complete
 */
export function isFormComplete(progress: ProgressSummary): boolean {
  const { counts } = progress;

  // Aborted fields block completion
  if (counts.abortedFields > 0) {
    return false;
  }

  // Basic requirements: no invalid fields, all required fields filled
  const baseComplete = counts.invalidFields === 0 && counts.emptyRequiredFields === 0;

  // All fields must be addressed (filled or skipped)
  const allFieldsAccountedFor = counts.answeredFields + counts.skippedFields === counts.totalFields;

  return baseComplete && allFieldsAccountedFor;
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
 * @param responsesByFieldId - Current field responses (state + optional value)
 * @param notes - Notes attached to fields/groups/form
 * @param issues - Validation issues
 * @returns All computed summaries
 */
export function computeAllSummaries(
  schema: FormSchema,
  responsesByFieldId: Record<Id, FieldResponse>,
  notes: Note[],
  issues: InspectIssue[],
): ComputedSummaries {
  const structureSummary = computeStructureSummary(schema);
  const progressSummary = computeProgressSummary(schema, responsesByFieldId, notes, issues);
  const formState = computeFormState(progressSummary);
  const isComplete = isFormComplete(progressSummary);

  return {
    structureSummary,
    progressSummary,
    formState,
    isComplete,
  };
}
