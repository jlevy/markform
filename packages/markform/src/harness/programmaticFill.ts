/**
 * Programmatic Fill API - High-level entry point for form filling.
 *
 * Provides a single-function API for external agentic systems to execute
 * form-filling sessions with a single function call.
 */

import type { LanguageModel } from 'ai';

import { applyPatches } from '../engine/apply.js';
import type {
  ExecutionPlanItem,
  FieldValue,
  InspectIssue,
  ParsedForm,
  PatchRejection,
  SessionTurnContext,
  SessionTurnStats,
} from '../engine/coreTypes.js';
import { computeExecutionPlan } from '../engine/executionPlan.js';
import { inspect } from '../engine/inspect.js';
import { parseForm } from '../engine/parse.js';
import { serializeForm } from '../engine/serialize.js';
import { coerceInputContext } from '../engine/valueCoercion.js';
import {
  AGENT_ROLE,
  DEFAULT_MAX_ISSUES_PER_TURN,
  DEFAULT_MAX_PARALLEL_AGENTS,
  DEFAULT_MAX_PATCHES_PER_TURN,
  DEFAULT_MAX_TURNS,
} from '../settings.js';
import { createHarness } from './harness.js';
import { createLiveAgent } from './liveAgent.js';
import { resolveModel } from './modelResolver.js';
import { runWithConcurrency, scopeIssuesForItem } from './parallelHarness.js';
import type { Agent, FillOptions, FillResult, FillStatus } from './harnessTypes.js';

// Re-export types for backwards compatibility
export type { FillOptions, FillResult, FillStatus, TurnProgress } from './harnessTypes.js';

// =============================================================================
// Helper Functions
// =============================================================================

function buildErrorResult(form: ParsedForm, errors: string[], warnings: string[]): FillResult {
  // Extract values from responses
  const values: Record<string, FieldValue> = {};
  for (const [fieldId, response] of Object.entries(form.responsesByFieldId)) {
    if (response.state === 'answered' && response.value) {
      values[fieldId] = response.value;
    }
  }

  return {
    status: {
      ok: false,
      reason: 'error',
      message: errors.join('; '),
    },
    markdown: serializeForm(form),
    values,
    form,
    turns: 0,
    totalPatches: 0,
    inputContextWarnings: warnings.length > 0 ? warnings : undefined,
  };
}

function buildResult(
  form: ParsedForm,
  turns: number,
  totalPatches: number,
  status: FillStatus,
  inputContextWarnings?: string[],
  remainingIssues?: InspectIssue[],
): FillResult {
  // Extract values from responses
  const values: Record<string, FieldValue> = {};
  for (const [fieldId, response] of Object.entries(form.responsesByFieldId)) {
    if (response.state === 'answered' && response.value) {
      values[fieldId] = response.value;
    }
  }

  const result: FillResult = {
    status,
    markdown: serializeForm(form),
    values,
    form,
    turns,
    totalPatches,
  };

  if (inputContextWarnings && inputContextWarnings.length > 0) {
    result.inputContextWarnings = inputContextWarnings;
  }

  if (remainingIssues && remainingIssues.length > 0) {
    result.remainingIssues = remainingIssues.map((issue) => ({
      ref: issue.ref,
      message: issue.message,
      severity: issue.severity,
      priority: issue.priority,
    }));
  }

  return result;
}

// =============================================================================
// Main API
// =============================================================================

/**
 * Fill a form using an LLM agent.
 *
 * This is the primary programmatic entry point for markform. It encapsulates
 * the harness loop with LiveAgent and provides a single-function call for
 * form filling.
 *
 * @param options - Fill options
 * @returns Fill result with status, values, and markdown
 *
 * @example
 * ```typescript
 * import { fillForm } from 'markform';
 *
 * const result = await fillForm({
 *   form: formMarkdown,
 *   model: 'anthropic/claude-sonnet-4-5',
 *   enableWebSearch: true,
 *   inputContext: {
 *     company_name: 'Apple Inc.',
 *   },
 *   systemPromptAddition: `
 *     ## Additional Context
 *     ${backgroundInfo}
 *   `,
 *   callbacks: {
 *     onTurnComplete: (progress) => {
 *       console.log(`Turn ${progress.turnNumber}: ${progress.requiredIssuesRemaining} remaining`);
 *     },
 *   },
 * });
 *
 * if (result.status.ok) {
 *   console.log('Values:', result.values);
 * }
 * ```
 */
