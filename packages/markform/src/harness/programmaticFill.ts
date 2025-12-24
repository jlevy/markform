/**
 * Programmatic Fill API - High-level entry point for form filling.
 *
 * Provides a single-function API for external agentic systems to execute
 * form-filling sessions with a single function call.
 */

import type { LanguageModel } from "ai";

import { applyPatches } from "../engine/apply.js";
import { parseForm } from "../engine/parse.js";
import { serialize } from "../engine/serialize.js";
import type { InspectIssue, ParsedForm } from "../engine/coreTypes.js";
import { coerceInputContext } from "../engine/valueCoercion.js";
import {
  AGENT_ROLE,
  DEFAULT_MAX_ISSUES,
  DEFAULT_MAX_PATCHES_PER_TURN,
  DEFAULT_MAX_TURNS,
} from "../settings.js";
import { createHarness } from "./harness.js";
import { createLiveAgent } from "./liveAgent.js";
import { resolveModel } from "./modelResolver.js";
import type { Agent, FillOptions, FillResult, FillStatus } from "./harnessTypes.js";

// Re-export types for backwards compatibility
export type { FillOptions, FillResult, FillStatus, TurnProgress } from "./harnessTypes.js";

// =============================================================================
// Helper Functions
// =============================================================================

function buildErrorResult(
  form: ParsedForm,
  errors: string[],
  warnings: string[],
): FillResult {
  return {
    status: {
      ok: false,
      reason: "error",
      message: errors.join("; "),
    },
    markdown: serialize(form),
    values: { ...form.valuesByFieldId },
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
  const result: FillResult = {
    status,
    markdown: serialize(form),
    values: { ...form.valuesByFieldId },
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
 *   inputContext: {
 *     company_name: 'Apple Inc.',
 *   },
 *   systemPromptAddition: `
 *     ## Additional Context
 *     ${backgroundInfo}
 *   `,
 *   onTurnComplete: (progress) => {
 *     console.log(`Turn ${progress.turnNumber}: ${progress.requiredIssuesRemaining} remaining`);
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
      typeof options.form === "string"
        ? parseForm(options.form)
        : structuredClone(options.form);
  } catch (error) {
    // Return error result for parse failures
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: { ok: false, reason: "error", message: `Form parse error: ${message}` },
      markdown: typeof options.form === "string" ? options.form : "",
      values: {},
      form: { schema: { id: "", groups: [] }, valuesByFieldId: {}, docs: [], orderIndex: [], idIndex: new Map() },
      turns: 0,
      totalPatches: 0,
    };
  }

  // 2. Resolve model if string (skip if _testAgent provided)
  let model: LanguageModel | undefined;
  if (!options._testAgent) {
    try {
      if (typeof options.model === "string") {
        const resolved = await resolveModel(options.model);
        model = resolved.model;
      } else {
        model = options.model;
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

  // 4. Create harness + agent
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  const maxPatchesPerTurn = options.maxPatchesPerTurn ?? DEFAULT_MAX_PATCHES_PER_TURN;
  const maxIssues = options.maxIssues ?? DEFAULT_MAX_ISSUES;
  const targetRoles = options.targetRoles ?? [AGENT_ROLE];

  const harness = createHarness(form, {
    maxTurns,
    maxPatchesPerTurn,
    maxIssues,
    targetRoles,
    fillMode: options.fillMode,
  });

  // Use test agent if provided, otherwise create LiveAgent
  const agent: Agent = options._testAgent ?? createLiveAgent({
    model: model!,
    systemPromptAddition: options.systemPromptAddition,
    targetRole: targetRoles[0] ?? AGENT_ROLE,
  });

  // 5. Run harness loop
  let turnCount = 0;
  let stepResult = harness.step();

  while (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
    // Check for cancellation
    if (options.signal?.aborted) {
      return buildResult(
        form,
        turnCount,
        totalPatches,
        { ok: false, reason: "cancelled" },
        inputContextWarnings,
        stepResult.issues,
      );
    }

    // Generate patches using agent
    const patches = await agent.generatePatches(
      stepResult.issues,
      form,
      maxPatchesPerTurn,
    );

    // Re-check for cancellation after agent call (signal may have fired during LLM call)
    if (options.signal?.aborted) {
      return buildResult(
        form,
        turnCount,
        totalPatches,
        { ok: false, reason: "cancelled" },
        inputContextWarnings,
        stepResult.issues,
      );
    }

    // Apply patches
    stepResult = harness.apply(patches, stepResult.issues);
    totalPatches += patches.length;
    turnCount++;

    // Call progress callback (errors don't abort fill)
    if (options.onTurnComplete) {
      try {
        const requiredIssues = stepResult.issues.filter(
          (i) => i.severity === "required",
        );
        options.onTurnComplete({
          turnNumber: turnCount,
          issuesShown: stepResult.issues.length,
          patchesApplied: patches.length,
          requiredIssuesRemaining: requiredIssues.length,
          isComplete: stepResult.isComplete,
        });
      } catch {
        // Ignore callback errors
      }
    }

    // If not complete, step again
    if (!stepResult.isComplete) {
      stepResult = harness.step();
    }
  }

  // 6. Determine final status
  if (stepResult.isComplete) {
    return buildResult(
      form,
      turnCount,
      totalPatches,
      { ok: true },
      inputContextWarnings,
    );
  }

  // Hit max turns without completing
  return buildResult(
    form,
    turnCount,
    totalPatches,
    { ok: false, reason: "max_turns", message: `Reached maximum turns (${maxTurns})` },
    inputContextWarnings,
    stepResult.issues,
  );
}

