/**
 * Parallel Harness - Orchestrates concurrent agent execution for parallel form filling.
 *
 * Uses the execution plan to identify parallel batches and order levels,
 * spawns concurrent agents for batch items, merges patches, and applies them.
 */

import { applyPatches } from '../engine/apply.js';
import type {
  ExecutionPlan,
  ExecutionPlanItem,
  InspectIssue,
  ParsedForm,
  Patch,
} from '../engine/coreTypes.js';
import { computeExecutionPlan } from '../engine/executionPlan.js';
import { inspect } from '../engine/inspect.js';
import type { Agent, AgentResponse } from './harnessTypes.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Scoped fill request for a parallel agent.
 * Provides the full form for context but limits the agent to specific fields.
 */
export interface ScopedFillRequest {
  /** Full form for read-only context */
  form: ParsedForm;
  /** Field IDs this agent should fill */
  targetFieldIds: string[];
  /** Group IDs this agent is responsible for */
  targetGroupIds: string[];
  /** Issues scoped to target fields */
  issues: InspectIssue[];
}

/**
 * Result of running a single order level.
 */
export interface ParallelStepResult {
  /** Total patches applied in this order level */
  patchesApplied: number;
  /** Whether any errors occurred */
  errors: string[];
}

/**
 * Result of running all order levels.
 */
export interface ParallelRunResult {
  /** Whether the form is complete */
  isComplete: boolean;
  /** Total patches applied across all levels */
  totalPatchesApplied: number;
  /** Order levels processed */
  orderLevelsProcessed: number[];
  /** Errors from any level */
  errors: string[];
}

/**
 * Configuration for the parallel harness.
 */
export interface ParallelHarnessConfig {
  /** Maximum concurrent agents for parallel batches (default: batch size) */
  maxParallelAgents?: number;
  /** Factory to create scoped agents for parallel batch items */
  agentFactory?: (request: ScopedFillRequest) => Agent;
  /** Callback when a parallel batch starts */
  onBatchStart?: (batchId: string) => void;
  /** Callback when a parallel batch completes */
  onBatchComplete?: (batchId: string) => void;
  /** Callback when an order level starts processing */
  onOrderLevelStart?: (order: number) => void;
  /** Callback when an order level completes */
  onOrderLevelComplete?: (order: number) => void;
  /** Target roles (default: ['agent']) */
  targetRoles?: string[];
  /** Max patches per agent turn */
  maxPatchesPerTurn?: number;
}

// =============================================================================
// Scope Filtering
// =============================================================================

/**
 * Get field IDs that belong to an execution plan item.
 */
function getFieldIdsForItem(form: ParsedForm, item: ExecutionPlanItem): string[] {
  if (item.itemType === 'field') {
    return [item.itemId];
  }
  const group = form.schema.groups.find((g) => g.id === item.itemId);
  if (!group) return [];
  return group.children.map((f) => f.id);
}

/**
 * Filter issues to only those relevant to an execution plan item's fields.
 * Form-scoped issues are excluded (they don't belong to individual agents).
 */
export function scopeIssuesForItem(
  form: ParsedForm,
  item: ExecutionPlanItem,
  allIssues: InspectIssue[],
): InspectIssue[] {
  const targetFieldIds = new Set(getFieldIdsForItem(form, item));

  return allIssues.filter((issue) => {
    if (issue.scope === 'form') return false;
    if (issue.scope === 'field') return targetFieldIds.has(issue.ref);
    if (issue.scope === 'option') {
      // Option refs are "fieldId.optionId"
      const dotIndex = issue.ref.indexOf('.');
      const fieldId = dotIndex > 0 ? issue.ref.slice(0, dotIndex) : issue.ref;
      return targetFieldIds.has(fieldId);
    }
    if (issue.scope === 'cell') {
      // Cell refs are "fieldId.columnId[rowIndex]"
      const dotIndex = issue.ref.indexOf('.');
      const fieldId = dotIndex > 0 ? issue.ref.slice(0, dotIndex) : issue.ref;
      return targetFieldIds.has(fieldId);
    }
    return false;
  });
}

// =============================================================================
// Parallel Harness
// =============================================================================

/**
 * Parallel harness that orchestrates concurrent agent execution.
 */
export class ParallelHarness {
  private form: ParsedForm;
  private plan: ExecutionPlan;
  private config: ParallelHarnessConfig;

  constructor(form: ParsedForm, config: ParallelHarnessConfig = {}) {
    this.form = form;
    this.plan = computeExecutionPlan(form);
    this.config = config;
  }

  /**
   * Get the execution plan.
   */
  getExecutionPlan(): ExecutionPlan {
    return this.plan;
  }