export async function fillForm(options: FillOptions): Promise<FillResult> {
  // 1. Parse form if string
  let form: ParsedForm;
  try {
    form =
      typeof options.form === 'string' ? parseForm(options.form) : structuredClone(options.form);
  } catch (error) {
    // Return error result for parse failures
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: { ok: false, reason: 'error', message: `Form parse error: ${message}` },
      markdown: typeof options.form === 'string' ? options.form : '',
      values: {},
      form: {
        schema: { id: '', groups: [] },
        responsesByFieldId: {},
        notes: [],
        docs: [],
        orderIndex: [],
        idIndex: new Map(),
      },
      turns: 0,
      totalPatches: 0,
    };
  }

  // 2. Resolve model if string (skip if _testAgent provided)
  let model: LanguageModel | undefined;
  let provider: string | undefined;
  if (!options._testAgent) {
    try {
      if (typeof options.model === 'string') {
        const resolved = await resolveModel(options.model);
        model = resolved.model;
        provider = resolved.provider;
      } else {
        model = options.model;
        // When a LanguageModel is passed directly, we can't determine provider
        // Web search will be disabled in this case
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return buildErrorResult(form, [`Model resolution error: ${message}`], []);
    }
  }

  // 3. Apply input context using coercion layer
  let totalPatches = 0;
  let inputContextWarnings: string[] = [];

  if (options.inputContext) {
    const coercionResult = coerceInputContext(form, options.inputContext);

    // Fail fast on input context errors
    if (coercionResult.errors.length > 0) {
      return buildErrorResult(form, coercionResult.errors, coercionResult.warnings);
    }

    // Apply coerced patches
    if (coercionResult.patches.length > 0) {
      applyPatches(form, coercionResult.patches);
      totalPatches = coercionResult.patches.length;
    }
    inputContextWarnings = coercionResult.warnings;
  }

  // 4. Check for parallel execution path
  if (options.enableParallel) {
    const plan = computeExecutionPlan(form);
    if (plan.parallelBatches.length > 0) {
      return fillFormParallel(form, model, provider, options, totalPatches, inputContextWarnings);
    }
    // No parallel batches — fall through to serial path
  }

  // 5. Create harness + agent (serial path)
  const maxTurnsTotal = options.maxTurnsTotal ?? DEFAULT_MAX_TURNS;
  const startingTurnNumber = options.startingTurnNumber ?? 0;
  const maxPatchesPerTurn = options.maxPatchesPerTurn ?? DEFAULT_MAX_PATCHES_PER_TURN;
  const maxIssuesPerTurn = options.maxIssuesPerTurn ?? DEFAULT_MAX_ISSUES_PER_TURN;
  const targetRoles = options.targetRoles ?? [AGENT_ROLE];

  // Pass remaining turns to harness (accounts for turns already executed in previous calls)
  const remainingTurns = Math.max(0, maxTurnsTotal - startingTurnNumber);
  const harness = createHarness(form, {
    maxTurns: remainingTurns,
    maxPatchesPerTurn,
    maxIssuesPerTurn,
    targetRoles,
    fillMode: options.fillMode,
  });

  // Use test agent if provided, otherwise create LiveAgent
  const agent: Agent =
    options._testAgent ??
    createLiveAgent({
      model: model!,
      systemPromptAddition: options.systemPromptAddition,
      targetRole: targetRoles[0] ?? AGENT_ROLE,
      provider,
      enableWebSearch: options.enableWebSearch,
      additionalTools: options.additionalTools,
      callbacks: options.callbacks,
      maxStepsPerTurn: options.maxStepsPerTurn,
    });

  // 6. Run harness loop
  let turnCount = startingTurnNumber;
  let turnsThisCall = 0;
  let stepResult = harness.step();
  // Track rejections from previous turn to provide feedback to the LLM
  let previousRejections: PatchRejection[] | undefined;

  while (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
    // Check per-call limit (before executing any work this turn)
    if (options.maxTurnsThisCall !== undefined && turnsThisCall >= options.maxTurnsThisCall) {
      return buildResult(
        form,
        turnCount,
        totalPatches,
        {
          ok: false,
          reason: 'batch_limit',
          message: `Reached per-call limit (${options.maxTurnsThisCall} turns)`,
        },
        inputContextWarnings,
        stepResult.issues,
      );
    }
    // Check for cancellation
    if (options.signal?.aborted) {
      return buildResult(
        form,
        turnCount,
        totalPatches,
        { ok: false, reason: 'cancelled' },
        inputContextWarnings,
        stepResult.issues,
      );
    }

    // Call turn start callback (errors don't abort fill)
    if (options.callbacks?.onTurnStart) {
      try {
        options.callbacks.onTurnStart({
          turnNumber: turnCount + 1,
          issuesCount: stepResult.issues.length,
        });
      } catch {
        // Ignore callback errors
      }
    }

    // Store issues shown this turn (before agent generates patches)
    const turnIssues = stepResult.issues;

    // Call onIssuesIdentified callback (before agent generates patches)
    if (options.callbacks?.onIssuesIdentified) {
      try {
        options.callbacks.onIssuesIdentified({
          turnNumber: turnCount + 1,
          issues: turnIssues,
        });
      } catch {
        // Ignore callback errors
      }
    }

    // Generate patches using agent (pass previous rejections so LLM can learn from mistakes)
    const response = await agent.fillFormTool(
      turnIssues,
      form,
      maxPatchesPerTurn,
      previousRejections,
    );
    const { patches, stats } = response;

    // Call onPatchesGenerated callback (after agent, before applying)
    if (options.callbacks?.onPatchesGenerated) {
      try {
        options.callbacks.onPatchesGenerated({
          turnNumber: turnCount + 1,
          patches,
          stats,
        });
      } catch {
        // Ignore callback errors
      }
    }

    // Re-check for cancellation after agent call (signal may have fired during LLM call)
    if (options.signal?.aborted) {
      return buildResult(
        form,
        turnCount,
        totalPatches,
        { ok: false, reason: 'cancelled' },
        inputContextWarnings,
        turnIssues,
      );
    }

    // Convert TurnStats to SessionTurnStats (only include fields relevant for session logs)
    let llmStats: SessionTurnStats | undefined;
    let context: SessionTurnContext | undefined;
    if (stats) {
      llmStats = {
        inputTokens: stats.inputTokens,
        outputTokens: stats.outputTokens,
        toolCalls: stats.toolCalls && stats.toolCalls.length > 0 ? stats.toolCalls : undefined,
      };
      // Capture prompts sent to LLM for session logging (helps debug prompt issues)
      if (stats.prompts) {
        context = {
          systemPrompt: stats.prompts.system,
          contextPrompt: stats.prompts.context,
        };
      }
    }

    // Apply patches (pass wire format only if captureWireFormat is enabled)
    const wireFormat = options.captureWireFormat ? stats?.wire : undefined;
    stepResult = harness.apply(patches, turnIssues, llmStats, context, wireFormat);
    // Use actual applied count from harness (0 if patches were rejected)
    const actualPatchesApplied = stepResult.patchesApplied ?? patches.length;
    totalPatches += actualPatchesApplied;
    turnCount++;
    turnsThisCall++;

    // Store rejections to provide feedback to LLM in next turn
    previousRejections = stepResult.rejectedPatches;

    // Call progress callback (errors don't abort fill)
    if (options.callbacks?.onTurnComplete) {
      try {
        const requiredIssues = stepResult.issues.filter((i) => i.severity === 'required');
        options.callbacks.onTurnComplete({
          turnNumber: turnCount,
          issuesShown: turnIssues.length,
          patchesApplied: actualPatchesApplied,
          requiredIssuesRemaining: requiredIssues.length,
          isComplete: stepResult.isComplete,
          stats,
          issues: turnIssues,
          patches,
          rejectedPatches: stepResult.rejectedPatches ?? [],
        });
      } catch {
        // Ignore callback errors
      }
    }

    // If not complete and not at max turns, step again
    if (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
      stepResult = harness.step();
    }
  }

  // 7. Determine final status
  if (stepResult.isComplete) {
    return buildResult(form, turnCount, totalPatches, { ok: true }, inputContextWarnings);
  }

  // Hit max turns without completing
  return buildResult(
    form,
    turnCount,
    totalPatches,
    { ok: false, reason: 'max_turns', message: `Reached maximum total turns (${maxTurnsTotal})` },
    inputContextWarnings,
    stepResult.issues,
  );
}

