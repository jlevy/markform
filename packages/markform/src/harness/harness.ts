/**
 * Form Harness - Execution harness for form filling.
 *
 * Manages the step protocol for agent-driven form completion:
 * INIT -> STEP -> WAIT -> APPLY -> (repeat) -> COMPLETE
 */

// Use pure JS sha256 to avoid node:crypto dependency, enabling use in
// browsers, edge runtimes (Cloudflare Workers, Convex), and other non-Node environments.
import { sha256 } from "js-sha256";

import { applyPatches } from "../engine/apply.js";
import { inspect, getFieldsForRoles } from "../engine/inspect.js";
import { serialize } from "../engine/serialize.js";
import type {
  ClearFieldPatch,
  HarnessConfig,
  InspectIssue,
  ParsedForm,
  Patch,
  SessionTurn,
  SessionTurnStats,
  StepResult,
} from "../engine/coreTypes.js";
import {
  DEFAULT_MAX_ISSUES,
  DEFAULT_MAX_PATCHES_PER_TURN,
  DEFAULT_MAX_TURNS,
  AGENT_ROLE,
} from "../settings.js";

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: HarnessConfig = {
  maxIssues: DEFAULT_MAX_ISSUES,
  maxPatchesPerTurn: DEFAULT_MAX_PATCHES_PER_TURN,
  maxTurns: DEFAULT_MAX_TURNS,
};

// =============================================================================
// Harness State
// =============================================================================

type HarnessState = "init" | "step" | "wait" | "complete";

// =============================================================================
// Form Harness Class
// =============================================================================

/**
 * Form harness for managing agent-driven form filling.
 */
export class FormHarness {
  private form: ParsedForm;
  private config: HarnessConfig;
  private state: HarnessState = "init";
  private turnNumber = 0;
  private turns: SessionTurn[] = [];

