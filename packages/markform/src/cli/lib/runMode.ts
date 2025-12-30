/**
 * Run mode utilities for the CLI.
 *
 * Provides functions for:
 * - Validating run_mode against form structure
 * - Inferring run_mode from field roles
 * - Determining run mode for execution
 */

import type { ParsedForm, RunMode } from '../../engine/coreTypes.js';
import { getAllFields } from '../../engine/inspect.js';
import { isResearchForm } from '../../research/researchFormValidation.js';
import { AGENT_ROLE, USER_ROLE } from '../../settings.js';

/**
 * Get the set of unique roles present in a form's fields.
 */
export function getFieldRoles(form: ParsedForm): Set<string> {
  const allFields = getAllFields(form);
  return new Set(allFields.map((field) => field.role));
}

/**
 * Validation result for run_mode.
 */
export interface RunModeValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that run_mode is consistent with form structure.
 *
 * Rules:
 * - interactive: Form MUST have at least one role="user" field
 * - fill: Form MUST have at least one role="agent" field
 * - research: Form MUST have at least one role="agent" field
 */
export function validateRunMode(form: ParsedForm, runMode: RunMode): RunModeValidationResult {
  const roles = getFieldRoles(form);

  switch (runMode) {
    case 'interactive':
      if (!roles.has(USER_ROLE)) {
        return {
          valid: false,
          error: `run_mode="interactive" but form has no user-role fields. Available roles: ${[...roles].join(', ') || '(none)'}`,
        };
      }
      break;

    case 'fill':
    case 'research':
      if (!roles.has(AGENT_ROLE)) {
        return {
          valid: false,
          error: `run_mode="${runMode}" but form has no agent-role fields. Available roles: ${[...roles].join(', ') || '(none)'}`,
        };
      }
      break;
  }

  return { valid: true };
}

/**
 * Result of run mode determination.
 */
export type DetermineRunModeResult =
  | { success: true; runMode: RunMode; source: 'explicit' | 'inferred' }
  | { success: false; error: string };

/**
 * Determine the run mode for a form.
 *
 * 1. If explicit run_mode in frontmatter, validate and use it
 * 2. Otherwise, infer from field roles:
 *    - All user fields → interactive
 *    - All agent fields → fill (or research if isResearchForm)
 *    - Mixed roles → error (require explicit run_mode)
 */
export function determineRunMode(form: ParsedForm): DetermineRunModeResult {
  // 1. Explicit run_mode in frontmatter takes precedence
  const explicitMode = form.metadata?.runMode;
  if (explicitMode) {
    const validation = validateRunMode(form, explicitMode);
    if (!validation.valid) {
      return { success: false, error: validation.error! };
    }
    return { success: true, runMode: explicitMode, source: 'explicit' };
  }

  // 2. Infer from field roles (no complex heuristics)
  const roles = getFieldRoles(form);

  // Handle empty form
  if (roles.size === 0) {
    return { success: false, error: 'Form has no fields' };
  }

  // Single role: user only
  if (roles.size === 1 && roles.has(USER_ROLE)) {
    return { success: true, runMode: 'interactive', source: 'inferred' };
  }

  // Single role: agent only
  if (roles.size === 1 && roles.has(AGENT_ROLE)) {
    // Check if research-configured
    if (isResearchForm(form)) {
      return { success: true, runMode: 'research', source: 'inferred' };
    }
    return { success: true, runMode: 'fill', source: 'inferred' };
  }

  // Mixed roles or unknown - require explicit run_mode
  return {
    success: false,
    error:
      `Cannot determine run mode. Form has roles: ${[...roles].join(', ')}. ` +
      `Add 'run_mode' to frontmatter: interactive, fill, or research.`,
  };
}

/**
 * Get a human-readable description of the run mode source.
 */
export function formatRunModeSource(source: 'explicit' | 'inferred'): string {
  return source === 'explicit' ? 'from frontmatter' : 'inferred from field roles';
}