  /**
   * Run a single order level: execute loose serial items with the primary agent,
   * and parallel batch items concurrently.
   */
  async runOrderLevel(order: number, primaryAgent: Agent): Promise<ParallelStepResult> {
    const maxPatches = this.config.maxPatchesPerTurn ?? 20;
    let totalPatchesApplied = 0;
    const errors: string[] = [];

    // Get current issues for this form state
    const inspectResult = inspect(this.form);
    const allIssues = inspectResult.issues;

    // 1. Run loose serial items with primary agent
    const looseItems = this.plan.looseSerial.filter((i) => i.order === order);
    for (const item of looseItems) {
      const scopedIssues = scopeIssuesForItem(this.form, item, allIssues);
      if (scopedIssues.length === 0) continue;

      try {
        const response = await primaryAgent.fillFormTool(scopedIssues, this.form, maxPatches);
        if (response.patches.length > 0) {
          const result = applyPatches(this.form, response.patches);
          totalPatchesApplied += result.appliedPatches.length;
        }
      } catch (err) {
        errors.push(`Loose serial item ${item.itemId}: ${String(err)}`);
      }
    }

    // 2. Run parallel batch items concurrently
    for (const batch of this.plan.parallelBatches) {
      const batchItems = batch.items.filter((i) => i.order === order);
      if (batchItems.length === 0) continue;

      this.config.onBatchStart?.(batch.batchId);

      // Re-inspect after loose serial to get updated issues
      const batchInspect = inspect(this.form);
      const batchIssues = batchInspect.issues;

      const maxConcurrent = this.config.maxParallelAgents ?? batchItems.length;

      // Create promises for each batch item (limited concurrency)
      const agentPromises: Promise<AgentResponse>[] = [];
      const itemFieldIds = new Map<number, string[]>();

      for (let i = 0; i < batchItems.length; i++) {
        const item = batchItems[i]!;
        const scopedIssues = scopeIssuesForItem(this.form, item, batchIssues);
        const targetFieldIds = getFieldIdsForItem(this.form, item);
        itemFieldIds.set(i, targetFieldIds);

        if (scopedIssues.length === 0) {
          agentPromises.push(Promise.resolve({ patches: [] }));
          continue;
        }

        const request: ScopedFillRequest = {
          form: this.form,
          targetFieldIds,
          targetGroupIds: item.itemType === 'group' ? [item.itemId] : [],
          issues: scopedIssues,
        };

        // Use agentFactory if provided, otherwise use primary agent
        const agent = this.config.agentFactory ? this.config.agentFactory(request) : primaryAgent;

        agentPromises.push(agent.fillFormTool(scopedIssues, this.form, maxPatches));
      }

      // Run with concurrency limit
      const results = await runWithConcurrency(agentPromises, maxConcurrent);

      // Merge all patches from parallel agents
      const allPatches: Patch[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allPatches.push(...result.value.patches);
        } else {
          errors.push(`Parallel agent error: ${result.reason}`);
        }
      }

      // Apply merged patches in one call
      if (allPatches.length > 0) {
        const applyResult = applyPatches(this.form, allPatches);
        totalPatchesApplied += applyResult.appliedPatches.length;
      }

      this.config.onBatchComplete?.(batch.batchId);
    }

    return { patchesApplied: totalPatchesApplied, errors };
  }

  /**
   * Run all order levels sequentially, filling the entire form.
   */
  async runAll(primaryAgent: Agent): Promise<ParallelRunResult> {
    let totalPatchesApplied = 0;
    const orderLevelsProcessed: number[] = [];
    const allErrors: string[] = [];

    for (const order of this.plan.orderLevels) {
      this.config.onOrderLevelStart?.(order);

      const result = await this.runOrderLevel(order, primaryAgent);
      totalPatchesApplied += result.patchesApplied;
      orderLevelsProcessed.push(order);
      allErrors.push(...result.errors);

      this.config.onOrderLevelComplete?.(order);
    }

    // Check final form state
    const finalInspect = inspect(this.form);

    return {
      isComplete: finalInspect.isComplete,
      totalPatchesApplied,
      orderLevelsProcessed,
      errors: allErrors,
    };
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Run promises with a concurrency limit.
 * Returns results in the same order as input.
 */
async function runWithConcurrency<T>(
  promises: Promise<T>[],
  maxConcurrent: number,
): Promise<PromiseSettledResult<T>[]> {
  if (maxConcurrent >= promises.length) {
    return Promise.allSettled(promises);
  }

  // Simple semaphore-based concurrency limiter
  const results: PromiseSettledResult<T>[] = new Array<PromiseSettledResult<T>>(promises.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    while (nextIndex < promises.length) {
      const idx = nextIndex++;
      try {
        const value = await promises[idx]!;
        results[idx] = { status: 'fulfilled', value };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrent, promises.length) }, () => runNext());
  await Promise.all(workers);

  return results;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a parallel harness for the given form.
 */
export function createParallelHarness(
  form: ParsedForm,
  config?: ParallelHarnessConfig,
): ParallelHarness {
  return new ParallelHarness(form, config);
}
