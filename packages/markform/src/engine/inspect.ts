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
  FieldPriorityLevel,
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
  const sortedIssues = sortAndAssignPriorities(allIssues, form);

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
        return field.required;
      }
    }
  }
  return false;
}

/**
 * Priority scoring constants.
 *
 * Field priority weights:
 * - high: 3
 * - medium: 2 (default)
 * - low: 1
 *
 * Issue type scores:
 * - required_missing: 3
 * - validation_error: 2
 * - checkbox_incomplete: 3 (when required), 2 (when recommended)
 * - min_items_not_met: 2
 * - optional_empty: 1
 *
 * Total score = field_priority_weight + issue_type_score
 *
 * Priority tiers:
 * - P1: score >= 5
 * - P2: score >= 4
 * - P3: score >= 3
 * - P4: score >= 2
 * - P5: score >= 1
 */
const FIELD_PRIORITY_WEIGHTS: Record<FieldPriorityLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const ISSUE_TYPE_SCORES: Record<IssueReason, number> = {
  required_missing: 3,
  validation_error: 2,
  checkbox_incomplete: 2, // Base score, adjusted by severity
  min_items_not_met: 2,
  optional_empty: 1,
};

/**
 * Calculate the priority tier (1-5) from a score.
 */
function scoreToTier(score: number): number {
  if (score >= 5) {
return 1;
}
  if (score >= 4) {
return 2;
}
  if (score >= 3) {
return 3;
}
  if (score >= 2) {
return 4;
}
  return 5;
}

/**
 * Get the issue type score, potentially adjusted by severity.
 */
function getIssueTypeScore(reason: IssueReason, severity: "required" | "recommended"): number {
  const baseScore = ISSUE_TYPE_SCORES[reason];
  // checkbox_incomplete gets +1 when required
  if (reason === "checkbox_incomplete" && severity === "required") {
    return baseScore + 1;
  }
  return baseScore;
}

/**
 * Sort issues by priority tier and assign priority numbers.
 *
 * Priority is computed as a tier (1-5, P1-P5) based on:
 * - Field priority weight (high=3, medium=2, low=1)
 * - Issue type score (required_missing=3, validation_error=2, optional_empty=1)
 *
 * Within each tier, issues are sorted by severity (required first) then by ref.
 */
function sortAndAssignPriorities(
  issues: InspectIssue[],
  form: ParsedForm
): InspectIssue[] {
  // Calculate scores and assign tier-based priorities
  const scoredIssues = issues.map((issue) => {
    const fieldPriority = getFieldPriority(issue.ref, form);
    const fieldWeight = FIELD_PRIORITY_WEIGHTS[fieldPriority];
    const issueScore = getIssueTypeScore(issue.reason, issue.severity);
    const totalScore = fieldWeight + issueScore;
    const tier = scoreToTier(totalScore);

    return {
      ...issue,
      priority: tier,
      _score: totalScore, // For sorting within tier
    };
  });

  // Sort by:
  // 1. Priority tier (ascending, P1 first)
  // 2. Severity (required before recommended)
  // 3. Score (descending, higher scores first within tier)
  // 4. Ref (alphabetically for deterministic output)
  scoredIssues.sort((a, b) => {
    if (a.priority !== b.priority) {
return a.priority - b.priority;
}
    if (a.severity !== b.severity) {
      return a.severity === "required" ? -1 : 1;
    }
    if (a._score !== b._score) {
return b._score - a._score;
}
    return a.ref.localeCompare(b.ref);
  });

  // Remove internal _score field
  return scoredIssues.map(({ _score, ...issue }) => issue);
}

/**
 * Get the priority level for a field.
 */
function getFieldPriority(ref: string, form: ParsedForm): FieldPriorityLevel {
  // Handle option refs (fieldId.optionId)
  const fieldId = ref.includes(".") ? ref.split(".")[0] : ref;

  for (const group of form.schema.groups) {
    for (const field of group.children) {
      if (field.id === fieldId) {
        return field.priority;
      }
    }
  }
  return "medium"; // Fallback for non-field refs (groups, form)
}