// =============================================================================
// Parallel Execution Path
// =============================================================================

/**
 * Fill a form using parallel execution.
 *
 * For each order level, runs serial items with the primary agent (multi-turn),
 * then runs parallel batch items concurrently (multi-turn per agent).
 */
async function fillFormParallel(
  form: ParsedForm,
  model: LanguageModel | undefined,
  provider: string | undefined,
  options: FillOptions,
  initialPatches: number,
  inputContextWarnings: string[],
): Promise<FillResult> {
  const plan = computeExecutionPlan(form);
  const maxTurnsTotal = options.maxTurnsTotal ?? DEFAULT_MAX_TURNS;
  const startingTurnNumber = options.startingTurnNumber ?? 0;
  const maxPatchesPerTurn = options.maxPatchesPerTurn ?? DEFAULT_MAX_PATCHES_PER_TURN;
  const maxIssuesPerTurn = options.maxIssuesPerTurn ?? DEFAULT_MAX_ISSUES_PER_TURN;
  const maxParallelAgents = options.maxParallelAgents ?? DEFAULT_MAX_PARALLEL_AGENTS;
  const targetRoles = options.targetRoles ?? [AGENT_ROLE];

  let totalPatches = initialPatches;
  let turnCount = startingTurnNumber;

  // Create primary agent for serial items
  const primaryAgent: Agent =
    options._testAgent ??
    createLiveAgent({
      model: model!,
      systemPromptAddition: options.systemPromptAddition,
      targetRole: targetRoles[0] ?? AGENT_ROLE,
      provider,
      enableWebSearch: options.enableWebSearch,
      additionalTools: options.additionalTools,
      callbacks: options.callbacks,
      maxStepsPerTurn: options.maxStepsPerTurn,
    });

  for (const order of plan.orderLevels) {
    // Check cancellation
    if (options.signal?.aborted) {
      return buildResult(
        form,
        turnCount,
        totalPatches,
        { ok: false, reason: 'cancelled' },
        inputContextWarnings,
      );
    }

    // Check turn limit
    if (turnCount >= maxTurnsTotal) {
      return buildResult(
        form,
        turnCount,
        totalPatches,
        {
          ok: false,
          reason: 'max_turns',
          message: `Reached maximum total turns (${maxTurnsTotal})`,
        },
        inputContextWarnings,
      );
    }

    // Fire order level callback
    try {
      options.callbacks?.onOrderLevelStart?.({ order });
    } catch {
      /* ignore */
    }

    // --- Serial items at this order level (multi-turn) ---
    const serialItems = plan.looseSerial.filter((i) => i.order === order);
    if (serialItems.length > 0) {
      const result = await runMultiTurnForItems(
        form,
        primaryAgent,
        serialItems,
        targetRoles,
        maxPatchesPerTurn,
        maxIssuesPerTurn,
        maxTurnsTotal,
        turnCount,
        options,
      );
      totalPatches += result.patchesApplied;
      turnCount += result.turnsUsed;

      if (result.aborted) {
        return buildResult(form, turnCount, totalPatches, result.status!, inputContextWarnings);
      }
    }

    // --- Parallel batch items at this order level ---
    for (const batch of plan.parallelBatches) {
      const batchItems = batch.items.filter((i) => i.order === order);
      if (batchItems.length === 0) continue;

      try {
        options.callbacks?.onBatchStart?.({ batchId: batch.batchId, itemCount: batchItems.length });
      } catch {
        /* ignore */
      }

      // Run each batch item with its own multi-turn loop, concurrently
      const itemPromises = batchItems.map((item) => {
        // Create a scoped agent for this batch item (or reuse test agent)
        const scopedAgent: Agent =
          options._testAgent ??
          createLiveAgent({
            model: model!,
            systemPromptAddition: options.systemPromptAddition,
            targetRole: targetRoles[0] ?? AGENT_ROLE,
            provider,
            enableWebSearch: options.enableWebSearch,
            additionalTools: options.additionalTools,
            callbacks: options.callbacks,
            maxStepsPerTurn: options.maxStepsPerTurn,
          });

        return runMultiTurnForItems(
          form,
          scopedAgent,
          [item],
          targetRoles,
          maxPatchesPerTurn,
          maxIssuesPerTurn,
          maxTurnsTotal,
          turnCount,
          options,
        );
      });

      // Limit concurrency
      const results = await runWithConcurrency(
        itemPromises.map((p) => p),
        maxParallelAgents,
      );

      let batchPatches = 0;
      for (const result of results) {
        if (result.status === 'fulfilled') {
          totalPatches += result.value.patchesApplied;
          batchPatches += result.value.patchesApplied;
          turnCount += result.value.turnsUsed;
        }
      }

      try {
        options.callbacks?.onBatchComplete?.({
          batchId: batch.batchId,
          patchesApplied: batchPatches,
        });
      } catch {
        /* ignore */
      }
    }

    // Fire order level complete callback
    const levelInspect = inspect(form);
    try {
      options.callbacks?.onOrderLevelComplete?.({ order, patchesApplied: totalPatches });
    } catch {
      /* ignore */
    }

    // If form is already complete, stop early
    if (levelInspect.isComplete) {
      return buildResult(form, turnCount, totalPatches, { ok: true }, inputContextWarnings);
    }
  }

  // Check final form state
  const finalInspect = inspect(form);
  if (finalInspect.isComplete) {
    return buildResult(form, turnCount, totalPatches, { ok: true }, inputContextWarnings);
  }

  return buildResult(
    form,
    turnCount,
    totalPatches,
    { ok: false, reason: 'max_turns', message: `Reached maximum total turns (${maxTurnsTotal})` },
    inputContextWarnings,
    finalInspect.issues,
  );
}

