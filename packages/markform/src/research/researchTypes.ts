/**
 * Research module types.
 *
 * Types for the research API that enables web-search-powered form filling.
 */

import type { ParsedForm, SessionTranscript } from '../engine/coreTypes.js';

// =============================================================================
// Research Status and Results
// =============================================================================

/**
 * Research execution status.
 */
export type ResearchStatus = 'completed' | 'incomplete' | 'max_turns_reached';

/**
 * Result of a research fill operation.
 */
export interface ResearchResult {
  /** Final status of the research */
  status: ResearchStatus;
  /** The filled form */
  form: ParsedForm;
  /** Optional session transcript for debugging */
  transcript?: SessionTranscript;

  // Stats
  /** Total harness turns executed */
  totalTurns: number;
  /** Total input tokens used (if available) */
  inputTokens?: number;
  /** Total output tokens used (if available) */
  outputTokens?: number;

  // File outputs (if form was saved)
  /** Path to saved .form.md file */
  formPath?: string;
  /** Path to saved .raw.md file */
  rawPath?: string;
  /** Path to saved .yaml file */
  yamlPath?: string;
}
