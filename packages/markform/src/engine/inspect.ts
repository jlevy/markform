/**
 * Inspect module - provides the main entry point for form inspection.
 *
 * Combines validation results with summaries into a unified InspectResult,
 * with issues sorted by priority (ascending, 1 = highest).
 */
import type {
  ParsedForm,
  InspectResult,
  InspectIssue,
  ValidationIssue,
  IssueScope,
  IssueReason,
} from "./types";
import { validate } from "./validate";
import {
  computeStructureSummary,
  computeProgressSummary,
  computeFormState,
} from "./summaries";

/**
 * Inspect options for customizing behavior.
 */
export interface InspectOptions {
  /** Skip code validators */
  skipCodeValidators?: boolean;
}

/**
 * Inspect a parsed form and return a unified result with summaries and issues.
 *
 * This is the main entry point for form inspection. It:
 * 1. Runs validation to get all issues
 * 2. Converts ValidationIssues to InspectIssues
 * 3. Computes structure and progress summaries
 * 4. Adds issues for empty optional fields
 * 5. Sorts all issues by priority (ascending, 1 = highest)
 *
 * @param form - The parsed form to inspect
 * @param options - Optional inspection options
 * @returns InspectResult with summaries and prioritized issues
 */
export function inspect(
  form: ParsedForm,
  options: InspectOptions = {}
): InspectResult {
  // Run validation (synchronous)
  const validationResult = validate(form, {
    skipCodeValidators: options.skipCodeValidators,
  });

  // Convert validation issues to inspect issues first
  const validationInspectIssues = convertValidationIssues(
    validationResult.issues,
    form
  );

  // Compute structure summary
  const structureSummary = computeStructureSummary(form.schema);

  // Compute progress summary with the converted issues
  const progressSummary = computeProgressSummary(
    form.schema,
    form.valuesByFieldId,
    validationInspectIssues
  );
  const formState = computeFormState(progressSummary);

  // Add issues for empty optional fields
  const allIssues = addOptionalEmptyIssues(
    validationInspectIssues,
    form,
    progressSummary.fields
  );

  // Sort and assign priorities
  const sortedIssues = sortAndAssignPriorities(allIssues);

  // Check if complete (no required issues)
  const isComplete = !sortedIssues.some((i) => i.severity === "required");

  return {
    structureSummary,
    progressSummary,
    issues: sortedIssues,
    isComplete,
    formState,
  };
}

/**
 * Convert ValidationIssues to InspectIssues.
 */
function convertValidationIssues(
  validationIssues: ValidationIssue[],
  form: ParsedForm
): InspectIssue[] {
  return validationIssues.map((vi) => ({
    ref: vi.ref ?? "",
    scope: determineScope(vi.ref ?? "", form),
    reason: mapValidationToInspectReason(vi),
    message: vi.message,
    severity: vi.severity === "error" ? "required" : "recommended",
    priority: 0, // Will be assigned after sorting
  }));
}

/**
 * Add issues for empty optional fields that don't already have issues.
 */
function addOptionalEmptyIssues(
  existingIssues: InspectIssue[],
  form: ParsedForm,
  fieldProgress: Record<string, { state: string }>
): InspectIssue[] {
  const issues = [...existingIssues];
  const fieldsWithIssues = new Set(existingIssues.map((i) => i.ref));

  for (const [fieldId, progress] of Object.entries(fieldProgress)) {
    if (
      progress.state === "empty" &&
      !fieldsWithIssues.has(fieldId) &&
      !isRequiredField(fieldId, form)
    ) {
      issues.push({
        ref: fieldId,
        scope: "field",
        reason: "optional_empty",
        message: "Optional field has no value",
        severity: "recommended",
        priority: 0,
      });
    }
  }

  return issues;
}

/**
 * Map ValidationIssue to InspectIssue reason code.
 */
function mapValidationToInspectReason(vi: ValidationIssue): IssueReason {
  // Check for specific patterns in the message or code
  // Required empty - check both code and message patterns
  if (
    vi.code === "REQUIRED_EMPTY" ||
    (vi.message.toLowerCase().includes("required") &&
      vi.message.toLowerCase().includes("empty"))
  ) {
    return "required_missing";
  }

  // Invalid checkbox state
  if (
    vi.code === "INVALID_CHECKBOX_STATE" ||
    vi.code === "CHECKBOXES_INCOMPLETE" ||
    vi.message.toLowerCase().includes("checkbox")
  ) {
    return "checkbox_incomplete";
  }

  // Min items violations
  if (
    vi.code === "MULTI_SELECT_TOO_FEW" ||
    vi.code === "STRING_LIST_MIN_ITEMS" ||
    vi.message.includes("at least")
  ) {
    return "min_items_not_met";
  }

  // Default to validation_error for other issues
  return "validation_error";
}

/**
 * Determine the scope of an issue based on the ref.
 */
function determineScope(ref: string, form: ParsedForm): IssueScope {
  // Check if it's an option reference (contains a dot)
  if (ref.includes(".")) {
    return "option";
  }

  // Check if it's the form ID
  if (ref === form.schema.id) {
    return "form";
  }

  // Check if it's a group ID
  for (const group of form.schema.groups) {
    if (ref === group.id) {
      return "group";
    }
  }

  // Default to field
  return "field";
}

/**
 * Check if a field is required.
 */
function isRequiredField(fieldId: string, form: ParsedForm): boolean {
  for (const group of form.schema.groups) {
    for (const field of group.children) {
      if (field.id === fieldId) {
        return field.required ?? false;
      }
    }
  }
  return false;
}

/**
 * Sort issues by severity and assign priority numbers.
 *
 * Required issues get lower priority numbers (1, 2, 3...)
 * Recommended issues get higher priority numbers (continuing from required)
 */
function sortAndAssignPriorities(issues: InspectIssue[]): InspectIssue[] {
  // Separate by severity
  const requiredIssues = issues.filter((i) => i.severity === "required");
  const recommendedIssues = issues.filter((i) => i.severity === "recommended");

  // Sort each group by ref for deterministic ordering
  requiredIssues.sort((a, b) => a.ref.localeCompare(b.ref));
  recommendedIssues.sort((a, b) => a.ref.localeCompare(b.ref));

  // Assign priorities
  let priority = 1;

  for (const issue of requiredIssues) {
    issue.priority = priority++;
  }

  for (const issue of recommendedIssues) {
    issue.priority = priority++;
  }

  // Return combined sorted list
  return [...requiredIssues, ...recommendedIssues];
}
