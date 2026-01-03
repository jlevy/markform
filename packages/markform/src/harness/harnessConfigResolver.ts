/**
 * Harness configuration resolver.
 *
 * Merges configuration from multiple sources with defined precedence:
 * 1. API-provided options (highest priority)
 * 2. Form frontmatter defaults
 * 3. Global defaults (lowest priority)
 */

import type { HarnessConfig, ParsedForm } from '../engine/coreTypes.js';
import type { FillOptions } from './harnessTypes.js';
import {
  DEFAULT_MAX_ISSUES_PER_TURN,
  DEFAULT_MAX_PATCHES_PER_TURN,
  DEFAULT_MAX_TURNS,
} from '../settings.js';

/**
 * Resolve harness configuration by merging options from multiple sources.
 *
 * Precedence (highest to lowest):
 * 1. options parameter (API-provided)
 * 2. form.metadata.harnessConfig (from frontmatter)
 * 3. Default constants
 *
 * @param form The parsed form (may contain frontmatter harness config)
 * @param options API-provided options to override defaults
 * @returns Resolved harness configuration
 */
export function resolveHarnessConfig(
  form: ParsedForm,
  options?: Partial<FillOptions>,
): HarnessConfig {
  // Get frontmatter config (if present)
  const frontmatterConfig = form.metadata?.harnessConfig;

  // Merge with precedence: options > frontmatter > defaults
  return {
    maxTurns: options?.maxTurnsTotal ?? frontmatterConfig?.maxTurns ?? DEFAULT_MAX_TURNS,
    maxPatchesPerTurn:
      options?.maxPatchesPerTurn ??
      frontmatterConfig?.maxPatchesPerTurn ??
      DEFAULT_MAX_PATCHES_PER_TURN,
    maxIssuesPerTurn:
      options?.maxIssuesPerTurn ??
      frontmatterConfig?.maxIssuesPerTurn ??
      DEFAULT_MAX_ISSUES_PER_TURN,
    // These don't have frontmatter equivalents
    targetRoles: options?.targetRoles,
    fillMode: options?.fillMode,
  };
}
