/**
 * Research API - Form filling with web search capabilities.
 *
 * The runResearch() function is the main entry point for research-mode filling.
 * It uses web-search-enabled models to fill forms with information from the web.
 */

import type { ParsedForm, SessionTranscript } from '../engine/coreTypes.js';
import { createHarness } from '../harness/harness.js';
import { createLiveAgent } from '../harness/liveAgent.js';
import { resolveModel } from '../harness/modelResolver.js';
import { resolveHarnessConfig } from '../harness/harnessConfigResolver.js';
import type { FillOptions } from '../harness/harnessTypes.js';
import {
  AGENT_ROLE,
  DEFAULT_MAX_TURNS,
  DEFAULT_RESEARCH_MAX_ISSUES_PER_TURN,
  DEFAULT_RESEARCH_MAX_PATCHES_PER_TURN,
} from '../settings.js';
import type { ResearchResult, ResearchStatus } from './researchTypes.js';

/**
 * Options for runResearch (FillOptions without form, since form is a separate parameter).
 */
export type ResearchOptions = Omit<FillOptions, 'form'>;

/**
 * Run research fill on a form.
 *
 * This function fills a form using an LLM with optional web search capabilities.
 * It resolves configuration from multiple sources (options > frontmatter > defaults)
 * and executes the harness loop until completion or max turns.
 *
 * @param form The parsed form to fill
 * @param options Fill options including model specification
 * @returns Research result with filled form and statistics
 */
export async function runResearch(
  form: ParsedForm,
  options: ResearchOptions,
): Promise<ResearchResult> {
  // Validate model is provided
  if (!options.model) {
    throw new Error('model is required for runResearch()');
  }

  // Resolve the model - model is string | LanguageModel, but resolveModel only accepts string
  const modelSpec = options.model;
  if (typeof modelSpec !== 'string') {
    throw new Error(
      'runResearch requires a model string identifier (e.g., "openai/gpt-4o-search-preview")',
    );
  }
  const { model, provider } = await resolveModel(modelSpec);

  // Resolve harness config with research defaults
  const baseConfig = resolveHarnessConfig(form, options);
  const config = {
    ...baseConfig,
    // Apply research-specific defaults if not overridden
    maxTurns: options.maxTurns ?? form.metadata?.harnessConfig?.maxTurns ?? DEFAULT_MAX_TURNS,
    maxIssuesPerTurn:
      options.maxIssuesPerTurn ??
      form.metadata?.harnessConfig?.maxIssuesPerTurn ??
      DEFAULT_RESEARCH_MAX_ISSUES_PER_TURN,
    maxPatchesPerTurn:
      options.maxPatchesPerTurn ??
      form.metadata?.harnessConfig?.maxPatchesPerTurn ??
      DEFAULT_RESEARCH_MAX_PATCHES_PER_TURN,
    targetRoles: options.targetRoles ?? [AGENT_ROLE],
    fillMode: options.fillMode ?? 'continue',
  };

  // Create harness and agent
  const harness = createHarness(form, config);
  const agent = createLiveAgent({
    model,
    provider,
    targetRole: config.targetRoles?.[0] ?? AGENT_ROLE,
  });

  // Get available tools for logging
  const availableTools = agent.getAvailableToolNames();

  // Track stats
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Run harness loop
  let stepResult = harness.step();

  while (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
    // Generate patches from agent
    const response = await agent.generatePatches(
      stepResult.issues,
      harness.getForm(),
      config.maxPatchesPerTurn,
    );

    // Track token usage if available
    if (response.stats?.inputTokens) {
      totalInputTokens += response.stats.inputTokens;
    }
    if (response.stats?.outputTokens) {
      totalOutputTokens += response.stats.outputTokens;
    }

    // Apply patches
    stepResult = harness.apply(response.patches, stepResult.issues);

    // Continue if not complete
    if (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
      stepResult = harness.step();
    }
  }

  // Determine final status
  let status: ResearchStatus;
  if (stepResult.isComplete) {
    status = 'completed';
  } else if (harness.hasReachedMaxTurns()) {
    status = 'max_turns_reached';
  } else {
    status = 'incomplete';
  }

  // Build transcript if available
  const transcript: SessionTranscript = {
    sessionVersion: '0.1.0',
    mode: 'live',
    form: { path: '' },
    harness: {
      maxTurns: config.maxTurns,
      maxPatchesPerTurn: config.maxPatchesPerTurn,
      maxIssuesPerTurn: config.maxIssuesPerTurn,
      targetRoles: config.targetRoles,
      fillMode: config.fillMode,
    },
    turns: harness.getTurns(),
    final: {
      expectComplete: true,
      expectedCompletedForm: '',
    },
  };

  // Return result
  return {
    status,
    form: harness.getForm(),
    transcript,
    totalTurns: harness.getTurnNumber(),
    inputTokens: totalInputTokens > 0 ? totalInputTokens : undefined,
    outputTokens: totalOutputTokens > 0 ? totalOutputTokens : undefined,
    availableTools,
  };
}
