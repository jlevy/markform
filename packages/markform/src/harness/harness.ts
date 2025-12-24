/**
 * Form Harness - Execution harness for form filling.
 *
 * Manages the step protocol for agent-driven form completion:
 * INIT -> STEP -> WAIT -> APPLY -> (repeat) -> COMPLETE
 */

import { createHash } from "node:crypto";

import { applyPatches } from "../engine/apply.js";
import { inspect } from "../engine/inspect.js";
import { serialize } from "../engine/serialize.js";
import type {
  HarnessConfig,
  InspectIssue,
  ParsedForm,
  Patch,
  SessionTurn,
  StepResult,
} from "../engine/types.js";
import {
  DEFAULT_MAX_ISSUES,
  DEFAULT_MAX_PATCHES_PER_TURN,
  DEFAULT_MAX_TURNS,
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
   */
  hasReachedMaxTurns(): boolean {
    return this.turnNumber >= this.config.maxTurns;
  }

  /**
   * Perform a step - inspect the form and return current state.
   *
   * This transitions from INIT/WAIT -> STEP state.
   * Returns the current form state with prioritized issues.
   */
  step(): StepResult {
    if (this.state === "complete") {
      throw new Error("Harness is complete - cannot step");
    }

    // Increment turn number
    this.turnNumber++;

    // Check max turns
    if (this.turnNumber > this.config.maxTurns) {
      this.state = "complete";
      const result = inspect(this.form);
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

    // Inspect form
    const result = inspect(this.form);

    // Filter issues by fields/groups if limits are configured
    const filteredIssues = this.filterIssuesByScope(result.issues);

    // Limit issues to maxIssues
    const limitedIssues = filteredIssues.slice(0, this.config.maxIssues);

    // Calculate step budget
    const stepBudget = Math.min(
      this.config.maxPatchesPerTurn,
      limitedIssues.filter((i) => i.severity === "required").length
    );

    // If complete, transition to complete state
    if (result.isComplete) {
      this.state = "complete";
    } else {
      this.state = "wait";
    }

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
   * Apply patches to the form.
   *
   * This transitions from WAIT -> STEP/COMPLETE state.
   * Records the turn in the session transcript.
   *
   * @param patches - Patches to apply
   * @param issues - Issues that were shown to the agent (for recording)
   * @returns StepResult after applying patches
   */
  apply(patches: Patch[], issues: InspectIssue[]): StepResult {
    if (this.state !== "wait") {
      throw new Error(`Cannot apply in state: ${this.state}`);
    }

    if (patches.length > this.config.maxPatchesPerTurn) {
      throw new Error(
        `Too many patches: ${patches.length} > ${this.config.maxPatchesPerTurn}`
      );
    }

    // Apply patches
    const result = applyPatches(this.form, patches);

    // Compute markdown hash
    const markdown = serialize(this.form);
    const hash = createHash("sha256").update(markdown).digest("hex");

    // Record turn
    const requiredIssueCount = result.issues.filter(
      (i) => i.severity === "required"
    ).length;

    this.turns.push({
      turn: this.turnNumber,
      inspect: { issues },
      apply: { patches },
      after: {
        requiredIssueCount,
        markdownSha256: hash,
      },
    });

    // Filter and limit issues for next step
    const filteredIssues = this.filterIssuesByScope(result.issues);
    const limitedIssues = filteredIssues.slice(0, this.config.maxIssues);

    // Calculate step budget for next turn
    const stepBudget = Math.min(
      this.config.maxPatchesPerTurn,
      limitedIssues.filter((i) => i.severity === "required").length
    );

    // Check if complete
    if (result.isComplete) {
      this.state = "complete";
    } else if (this.turnNumber >= this.config.maxTurns) {
      this.state = "complete";
    } else {
      this.state = "wait";
    }

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
   * Check if the form is complete.
   */
  isComplete(): boolean {
    const result = inspect(this.form);
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
    return createHash("sha256").update(markdown).digest("hex");
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
      if (parentEntry?.kind === "group") {
        return entry.parentId;
      }
    }

    return undefined;
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