  constructor(form: ParsedForm, config: Partial<HarnessConfig> = {}) {
    this.form = form;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the current harness state.
   */
  getState(): HarnessState {
    return this.state;
  }

  /**
   * Get the current turn number.
   */
  getTurnNumber(): number {
    return this.turnNumber;
  }

  /**
   * Get the recorded session turns.
   */
  getTurns(): SessionTurn[] {
    return [...this.turns];
  }

  /**
   * Get the current form.
   */
  getForm(): ParsedForm {
    return this.form;
  }

  /**
   * Check if the harness has reached max turns.
   *
   * Returns true when we've completed all allowed turns. This happens when:
   * - turnNumber >= maxTurns AND we've already applied (state is "complete")
   * - OR turnNumber > maxTurns (we've exceeded the limit)
   *
   * This allows the harness loop to run N times when maxTurns=N by returning
   * false when we're at turn N but haven't applied yet (state is "wait").
   */
  hasReachedMaxTurns(): boolean {
    // If we've exceeded the limit, always return true
    if (this.turnNumber > this.config.maxTurns) {
      return true;
    }
    // At the last turn, check if we've completed it (state transitioned to "complete")
    if (this.turnNumber === this.config.maxTurns && this.state === "complete") {
      return true;
    }
    return false;
  }

  /**
   * Perform a step - inspect the form and return current state.
   *
   * This transitions from INIT/WAIT -> STEP state.
   * Returns the current form state with prioritized issues.
   *
   * On first step with fillMode='overwrite', clears all target role fields
   * so they will be reported as needing to be filled.
   */
  step(): StepResult {
    if (this.state === "complete") {
      throw new Error("Harness is complete - cannot step");
    }

    // On first step with fillMode='overwrite', clear all target role fields
    if (this.state === "init" && this.config.fillMode === "overwrite") {
      this.clearTargetRoleFields();
    }

    // Increment turn number
    this.turnNumber++;

    // Check max turns
    if (this.turnNumber > this.config.maxTurns) {
      this.state = "complete";
      const result = inspect(this.form, { targetRoles: this.config.targetRoles });
      return {
        structureSummary: result.structureSummary,
        progressSummary: result.progressSummary,
        issues: [],
        stepBudget: 0,
        isComplete: result.isComplete,
        turnNumber: this.turnNumber,
      };
    }

    this.state = "step";

    // Inspect form and compute step result
    const result = inspect(this.form, { targetRoles: this.config.targetRoles });
    const stepResult = this.computeStepResult(result);

    // Transition state based on whether there's more work
    this.state = stepResult.issues.length === 0 ? "complete" : "wait";

    return stepResult;
  }

  /**
   * Apply patches to the form.
   *
   * This transitions from WAIT -> STEP/COMPLETE state.
   * Records the turn in the session transcript.
   *
   * @param patches - Patches to apply
   * @param issues - Issues that were shown to the agent (for recording)
   * @param llmStats - Optional LLM stats for session logging
   * @returns StepResult after applying patches
   */
  apply(patches: Patch[], issues: InspectIssue[], llmStats?: SessionTurnStats): StepResult {
    if (this.state !== "wait") {
      throw new Error(`Cannot apply in state: ${this.state}`);
    }

    if (patches.length > this.config.maxPatchesPerTurn) {
      throw new Error(
        `Too many patches: ${patches.length} > ${this.config.maxPatchesPerTurn}`
      );
    }

    // Apply patches
    applyPatches(this.form, patches);

    // Re-inspect after applying patches to get full issue list including optional_empty
    const result = inspect(this.form, { targetRoles: this.config.targetRoles });
    const stepResult = this.computeStepResult(result);

    // Record turn in session transcript
    this.recordTurn(issues, patches, result, llmStats);

    // Transition state: complete if no more work OR max turns reached
    const noMoreWork = stepResult.issues.length === 0;
    if (noMoreWork || this.turnNumber >= this.config.maxTurns) {
      this.state = "complete";
    } else {
      this.state = "wait";
    }

    return stepResult;
  }

  /**
   * Compute step result from inspect result.
   * Applies issue filtering and computes step budget.
   */
  private computeStepResult(result: ReturnType<typeof inspect>): StepResult {
    // Issue filtering pipeline (order matters):
    // 1. Filter by maxGroupsPerTurn/maxFieldsPerTurn - limits scope diversity
    // 2. Cap by maxIssues - limits total count shown to agent
    const filteredIssues = this.filterIssuesByScope(result.issues);
    const limitedIssues = filteredIssues.slice(0, this.config.maxIssues);

    // Step budget = min of max patches per turn and issues to address
    const stepBudget = Math.min(
      this.config.maxPatchesPerTurn,
      limitedIssues.length
    );

    return {
      structureSummary: result.structureSummary,
      progressSummary: result.progressSummary,
      issues: limitedIssues,
      stepBudget,
      isComplete: result.isComplete,
      turnNumber: this.turnNumber,
    };
  }

  /**
   * Record a turn in the session transcript.
   */
  private recordTurn(
    issues: InspectIssue[],
    patches: Patch[],
    result: ReturnType<typeof inspect>,
    llmStats?: SessionTurnStats
  ): void {
    const markdown = serialize(this.form);
    const hash = sha256(markdown);

    const requiredIssueCount = result.issues.filter(
      (i) => i.severity === "required"
    ).length;

    const turn: SessionTurn = {
      turn: this.turnNumber,
      inspect: { issues },
      apply: { patches },
      after: {
        requiredIssueCount,
        markdownSha256: hash,
        answeredFieldCount: result.progressSummary.counts.answeredFields,
        skippedFieldCount: result.progressSummary.counts.skippedFields,
      },
    };

    if (llmStats) {
      turn.llm = llmStats;
    }

    this.turns.push(turn);
  }

  /**
   * Check if the form is complete.
   */
  isComplete(): boolean {
    const result = inspect(this.form, { targetRoles: this.config.targetRoles });
    return result.isComplete;
  }

  /**
   * Get the current markdown content of the form.
   */
  getMarkdown(): string {
    return serialize(this.form);
  }

  /**
   * Get the SHA256 hash of the current form markdown.
   */
  getMarkdownHash(): string {
    const markdown = serialize(this.form);
    return sha256(markdown);
  }

  /**
   * Filter issues based on maxFieldsPerTurn and maxGroupsPerTurn limits.
   *
   * Issues are processed in priority order. An issue is included if:
   * - Adding it doesn't exceed the field limit (for field/option scoped issues)
   * - Adding it doesn't exceed the group limit
   *
   * Form-level issues are always included.
   */
  private filterIssuesByScope(issues: InspectIssue[]): InspectIssue[] {
    const maxFields = this.config.maxFieldsPerTurn;
    const maxGroups = this.config.maxGroupsPerTurn;

    // If no limits configured, return all issues
    if (maxFields === undefined && maxGroups === undefined) {
      return issues;
    }

    const result: InspectIssue[] = [];
    const seenFields = new Set<string>();
    const seenGroups = new Set<string>();

    for (const issue of issues) {
      // Form-level issues always pass
      if (issue.scope === "form") {
        result.push(issue);
        continue;
      }

      // Extract field ID from ref (for options, it's "fieldId.optionId")
      const fieldId = this.getFieldIdFromRef(issue.ref, issue.scope);

      // Get the parent group for the field (if any)
      const groupId = fieldId ? this.getGroupForField(fieldId) : undefined;

      // Check field limit
      if (maxFields !== undefined && fieldId) {
        if (!seenFields.has(fieldId) && seenFields.size >= maxFields) {
          continue; // Would exceed field limit
        }
      }

      // Check group limit
      if (maxGroups !== undefined && groupId) {
        if (!seenGroups.has(groupId) && seenGroups.size >= maxGroups) {
          continue; // Would exceed group limit
        }
      }

      // Include the issue and track the field/group
      result.push(issue);
      if (fieldId) {
seenFields.add(fieldId);
}
      if (groupId) {
seenGroups.add(groupId);
}
    }

    return result;
  }

  /**
   * Extract field ID from an issue ref.
   */
  private getFieldIdFromRef(
    ref: string,
    scope: InspectIssue["scope"]
  ): string | undefined {
    if (scope === "field") {
      return ref;
    }
    if (scope === "option") {
      // Option refs are "fieldId.optionId"
      const dotIndex = ref.indexOf(".");
      return dotIndex > 0 ? ref.slice(0, dotIndex) : undefined;
    }
    // Group-level issues don't have a field
    return undefined;
  }

  /**
   * Get the parent group ID for a field.
   */
  private getGroupForField(fieldId: string): string | undefined {
    const entry = this.form.idIndex.get(fieldId);
    if (!entry) {
return undefined;
}

    // If the field has a parent and that parent is a group, return it
    if (entry.parentId) {
      const parentEntry = this.form.idIndex.get(entry.parentId);
      if (parentEntry?.nodeType === "group") {
        return entry.parentId;
      }
    }

    return undefined;
  }

  /**
   * Clear all fields that match the target roles.
   * Used when fillMode='overwrite' to re-fill already-filled fields.
   */
  private clearTargetRoleFields(): void {
    const targetRoles = this.config.targetRoles ?? [AGENT_ROLE];
    const targetFields = getFieldsForRoles(this.form, targetRoles);

    // Create clear patches for all target role fields
    const clearPatches: ClearFieldPatch[] = targetFields.map((field) => ({
      op: "clear_field" as const,
      fieldId: field.id,
    }));

    // Apply clear patches (this modifies the form in place)
    if (clearPatches.length > 0) {
      applyPatches(this.form, clearPatches);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new form harness.
 *
 * @param form - The parsed form to fill
 * @param config - Optional harness configuration
 * @returns A new FormHarness instance
 */
export function createHarness(
  form: ParsedForm,
  config?: Partial<HarnessConfig>
): FormHarness {
  return new FormHarness(form, config);
}
