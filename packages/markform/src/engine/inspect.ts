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
  /** Path to the form file (used for code validator loading) */
  formPath?: string;
  /** Skip code validators */
  skipCodeValidators?: boolean;
}

/**
 * Inspect a parsed form and return a unified result with summaries and issues.
 *
 * This is the main entry point for form inspection. It:
 * 1. Runs validation to get all issues
 * 2. Computes structure and progress summaries
 * 3. Converts ValidationIssues to InspectIssues
 * 4. Adds issues for empty optional fields
 * 5. Sorts all issues by priority (ascending, 1 = highest)
 *
 * @param form - The parsed form to inspect
 * @param options - Optional inspection options
 * @returns InspectResult with summaries and prioritized issues
 */
export async function inspect(
  form: ParsedForm,
  options: InspectOptions = {}
): Promise<InspectResult> {
  // Run validation
  const validationResult = await validate(form, {
    formPath: options.formPath,
    skipCodeValidators: options.skipCodeValidators,
  });

  // Compute summaries
  const structureSummary = computeStructureSummary(form.schema);
  const progressSummary = computeProgressSummary(
    form.schema,
    form.valuesByFieldId,
    validationResult.issues
  );
  const formState = computeFormState(progressSummary);

  // Convert validation issues to inspect issues
  const inspectIssues = convertToInspectIssues(
    validationResult.issues,
    form,
    progressSummary
  );

  // Check if complete (no required issues)
  const isComplete = !inspectIssues.some((i) => i.severity === "required");

  return {
    structureSummary,
    progressSummary,
    issues: inspectIssues,
    isComplete,
    formState,
  };
}

/**
 * Convert ValidationIssues to InspectIssues and add optional empty field issues.
 *
 * The conversion follows these rules:
 * - ValidationIssue.severity='error' → InspectIssue.severity='required'
 * - ValidationIssue.severity='warning'/'info' → InspectIssue.severity='recommended'
 * - Empty optional fields get severity='recommended', reason='optional_empty'
 *
 * Issues are sorted by priority (ascending, 1 = highest):
 * - Required issues get lower priority numbers (higher priority)
 * - Recommended issues get higher priority numbers (lower priority)
 */
function convertToInspectIssues(
  validationIssues: ValidationIssue[],
  form: ParsedForm,
  progressSummary: { fields: Record<string, { state: string }> }
): InspectIssue[] {
  const inspectIssues: InspectIssue[] = [];

  // Track which fields have validation issues
  const fieldsWithIssues = new Set<string>();

  // Convert validation issues
  for (const vi of validationIssues) {
    fieldsWithIssues.add(vi.ref ?? "");

    const severity: "required" | "recommended" =
      vi.severity === "error" ? "required" : "recommended";

    const reason = mapValidationToInspectReason(vi);
    const scope = determineScope(vi.ref ?? "", form);

    inspectIssues.push({
      ref: vi.ref ?? "",
      scope,
      reason,
      message: vi.message,
      severity,
      priority: 0, // Will be assigned after sorting
    });
  }

  // Add issues for empty optional fields that don't already have issues
  for (const [fieldId, fieldProgress] of Object.entries(
    progressSummary.fields
  )) {
    if (
      fieldProgress.state === "empty" &&
      !fieldsWithIssues.has(fieldId) &&
      !isRequiredField(fieldId, form)
    ) {
      inspectIssues.push({
        ref: fieldId,
        scope: "field",
        reason: "optional_empty",
        message: "Optional field has no value",
        severity: "recommended",
        priority: 0,
      });
    }
  }

  // Sort and assign priorities
  return sortAndAssignPriorities(inspectIssues);
}

/**
 * Map ValidationIssue to InspectIssue reason code.
 */
function mapValidationToInspectReason(
  vi: ValidationIssue
): InspectIssue["reason"] {
  // Check for specific patterns in the message or code
  // Required empty - check both code and message patterns
  if (
    vi.code === "REQUIRED_EMPTY" ||
    vi.message.toLowerCase().includes("required") && vi.message.toLowerCase().includes("empty")
  ) {
    return "required_empty";
  }

  // Invalid checkbox state
  if (
    vi.code === "INVALID_CHECKBOX_STATE" ||
    vi.message.toLowerCase().includes("checkbox state")
  ) {
    return "invalid_state";
  }

  // Constraint violations - min/max for various types
  if (
    vi.code === "MULTI_SELECT_TOO_FEW" ||
    vi.code === "MULTI_SELECT_TOO_MANY" ||
    vi.code === "STRING_LIST_MIN_ITEMS" ||
    vi.code === "STRING_LIST_MAX_ITEMS" ||
    vi.code === "NUMBER_MIN" ||
    vi.code === "NUMBER_MAX" ||
    vi.code === "STRING_MIN_LENGTH" ||
    vi.code === "STRING_MAX_LENGTH" ||
    vi.code === "STRING_PATTERN" ||
    vi.message.includes("at least") ||
    vi.message.includes("at most") ||
    vi.message.includes("must be")
  ) {
    return "constraint_violated";
  }

  // Default to validation_error for unrecognized issues
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
