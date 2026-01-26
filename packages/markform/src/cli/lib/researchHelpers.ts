/**
 * Research helpers - Pure/testable functions extracted from research command.
 *
 * These functions handle validation and formatting for the research command,
 * separated from CLI code to enable unit testing.
 *
 * Note: Most research logic is already in llms.ts and runResearch.ts.
 * This module contains the remaining extractable pieces.
 */

import { hasWebSearchSupport, WEB_SEARCH_CONFIG } from '../../llms.js';

// =============================================================================
// Types
// =============================================================================

export interface ResearchModelValidationResult {
  valid: boolean;
  error?: string;
  webSearchProviders?: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validate that a model supports web search (required for research command).
 */
export function validateResearchModel(
  modelId: string | undefined,
  provider: string,
): ResearchModelValidationResult {
  if (!modelId) {
    return {
      valid: false,
      error: '--model is required',
    };
  }

  if (!hasWebSearchSupport(provider)) {
    const webSearchProviders = Object.entries(WEB_SEARCH_CONFIG)
      .filter(([, config]) => config.supported)
      .map(([p]) => p);

    return {
      valid: false,
      error: `Model "${modelId}" does not support web search.`,
      webSearchProviders,
    };
  }

  return { valid: true };
}

/**
 * Parse research harness options from CLI options.
 */
export function parseResearchHarnessOptions(options: {
  maxTurns?: string;
  maxPatches?: string;
  maxIssues?: string;
}): {
  maxTurns: number;
  maxPatchesPerTurn: number;
  maxIssuesPerTurn: number;
} {
  return {
    maxTurns: parseInt(options.maxTurns ?? '10', 10),
    maxPatchesPerTurn: parseInt(options.maxPatches ?? '10', 10),
    maxIssuesPerTurn: parseInt(options.maxIssues ?? '10', 10),
  };
}
