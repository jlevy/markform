/**
 * Global settings and constants for Markform.
 *
 * This file consolidates non-changing default values that were previously
 * scattered across the codebase. These are NOT runtime configurable - they
 * are compile-time constants.
 */

import type { FieldPriorityLevel } from "./engine/types.js";

// =============================================================================
// Field Defaults
// =============================================================================

/**
 * The default priority level for fields when not explicitly specified.
 * Used by the parser to set default values and by the serializer to
 * determine whether to emit the priority attribute.
 */
export const DEFAULT_PRIORITY: FieldPriorityLevel = "medium";

// =============================================================================
// CLI Defaults
// =============================================================================

/**
 * The default port for the serve command.
 */
export const DEFAULT_PORT = 3344;

// =============================================================================
// LLM Suggestions
// =============================================================================

/**
 * Suggested LLM models for the fill command, organized by provider.
 * These are shown in help/error messages. Only includes models from the
 * authoritative models.yaml configuration.
 */
export const SUGGESTED_LLMS: Record<string, string[]> = {
  openai: [
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5.1",
    "gpt-5-pro",
    "gpt-5.2",
    "gpt-5.2-pro",
  ],
  anthropic: [
    "claude-opus-4-5",
    "claude-opus-4-1",
    "claude-sonnet-4-5",
    "claude-sonnet-4-0",
    "claude-haiku-4-5",
  ],
  google: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-3-pro-preview",
  ],
  xai: ["grok-4", "grok-4-fast"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
};

/**
 * Format suggested LLMs for display in help/error messages.
 */
export function formatSuggestedLlms(): string {
  const lines: string[] = ["Available providers and example models:"];
  for (const [provider, models] of Object.entries(SUGGESTED_LLMS)) {
    lines.push(`  ${provider}/`);
    for (const model of models) {
      lines.push(`    - ${provider}/${model}`);
    }
  }
  return lines.join("\n");
}