/**
 * Result from a multi-turn run for a set of items.
 */
interface MultiTurnResult {
  patchesApplied: number;
  turnsUsed: number;
  aborted: boolean;
  status?: FillStatus;
}

/**
 * Run a multi-turn loop for a set of execution plan items.
 * Scoped issues are filtered to only the target items' fields.
 * Retries with rejection feedback, same as the serial fillForm path.
 */
async function runMultiTurnForItems(
  form: ParsedForm,
  agent: Agent,
  items: ExecutionPlanItem[],
  targetRoles: string[],
  maxPatchesPerTurn: number,
  _maxIssuesPerTurn: number,
  maxTurnsTotal: number,
  startTurn: number,
  options: FillOptions,
): Promise<MultiTurnResult> {
  let turnsUsed = 0;
  let patchesApplied = 0;
  let previousRejections: PatchRejection[] | undefined;
  const maxTurnsForItems = Math.min(
    maxTurnsTotal - startTurn,
    options.maxTurnsThisCall ?? Infinity,
  );

  for (let turn = 0; turn < maxTurnsForItems; turn++) {
    // Check cancellation
    if (options.signal?.aborted) {
      return {
        patchesApplied,
        turnsUsed,
        aborted: true,
        status: { ok: false, reason: 'cancelled' },
      };
    }

    // Inspect form to get current issues, scoped to our items
    const inspectResult = inspect(form, { targetRoles });
    const allIssues = inspectResult.issues;

    // Scope issues to our items
    let scopedIssues: InspectIssue[] = [];
    for (const item of items) {
      scopedIssues.push(...scopeIssuesForItem(form, item, allIssues));
    }

    // Deduplicate issues (same issue could appear via multiple items)
    const seen = new Set<string>();
    scopedIssues = scopedIssues.filter((issue) => {
      const key = `${issue.scope}:${issue.ref}:${issue.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (scopedIssues.length === 0) break; // All items filled

    // Fire turn callback
    try {
      options.callbacks?.onTurnStart?.({
        turnNumber: startTurn + turnsUsed + 1,
        issuesCount: scopedIssues.length,
      });
    } catch {
      /* ignore */
    }

    // Call agent
    const response = await agent.fillFormTool(
      scopedIssues,
      form,
      maxPatchesPerTurn,
      previousRejections,
    );

    // Apply patches
    if (response.patches.length > 0) {
      const applyResult = applyPatches(form, response.patches);
      patchesApplied += applyResult.appliedPatches.length;
      previousRejections = applyResult.rejectedPatches;
    } else {
      previousRejections = undefined;
    }

    turnsUsed++;

    // Fire turn complete callback
    try {
      const postInspect = inspect(form, { targetRoles });
      const requiredIssues = postInspect.issues.filter((i) => i.severity === 'required');
      options.callbacks?.onTurnComplete?.({
        turnNumber: startTurn + turnsUsed,
        issuesShown: scopedIssues.length,
        patchesApplied: response.patches.length,
        requiredIssuesRemaining: requiredIssues.length,
        isComplete: postInspect.isComplete,
        stats: response.stats,
        issues: scopedIssues,
        patches: response.patches,
        rejectedPatches: previousRejections ?? [],
      });
    } catch {
      /* ignore */
    }
  }

  return { patchesApplied, turnsUsed, aborted: false };
}
