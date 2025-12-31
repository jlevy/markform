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
  Field,
  FieldProgress,
  Id,
} from './coreTypes';
import { DEFAULT_PRIORITY } from '../settings.js';
import { validate } from './validate';
import { computeStructureSummary, computeProgressSummary, computeFormState } from './summaries';

/**
 * Inspect options for customizing behavior.
 */
export interface InspectOptions {
  /** Skip code validators */
  skipCodeValidators?: boolean;
  /** Target roles to filter issues by (default: all roles, '*' means all) */
  targetRoles?: string[];
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
export function inspect(form: ParsedForm, options: InspectOptions = {}): InspectResult {
  // Run validation (synchronous)
  const validationResult = validate(form, {
    skipCodeValidators: options.skipCodeValidators,
  });

  // Convert validation issues to inspect issues first
  const validationInspectIssues = convertValidationIssues(validationResult.issues, form);

  // Compute structure summary
  const structureSummary = computeStructureSummary(form.schema);

  // Compute progress summary with the converted issues and responses
  const progressSummary = computeProgressSummary(
    form.schema,
    form.responsesByFieldId,
    form.notes,
    validationInspectIssues,
  );
  const formState = computeFormState(progressSummary);

  // Add issues for unanswered optional fields
  const allIssues = addOptionalUnansweredIssues(
    validationInspectIssues,
    form,
    progressSummary.fields,
  );

  // Sort and assign priorities
  const sortedIssues = sortAndAssignPriorities(allIssues, form);

  // Filter by role and add blocking annotations
  const issues = filterIssuesByRole(sortedIssues, form, options.targetRoles);

  // Form is complete when all issues for the target role(s) are resolved.
  // This is role-aware: if targeting only "agent" role, user-role fields don't matter.
  // Each field must be either filled (no optional_unanswered issue) or skipped.
  const isComplete = issues.length === 0;

  return {
    structureSummary,
    progressSummary,
    issues,
    isComplete,
    formState,
  };
}

/**
 * Convert ValidationIssues to InspectIssues.
 */
function convertValidationIssues(
  validationIssues: ValidationIssue[],
  form: ParsedForm,
): InspectIssue[] {
  return validationIssues.map((vi) => ({
    ref: vi.ref ?? '',
    scope: determineScope(vi.ref ?? '', form),
    reason: mapValidationToInspectReason(vi),
    message: vi.message,
    severity: vi.severity === 'error' ? 'required' : 'recommended',
    priority: 0, // Will be assigned after sorting
  }));
}

/**
 * Add issues for unanswered optional fields.
 *
 * An `optional_unanswered` issue is only added when:
 * - The field is optional (not required)
 * - The field has no value (empty=true)
 * - The field is unanswered (answerState='unanswered')
 *
 * Fields that have been addressed (answered, skipped, or aborted) do NOT get
 * optional_unanswered issues, even if their value is empty. For example:
 * - A multi_select answered with no selections (selected=[])
 * - A string_list answered with no items (items=[])
 * These are intentional "none" answers, not missing data.
 */
function addOptionalUnansweredIssues(
  existingIssues: InspectIssue[],
  form: ParsedForm,
  fieldProgress: Record<string, FieldProgress>,
): InspectIssue[] {
  const issues = [...existingIssues];
  const fieldsWithIssues = new Set(existingIssues.map((i) => i.ref));

  for (const [fieldId, progress] of Object.entries(fieldProgress)) {
    // Only add optional_unanswered for truly unanswered fields.
    // Fields that have been addressed (answered/skipped/aborted) should not
    // get this issue - the agent has made a decision about them.
    if (progress.answerState !== 'unanswered') {
      continue;
    }

    if (progress.empty && !fieldsWithIssues.has(fieldId) && !isRequiredField(fieldId, form)) {
      issues.push({
        ref: fieldId,
        scope: 'field',
        reason: 'optional_unanswered',
        message: 'Optional field not yet addressed',
        severity: 'recommended',
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
  const msg = vi.message.toLowerCase();

  // Check for specific patterns in the message or code
  // Required empty - check code and message patterns for various field kinds
  if (
    vi.code === 'REQUIRED_EMPTY' ||
    (msg.includes('required') && msg.includes('empty')) ||
    (msg.includes('required') && msg.includes('no selection')) ||
    (msg.includes('required') && msg.includes('no selections')) ||
    msg.includes('must be answered') ||
    msg.includes('must be completed') ||
    msg.includes('must be checked')
  ) {
    return 'required_missing';
  }

  // Invalid checkbox state (not about being empty)
  if (
    vi.code === 'INVALID_CHECKBOX_STATE' ||
    vi.code === 'CHECKBOXES_INCOMPLETE' ||
    msg.includes('checkbox')
  ) {
    return 'checkbox_incomplete';
  }

  // Min items violations
  if (
    vi.code === 'MULTI_SELECT_TOO_FEW' ||
    vi.code === 'STRING_LIST_MIN_ITEMS' ||
    vi.message.includes('at least')
  ) {
    return 'min_items_not_met';
  }

  // Default to validation_error for other issues
  return 'validation_error';
}

/**
 * Determine the scope of an issue based on the ref.
 */
function determineScope(ref: string, form: ParsedForm): IssueScope {
  // Check if it's an option reference (contains a dot)
  if (ref.includes('.')) {
    return 'option';
  }

  // Check if it's the form ID
  if (ref === form.schema.id) {
    return 'form';
  }

  // Check if it's a group ID
  for (const group of form.schema.groups) {
    if (ref === group.id) {
      return 'group';
    }
  }

  // Default to field
  return 'field';
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
 * - optional_unanswered: 1
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
  optional_unanswered: 1,
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
function getIssueTypeScore(reason: IssueReason, severity: 'required' | 'recommended'): number {
  const baseScore = ISSUE_TYPE_SCORES[reason];
  // checkbox_incomplete gets +1 when required
  if (reason === 'checkbox_incomplete' && severity === 'required') {
    return baseScore + 1;
  }
  return baseScore;
}

/**
 * Sort issues by priority tier and assign priority numbers.
 *
 * Priority is computed as a tier (1-5, P1-P5) based on:
 * - Field priority weight (high=3, medium=2, low=1)
 * - Issue type score (required_missing=3, validation_error=2, optional_unanswered=1)
 *
 * Within each tier, issues are sorted by severity (required first) then by ref.
 */
function sortAndAssignPriorities(issues: InspectIssue[], form: ParsedForm): InspectIssue[] {
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
      return a.severity === 'required' ? -1 : 1;
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
  const fieldId = ref.includes('.') ? ref.split('.')[0] : ref;

  for (const group of form.schema.groups) {
    for (const field of group.children) {
      if (field.id === fieldId) {
        return field.priority;
      }
    }
  }
  return DEFAULT_PRIORITY; // Fallback for non-field refs (groups, form)
}

// =============================================================================
// Role Filtering and Blocking Checkpoint Helpers
// =============================================================================

/**
 * Get all fields from the form schema as a flat array.
 */
export function getAllFields(form: ParsedForm): Field[] {
  return form.schema.groups.flatMap((g) => g.children);
}

/**
 * Find a field by its ID.
 */
export function findFieldById(form: ParsedForm, fieldId: Id): Field | undefined {
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
 * Get fields that match the target roles.
 * If targetRoles includes '*', returns all fields.
 */
export function getFieldsForRoles(form: ParsedForm, targetRoles: string[]): Field[] {
  const allFields = getAllFields(form);
  if (targetRoles.includes('*')) {
    return allFields;
  }
  return allFields.filter((field) => targetRoles.includes(field.role));
}

/**
 * Check if a checkbox field is complete based on its mode.
 *
 * Completion semantics by mode:
 * - 'all': All options must be done or n/a
 * - 'any': At least minDone (default 1) options must be done
 * - 'explicit': No options may be 'unfilled'
 */
export function isCheckboxComplete(form: ParsedForm, fieldId: Id): boolean {
  const field = findFieldById(form, fieldId);
  if (field?.kind !== 'checkboxes') {
    return true; // Non-checkbox fields are not blocking
  }

  const checkboxField = field;
  const response = form.responsesByFieldId[fieldId];

  // If no response or not answered, checkbox is not complete
  if (response?.state !== 'answered') {
    return false;
  }

  const value = response.value;
  if (value?.kind !== 'checkboxes') {
    return false;
  }

  const values = value.values;
  const optionIds = checkboxField.options.map((o) => o.id);
  const mode = checkboxField.checkboxMode;

  if (mode === 'multi') {
    // Multi mode: all options must be done or na (not todo, incomplete, or active)
    // If minDone is set, at least that many must be done
    const minDone = checkboxField.minDone;
    if (minDone !== undefined) {
      const doneCount = optionIds.filter((id) => values[id] === 'done').length;
      return doneCount >= minDone;
    }
    // Otherwise, all must be done or na
    return optionIds.every((id) => values[id] === 'done' || values[id] === 'na');
  }

  if (mode === 'simple') {
    // Simple mode (GFM-compatible): all options must be done (not todo)
    return optionIds.every((id) => values[id] === 'done');
  }

  if (mode === 'explicit') {
    // Explicit mode: no unfilled values remain (all must be yes or no)
    return optionIds.every((id) => values[id] !== 'unfilled');
  }

  // Default case (shouldn't happen with valid CheckboxMode)
  return true;
}

/**
 * Result of finding a blocking checkpoint.
 */
export interface BlockingCheckpointResult {
  /** Index in orderIndex where the blocking checkpoint is */
  index: number;
  /** Field ID of the blocking checkpoint */
  fieldId: Id;
}

/**
 * Find the first incomplete blocking checkpoint in the form.
 * Returns null if no blocking checkpoint is incomplete.
 */
export function findBlockingCheckpoint(form: ParsedForm): BlockingCheckpointResult | null {
  for (let i = 0; i < form.orderIndex.length; i++) {
    const fieldId = form.orderIndex[i];
    if (!fieldId) {
      continue;
    }

    const field = findFieldById(form, fieldId);
    if (field?.kind !== 'checkboxes') {
      continue;
    }

    const checkboxField = field;
    if (checkboxField.approvalMode === 'blocking' && !isCheckboxComplete(form, fieldId)) {
      return { index: i, fieldId };
    }
  }
  return null;
}

/**
 * Get the set of field IDs that are blocked by a checkpoint.
 * These are all fields that appear after the blocking checkpoint in orderIndex.
 */
export function getBlockedFieldIds(
  form: ParsedForm,
  blockingCheckpoint: BlockingCheckpointResult,
): Set<Id> {
  const blocked = new Set<Id>();
  for (let i = blockingCheckpoint.index + 1; i < form.orderIndex.length; i++) {
    const fieldId = form.orderIndex[i];
    if (fieldId) {
      blocked.add(fieldId);
    }
  }
  return blocked;
}

/**
 * Filter issues to only include those for fields matching target roles.
 * Also adds blockedBy annotation for fields blocked by a checkpoint.
 */
export function filterIssuesByRole(
  issues: InspectIssue[],
  form: ParsedForm,
  targetRoles?: string[],
): InspectIssue[] {
  // Find blocking checkpoint first
  const blockingCheckpoint = findBlockingCheckpoint(form);
  const blockedFieldIds = blockingCheckpoint
    ? getBlockedFieldIds(form, blockingCheckpoint)
    : new Set<Id>();

  // Get field IDs for target roles
  const targetFieldIds =
    targetRoles && !targetRoles.includes('*')
      ? new Set(getFieldsForRoles(form, targetRoles).map((f) => f.id))
      : null;

  return issues
    .map((issue) => {
      // Extract field ID from ref (handles both field refs and option refs)
      const fieldId = issue.ref.includes('.') ? issue.ref.split('.')[0] : issue.ref;

      // Check if this field is blocked
      const isBlocked = fieldId && blockedFieldIds.has(fieldId);
      const annotatedIssue: InspectIssue = isBlocked
        ? { ...issue, blockedBy: blockingCheckpoint!.fieldId }
        : issue;

      return annotatedIssue;
    })
    .filter((issue) => {
      // If no target roles specified, include all issues
      if (!targetFieldIds) {
        return true;
      }

      // Extract field ID and check if it matches target roles
      const fieldId = issue.ref.includes('.') ? (issue.ref.split('.')[0] ?? issue.ref) : issue.ref;

      // Include if field matches target roles, or if it's not a field ref (form/group level)
      const field = findFieldById(form, fieldId);
      return !field || targetFieldIds.has(fieldId);
    });
}
