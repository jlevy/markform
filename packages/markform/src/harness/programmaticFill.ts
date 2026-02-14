/**
 * Programmatic Fill API - High-level entry point for form filling.
 *
 * Provides a single-function API for external agentic systems to execute
 * form-filling sessions with a single function call.
 */

import type { LanguageModel, Tool } from 'ai';

import { applyPatches } from '../engine/apply.js';
import type {
  ExecutionPlanItem,
  FieldValue,
  InspectIssue,
  ParsedForm,
  Patch,
  PatchRejection,
  PatchWarning,
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
import { computeProgressSummary, computeStructureSummary } from '../engine/summaries.js';
import type { ProgressCounts } from '../engine/coreTypes.js';
import type { FillRecord } from './fillRecord.js';
import { FillRecordCollector } from './fillRecordCollector.js';
import { createHarness } from './harness.js';
import { createLiveAgent } from './liveAgent.js';
import { resolveModel } from './modelResolver.js';
import { runWithConcurrency, scopeIssuesForItem } from './parallelHarness.js';
import type { Agent, FillOptions, FillResult, FillStatus, TurnStats } from './harnessTypes.js';

// Re-export types for backwards compatibility
export type { FillOptions, FillResult, FillStatus, TurnProgress } from './harnessTypes.js';

// =============================================================================
// Execution ID Helpers
// =============================================================================

/**
 * Execution ID format for tracking parallel and serial execution threads.
 *
 * Format: `eid:{type}:o{order}[:{batchId}:i{index}]`
 *
 * Components:
 * - `eid:` - Prefix identifying this as an execution ID
 * - `{type}` - Either `serial` or `batch`
 * - `o{order}` - Order level (e.g., `o0`, `o10`)
 * - For batch only: `:{batchId}:i{index}` - Batch name and item index
 *
 * Examples:
 * - `eid:serial:o0` - Serial execution at order level 0
 * - `eid:batch:o0:research:i0` - First item in "research" batch at order 0
 * - `eid:batch:o0:research:i3` - Fourth item in "research" batch at order 0
 * - `eid:serial:o10` - Serial execution at order level 10
 *
 * Design principles:
 * - Self-identifying: Clear `eid:` prefix
 * - Structured: Type comes first for easy filtering
 * - Explicit: Each component has a prefix (`o` for order, `i` for index)
 * - Parseable: Can be split on `:` to extract components
 */

/** Prefix for all execution IDs */
const EXECUTION_ID_PREFIX = 'eid';

/**
 * Create an execution ID for serial execution at an order level.
 */
export function serialExecutionId(order: number): string {
  return `${EXECUTION_ID_PREFIX}:serial:o${order}`;
}

/**
 * Create an execution ID for a batch item at an order level.
 */
export function batchExecutionId(order: number, batchId: string, itemIndex: number): string {
  return `${EXECUTION_ID_PREFIX}:batch:o${order}:${batchId}:i${itemIndex}`;
}

/**
 * Parse an execution ID into its components.
 * Returns null if the ID doesn't match the expected format.
 */
export function parseExecutionId(
  id: string,
):
  | { type: 'serial'; order: number }
  | { type: 'batch'; order: number; batchId: string; itemIndex: number }
  | null {
  if (!id.startsWith(`${EXECUTION_ID_PREFIX}:`)) return null;

  const parts = id.split(':');
  if (parts.length < 3) return null;

  const type = parts[1];
  const orderPart = parts[2];

  if (!orderPart?.startsWith('o')) return null;
  const order = parseInt(orderPart.slice(1), 10);
  if (isNaN(order)) return null;

  if (type === 'serial') {
    return { type: 'serial', order };
  } else if (type === 'batch' && parts.length >= 5) {
    const batchId = parts[3];
    const indexPart = parts[4];
    if (!indexPart?.startsWith('i') || !batchId) return null;
    const itemIndex = parseInt(indexPart.slice(1), 10);
    if (isNaN(itemIndex)) return null;
    return { type: 'batch', order, batchId, itemIndex };
  }

  return null;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get current progress counts for a form.
 * Runs inspect to get issues, then computes progress summary.
 */
function getProgressCounts(form: ParsedForm, targetRoles?: string[]): ProgressCounts {
  const inspectResult = inspect(form, { targetRoles });
  const progressSummary = computeProgressSummary(
    form.schema,
    form.responsesByFieldId,
    form.notes,
    inspectResult.issues,
  );
  return progressSummary.counts;
}

/**
 * Create a FillRecordCollector if recordFill is enabled.
 */
function createCollectorIfNeeded(
  options: FillOptions,
  form: ParsedForm,
  provider: string,
  model: string,
): FillRecordCollector | undefined {
  if (!options.recordFill) return undefined;

  const structureSummary = computeStructureSummary(form.schema);
  return new FillRecordCollector({
    form: {
      id: form.schema.id,
      title: form.schema.title,
      description: form.schema.description,
      structure: structureSummary,
    },
    provider,
    model,
    parallelEnabled: options.enableParallel,
    maxParallelAgents: options.maxParallelAgents,
  });
}

/**
 * Log a warning when a user callback throws.
 */
function warnCallbackError(name: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[markform] User callback ${name} threw: ${message}`);
}

/**
 * Merge user callbacks with collector callbacks.
 * Returns a new callbacks object that forwards to both.
 *
 * Error handling:
 * - Collector callbacks: errors propagate (bugs in our code should surface)
 * - User callbacks: errors are caught and logged as warnings
 */
function mergeCallbacks(
  userCallbacks: FillOptions['callbacks'],
  collector: FillRecordCollector | undefined,
): FillOptions['callbacks'] {
  if (!collector) return userCallbacks;
  if (!userCallbacks) return collector;

  // Create wrapper that forwards to both collector (directly) and user (safely)
  return {
    onTurnStart: (turn) => {
      collector.onTurnStart(turn);
      try {
        userCallbacks.onTurnStart?.(turn);
      } catch (e) {
        warnCallbackError('onTurnStart', e);
      }
    },
    onTurnComplete: (progress) => {
      collector.onTurnComplete(progress);
      try {
        userCallbacks.onTurnComplete?.(progress);
      } catch (e) {
        warnCallbackError('onTurnComplete', e);
      }
    },
    onLlmCallStart: (call) => {
      collector.onLlmCallStart(call);
      try {
        userCallbacks.onLlmCallStart?.(call);
      } catch (e) {
        warnCallbackError('onLlmCallStart', e);
      }
    },
    onLlmCallEnd: (call) => {
      collector.onLlmCallEnd(call);
      try {
        userCallbacks.onLlmCallEnd?.(call);
      } catch (e) {
        warnCallbackError('onLlmCallEnd', e);
      }
    },
    onToolStart: (call) => {
      collector.onToolStart(call);
      try {
        userCallbacks.onToolStart?.(call);
      } catch (e) {
        warnCallbackError('onToolStart', e);
      }
    },
    onToolEnd: (call) => {
      collector.onToolEnd(call);
      try {
        userCallbacks.onToolEnd?.(call);
      } catch (e) {
        warnCallbackError('onToolEnd', e);
      }
    },
    // Forward other callbacks to user only (collector doesn't handle these)
    onIssuesIdentified: userCallbacks.onIssuesIdentified
      ? (info) => {
          try {
            userCallbacks.onIssuesIdentified?.(info);
          } catch (e) {
            warnCallbackError('onIssuesIdentified', e);
          }
        }
      : undefined,
    onPatchesGenerated: userCallbacks.onPatchesGenerated
      ? (info) => {
          try {
            userCallbacks.onPatchesGenerated?.(info);
          } catch (e) {
            warnCallbackError('onPatchesGenerated', e);
          }
        }
      : undefined,
    onOrderLevelStart: userCallbacks.onOrderLevelStart
      ? (info) => {
          try {
            userCallbacks.onOrderLevelStart?.(info);
          } catch (e) {
            warnCallbackError('onOrderLevelStart', e);
          }
        }
      : undefined,
    onOrderLevelComplete: userCallbacks.onOrderLevelComplete
      ? (info) => {
          try {
            userCallbacks.onOrderLevelComplete?.(info);
          } catch (e) {
            warnCallbackError('onOrderLevelComplete', e);
          }
        }
      : undefined,
    onBatchStart: userCallbacks.onBatchStart
      ? (info) => {
          try {
            userCallbacks.onBatchStart?.(info);
          } catch (e) {
            warnCallbackError('onBatchStart', e);
          }
        }
      : undefined,
    onBatchComplete: userCallbacks.onBatchComplete
      ? (info) => {
          try {
            userCallbacks.onBatchComplete?.(info);
          } catch (e) {
            warnCallbackError('onBatchComplete', e);
          }
        }
      : undefined,
    // Forward onWebSearch to both collector (directly) and user (safely)
    onWebSearch: (info) => {
      collector.onWebSearch(info);
      try {
        userCallbacks.onWebSearch?.(info);
      } catch (e) {
        warnCallbackError('onWebSearch', e);
      }
    },
  };
}

function buildErrorResult(
  form: ParsedForm,
  errors: string[],
  warnings: string[],
  record?: FillRecord,
  sourceError?: Error,
): FillResult {
  // Extract values from responses
  const values: Record<string, FieldValue> = {};
  for (const [fieldId, response] of Object.entries(form.responsesByFieldId)) {
    if (response.state === 'answered' && response.value) {
      values[fieldId] = response.value;
    }
  }

  const result: FillResult = {
    status: {
      ok: false,
      reason: 'error',
      message: errors.join('; '),
      error: sourceError,
    },
    markdown: serializeForm(form),
    values,
    form,
    turns: 0,
    totalPatches: 0,
    inputContextWarnings: warnings.length > 0 ? warnings : undefined,
  };

  if (record) {
    result.record = record;
  }

  return result;
}

function buildResult(
  form: ParsedForm,
  turns: number,
  totalPatches: number,
  status: FillStatus,
  inputContextWarnings?: string[],
  remainingIssues?: InspectIssue[],
  record?: FillRecord,
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

  if (record) {
    result.record = record;
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
      status: {
        ok: false,
        reason: 'error',
        message: `Form parse error: ${message}`,
        error: error instanceof Error ? error : undefined,
      },
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
  let providerTools: Record<string, Tool> | undefined;
  if (!options._testAgent) {
    try {
      if (typeof options.model === 'string') {
        const resolved = await resolveModel(options.model, options.providers);
        model = resolved.model;
        provider = resolved.provider;
        providerTools = resolved.tools;
      } else {
        model = options.model;
        // When a LanguageModel is passed directly, we can't determine provider
        // Web search will be disabled in this case
      }
    } catch (error) {
      // Model resolution is a pre-fill configuration error - fail fast without FillRecord
      const message = error instanceof Error ? error.message : String(error);
      return buildErrorResult(
        form,
        [`Model resolution error: ${message}`],
        [],
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  } else if (typeof options.model === 'string' && options.model.includes('/')) {
    // For test agent, extract provider from model string (e.g., "mock/model" -> "mock")
    provider = options.model.split('/')[0];
  }

  // 3. Create collector if recordFill is enabled
  const modelString = typeof options.model === 'string' ? options.model : 'custom';
  const collector = createCollectorIfNeeded(options, form, provider ?? 'unknown', modelString);
  const mergedCallbacks = mergeCallbacks(options.callbacks, collector);

  // 4. Apply input context using coercion layer
  let totalPatches = 0;
  let inputContextWarnings: string[] = [];

  if (options.inputContext) {
    const coercionResult = coerceInputContext(form, options.inputContext);

    // Input context errors are pre-fill configuration errors - fail fast without FillRecord
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

  // 5. Check for parallel execution path
  if (options.enableParallel) {
    const plan = computeExecutionPlan(form);
    if (plan.parallelBatches.length > 0) {
      return fillFormParallel(
        form,
        model,
        provider,
        options,
        totalPatches,
        inputContextWarnings,
        collector,
        mergedCallbacks,
      );
    }
    // No parallel batches — fall through to serial path
  }

  // 6. Create harness + agent (serial path)
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
      providerTools,
      enableWebSearch: options.enableWebSearch,
      additionalTools: options.additionalTools,
      callbacks: mergedCallbacks,
      maxStepsPerTurn: options.maxStepsPerTurn,
      toolChoice: options.toolChoice,
    });

  // 7. Run harness loop
  let turnCount = startingTurnNumber;
  let turnsThisCall = 0;
  let stepResult = harness.step();
  // Track rejections from previous turn to provide feedback to the LLM
  let previousRejections: PatchRejection[] | undefined;

  while (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
    // Check per-call limit (before executing any work this turn)
    if (options.maxTurnsThisCall !== undefined && turnsThisCall >= options.maxTurnsThisCall) {
      let record: FillRecord | undefined;
      if (collector) {
        collector.setStatus('partial', 'batch_limit');
        record = collector.getRecord(getProgressCounts(form, targetRoles));
      }
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
        record,
      );
    }
    // Check for cancellation
    if (options.signal?.aborted) {
      let record: FillRecord | undefined;
      if (collector) {
        collector.setStatus('cancelled');
        record = collector.getRecord(getProgressCounts(form, targetRoles));
      }
      return buildResult(
        form,
        turnCount,
        totalPatches,
        { ok: false, reason: 'cancelled' },
        inputContextWarnings,
        stepResult.issues,
        record,
      );
    }

    // Call turn start callback (errors don't abort fill)
    if (mergedCallbacks?.onTurnStart) {
      try {
        mergedCallbacks.onTurnStart({
          turnNumber: turnCount + 1,
          issuesCount: stepResult.issues.length,
          // Default to order 0, serial execution for non-parallel fills
          // Parallel harness will override these values
          order: 0,
          executionId: '0-serial',
        });
      } catch {
        // Ignore callback errors
      }
    }

    // Store issues shown this turn (before agent generates patches)
    const turnIssues = stepResult.issues;

    // Call onIssuesIdentified callback (before agent generates patches)
    if (mergedCallbacks?.onIssuesIdentified) {
      try {
        mergedCallbacks.onIssuesIdentified({
          turnNumber: turnCount + 1,
          issues: turnIssues,
        });
      } catch {
        // Ignore callback errors
      }
    }

    // Generate patches using agent (pass previous rejections so LLM can learn from mistakes)
    let response: { patches: Patch[]; stats?: TurnStats };
    try {
      response = await agent.fillFormTool(turnIssues, form, maxPatchesPerTurn, previousRejections);
    } catch (error) {
      // Agent threw an error - capture it in fill record and return
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorObj = error instanceof Error ? error : undefined;
      let record: FillRecord | undefined;
      if (collector) {
        collector.setStatus('failed', errorMessage);
        record = collector.getRecord(getProgressCounts(form, targetRoles));
      }
      // Fire onError callback so consumers can log/report in real time
      if (errorObj && mergedCallbacks?.onError) {
        try {
          mergedCallbacks.onError(errorObj, { turnNumber: turnCount + 1 });
        } catch (cbError) {
          warnCallbackError('onError', cbError);
        }
      }
      return buildResult(
        form,
        turnCount,
        totalPatches,
        { ok: false, reason: 'error', message: errorMessage, error: errorObj },
        inputContextWarnings,
        turnIssues,
        record,
      );
    }
    const { patches, stats } = response;

    // Call onPatchesGenerated callback (after agent, before applying)
    if (mergedCallbacks?.onPatchesGenerated) {
      try {
        mergedCallbacks.onPatchesGenerated({
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
      let record: FillRecord | undefined;
      if (collector) {
        collector.setStatus('cancelled');
        record = collector.getRecord(getProgressCounts(form, targetRoles));
      }
      return buildResult(
        form,
        turnCount,
        totalPatches,
        { ok: false, reason: 'cancelled' },
        inputContextWarnings,
        turnIssues,
        record,
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
    if (mergedCallbacks?.onTurnComplete) {
      try {
        const requiredIssues = stepResult.issues.filter((i) => i.severity === 'required');
        mergedCallbacks.onTurnComplete({
          turnNumber: turnCount,
          issuesShown: turnIssues.length,
          patchesApplied: actualPatchesApplied,
          requiredIssuesRemaining: requiredIssues.length,
          isComplete: stepResult.isComplete,
          stats,
          issues: turnIssues,
          patches,
          rejectedPatches: stepResult.rejectedPatches ?? [],
          coercionWarnings: stepResult.coercionWarnings,
          executionId: '0-serial',
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

  // 8. Determine final status and finalize record
  const finalProgressCounts = getProgressCounts(form, targetRoles);

  if (stepResult.isComplete) {
    let record: FillRecord | undefined;
    if (collector) {
      collector.setStatus('completed');
      record = collector.getRecord(finalProgressCounts);
    }
    return buildResult(
      form,
      turnCount,
      totalPatches,
      { ok: true },
      inputContextWarnings,
      undefined,
      record,
    );
  }

  // Hit max turns without completing
  let record: FillRecord | undefined;
  if (collector) {
    collector.setStatus('partial', 'max_turns');
    record = collector.getRecord(finalProgressCounts);
  }
  return buildResult(
    form,
    turnCount,
    totalPatches,
    { ok: false, reason: 'max_turns', message: `Reached maximum total turns (${maxTurnsTotal})` },
    inputContextWarnings,
    stepResult.issues,
    record,
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
  collector: FillRecordCollector | undefined,
  mergedCallbacks: FillOptions['callbacks'],
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

  // Helper to create an agent with the correct executionId
  const createAgentForExecution = (executionId: string): Agent => {
    return (
      options._testAgent ??
      createLiveAgent({
        model: model!,
        systemPromptAddition: options.systemPromptAddition,
        targetRole: targetRoles[0] ?? AGENT_ROLE,
        provider,
        enableWebSearch: options.enableWebSearch,
        additionalTools: options.additionalTools,
        callbacks: mergedCallbacks,
        maxStepsPerTurn: options.maxStepsPerTurn,
        executionId,
        toolChoice: options.toolChoice,
      })
    );
  };

  for (const order of plan.orderLevels) {
    // Check cancellation
    if (options.signal?.aborted) {
      let record: FillRecord | undefined;
      if (collector) {
        collector.setStatus('cancelled');
        record = collector.getRecord(getProgressCounts(form, targetRoles));
      }
      return buildResult(
        form,
        turnCount,
        totalPatches,
        { ok: false, reason: 'cancelled' },
        inputContextWarnings,
        undefined,
        record,
      );
    }

    // Check turn limit
    if (turnCount >= maxTurnsTotal) {
      let record: FillRecord | undefined;
      if (collector) {
        collector.setStatus('partial', 'max_turns');
        record = collector.getRecord(getProgressCounts(form, targetRoles));
      }
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
        undefined,
        record,
      );
    }

    // Fire order level callback
    try {
      mergedCallbacks?.onOrderLevelStart?.({ order });
    } catch {
      /* ignore */
    }

    // --- Serial items at this order level (multi-turn) ---
    const serialItems = plan.looseSerial.filter((i) => i.order === order);
    if (serialItems.length > 0) {
      const serialExecId = serialExecutionId(order);
      const serialAgent = createAgentForExecution(serialExecId);
      const result = await runMultiTurnForItems(
        form,
        serialAgent,
        serialItems,
        targetRoles,
        maxPatchesPerTurn,
        maxIssuesPerTurn,
        maxTurnsTotal,
        turnCount,
        options,
        order,
        serialExecId,
        mergedCallbacks,
      );
      totalPatches += result.patchesApplied;
      turnCount += result.turnsUsed;

      if (result.aborted && result.status) {
        let record: FillRecord | undefined;
        if (collector) {
          // Set status based on abort reason
          const status = result.status;
          if (!status.ok) {
            if (status.reason === 'cancelled') {
              collector.setStatus('cancelled');
            } else if (status.reason === 'error') {
              collector.setStatus('failed', status.message);
            } else {
              collector.setStatus('partial', status.reason);
            }
          }
          record = collector.getRecord(getProgressCounts(form, targetRoles));
        }
        return buildResult(
          form,
          turnCount,
          totalPatches,
          result.status,
          inputContextWarnings,
          undefined,
          record,
        );
      }
    }

    // --- Parallel batch items at this order level ---
    for (const batch of plan.parallelBatches) {
      const batchItems = batch.items.filter((i) => i.order === order);
      if (batchItems.length === 0) continue;

      try {
        mergedCallbacks?.onBatchStart?.({ batchId: batch.batchId, itemCount: batchItems.length });
      } catch {
        /* ignore */
      }

      // Create promise factories for each batch item (for true concurrency limiting)
      // Factories are called lazily when a slot becomes available
      const itemFactories = batchItems.map((item, itemIndex) => {
        return () => {
          const batchExecId = batchExecutionId(order, batch.batchId, itemIndex);
          // Create a scoped agent for this batch item with correct executionId
          const scopedAgent = createAgentForExecution(batchExecId);

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
            order,
            batchExecId,
            mergedCallbacks,
          );
        };
      });

      // Run with concurrency limit (factories are called lazily)
      const results = await runWithConcurrency(itemFactories, maxParallelAgents);

      let batchPatches = 0;
      const batchErrors: string[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          totalPatches += result.value.patchesApplied;
          batchPatches += result.value.patchesApplied;
          turnCount += result.value.turnsUsed;
          // Track errors from aborted items (agent threw an error)
          const itemStatus = result.value.status;
          if (result.value.aborted && itemStatus && !itemStatus.ok && itemStatus.message) {
            batchErrors.push(itemStatus.message);
          }
        } else {
          // Promise itself was rejected (shouldn't happen with new error handling, but defensive)
          const reason: unknown = result.reason;
          const errorMsg = reason instanceof Error ? reason.message : String(reason);
          batchErrors.push(`Parallel agent error: ${errorMsg}`);
        }
      }

      // If any batch items had errors, record them (but continue processing)
      // The form may still be partially filled even with some errors
      if (batchErrors.length > 0 && collector) {
        // Don't set failed status yet - we may still complete. Just log the errors.
        // The final status will be set at the end based on form completeness.
        console.warn(`[markform] Parallel batch ${batch.batchId} had errors:`, batchErrors);
      }

      try {
        mergedCallbacks?.onBatchComplete?.({
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
      mergedCallbacks?.onOrderLevelComplete?.({ order, patchesApplied: totalPatches });
    } catch {
      /* ignore */
    }

    // If form is already complete, stop early
    if (levelInspect.isComplete) {
      let record: FillRecord | undefined;
      if (collector) {
        collector.setStatus('completed');
        record = collector.getRecord(getProgressCounts(form, targetRoles));
      }
      return buildResult(
        form,
        turnCount,
        totalPatches,
        { ok: true },
        inputContextWarnings,
        undefined,
        record,
      );
    }
  }

  // Check final form state
  const finalInspect = inspect(form);
  const finalProgressCounts = getProgressCounts(form, targetRoles);

  if (finalInspect.isComplete) {
    let record: FillRecord | undefined;
    if (collector) {
      collector.setStatus('completed');
      record = collector.getRecord(finalProgressCounts);
    }
    return buildResult(
      form,
      turnCount,
      totalPatches,
      { ok: true },
      inputContextWarnings,
      undefined,
      record,
    );
  }

  let record: FillRecord | undefined;
  if (collector) {
    collector.setStatus('partial', 'max_turns');
    record = collector.getRecord(finalProgressCounts);
  }
  return buildResult(
    form,
    turnCount,
    totalPatches,
    { ok: false, reason: 'max_turns', message: `Reached maximum total turns (${maxTurnsTotal})` },
    inputContextWarnings,
    finalInspect.issues,
    record,
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
  order: number,
  executionId: string,
  mergedCallbacks: FillOptions['callbacks'],
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
      mergedCallbacks?.onTurnStart?.({
        turnNumber: startTurn + turnsUsed + 1,
        issuesCount: scopedIssues.length,
        order,
        executionId,
      });
    } catch {
      /* ignore */
    }

    // Call agent (catch errors to avoid rejecting the parallel promise)
    let response: { patches: Patch[]; stats?: TurnStats };
    try {
      response = await agent.fillFormTool(
        scopedIssues,
        form,
        maxPatchesPerTurn,
        previousRejections,
      );
    } catch (error) {
      // Return early with error result so it can be tracked by the parallel harness
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorObj = error instanceof Error ? error : undefined;
      // Fire onError callback so consumers can log/report in real time
      if (errorObj && mergedCallbacks?.onError) {
        try {
          mergedCallbacks.onError(errorObj, { turnNumber: startTurn + turnsUsed + 1 });
        } catch (cbError) {
          warnCallbackError('onError', cbError);
        }
      }
      return {
        patchesApplied,
        turnsUsed,
        aborted: true,
        status: { ok: false, reason: 'error', message: errorMessage, error: errorObj },
      };
    }

    // Apply patches
    let lastCoercionWarnings: PatchWarning[] | undefined;
    if (response.patches.length > 0) {
      const applyResult = applyPatches(form, response.patches);
      patchesApplied += applyResult.appliedPatches.length;
      previousRejections = applyResult.rejectedPatches;
      lastCoercionWarnings = applyResult.warnings;
    } else {
      previousRejections = undefined;
    }

    turnsUsed++;

    // Fire turn complete callback
    try {
      const postInspect = inspect(form, { targetRoles });
      const requiredIssues = postInspect.issues.filter((i) => i.severity === 'required');
      mergedCallbacks?.onTurnComplete?.({
        turnNumber: startTurn + turnsUsed,
        issuesShown: scopedIssues.length,
        patchesApplied: response.patches.length,
        requiredIssuesRemaining: requiredIssues.length,
        isComplete: postInspect.isComplete,
        stats: response.stats,
        issues: scopedIssues,
        patches: response.patches,
        rejectedPatches: previousRejections ?? [],
        coercionWarnings: lastCoercionWarnings,
        executionId,
      });
    } catch {
      /* ignore */
    }
  }

  return { patchesApplied, turnsUsed, aborted: false };
}
