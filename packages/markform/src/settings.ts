/**
 * Global settings and constants for Markform.
 *
 * This file consolidates non-changing default values that were previously
 * scattered across the codebase. These are NOT runtime configurable - they
 * are compile-time constants.
 */

import type { FieldPriorityLevel } from "./engine/coreTypes.js";

// =============================================================================
// Spec Version Constants
// =============================================================================

/**
 * The current Markform spec version in full notation (e.g., "MF/0.1").
 * This is distinct from npm package version and tracks the format that
 * .form.md files conform to.
 */
export const MF_SPEC_VERSION = "MF/0.1";

/**
 * The numeric portion of the spec version (e.g., "0.1").
 * Used when only the version number is needed.
 */
export const MF_SPEC_VERSION_NUMBER = "0.1";

// =============================================================================
// Role System Constants
// =============================================================================

/** Default role for fields without explicit role attribute */
export const AGENT_ROLE = "agent" as const;

/** Role for human-filled fields in interactive mode */
export const USER_ROLE = "user" as const;

/** Default roles list for forms without explicit roles in frontmatter */
export const DEFAULT_ROLES: readonly [typeof USER_ROLE, typeof AGENT_ROLE] = [
  USER_ROLE,
  AGENT_ROLE,
] as const;

/** Default instructions per role (used when form doesn't specify role_instructions) */
export const DEFAULT_ROLE_INSTRUCTIONS: Record<string, string> = {
  [USER_ROLE]: "Fill in the fields you have direct knowledge of.",
  [AGENT_ROLE]: "Complete the remaining fields based on the provided context.",
};

/** Pattern for valid role names: starts with letter, alphanumeric with underscores/hyphens */
export const ROLE_NAME_PATTERN = /^[a-z][a-z0-9_-]*$/;

/** Reserved role identifiers (not allowed as role names in forms) */
export const RESERVED_ROLE_NAMES = ["*"] as const;

/**
 * Normalize a role name: trim whitespace, lowercase.
 * Throws if invalid pattern or reserved name.
 */
export function normalizeRole(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (!ROLE_NAME_PATTERN.test(normalized)) {
    throw new Error(
      `Invalid role name: "${role}" (must match pattern: start with letter, alphanumeric with underscores/hyphens)`
    );
  }
  if ((RESERVED_ROLE_NAMES as readonly string[]).includes(normalized)) {
    throw new Error(`Reserved role name: "${role}"`);
  }
  return normalized;
}

/**
 * Parse --roles CLI flag value into normalized role array.
 * Handles comma-separated values and '*' wildcard.
 */
export function parseRolesFlag(raw: string): string[] {
  if (raw === "*") {
    return ["*"];
  }
  return raw.split(",").map((r) => normalizeRole(r));
}

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
// Harness Defaults
// =============================================================================

/**
 * Default maximum turns for the fill harness.
 * Prevents runaway loops during agent execution.
 */
export const DEFAULT_MAX_TURNS = 100;

/**
 * Default maximum patches per turn.
 */
export const DEFAULT_MAX_PATCHES_PER_TURN = 20;

/**
 * Default maximum issues to show per step.
 */
export const DEFAULT_MAX_ISSUES = 10;

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

// =============================================================================
// Web Search Configuration
// =============================================================================

/**
 * Web search support configuration by provider.
 *
 * Providers with native web search:
 * - openai: webSearchPreview tool (models: gpt-4o and later)
 * - google: googleSearch grounding (all Gemini models)
 * - xai: native search in Grok models
 *
 * Providers without native web search:
 * - anthropic: requires external tool (e.g., Tavily)
 * - deepseek: no web search support
 */
export interface WebSearchConfig {
  /** Whether the provider has native web search */
  supported: boolean;
  /** Tool name for web search (provider-specific) */
  toolName?: string;
  /** Package export name for the web search tool */
  exportName?: string;
}

/**
 * Web search configuration per provider.
 */
export const WEB_SEARCH_CONFIG: Record<string, WebSearchConfig> = {
  openai: {
    supported: true,
    toolName: "web_search_preview",
    exportName: "openaiTools",
  },
  google: {
    supported: true,
    toolName: "googleSearch",
    exportName: "googleTools",
  },
  xai: {
    supported: true,
    // xAI Grok has built-in web search, enabled via model settings
    toolName: "xai_search",
  },
  anthropic: {
    supported: false,
  },
  deepseek: {
    supported: false,
  },
};

/**
 * Check if a provider supports native web search.
 */
export function hasWebSearchSupport(provider: string): boolean {
  return WEB_SEARCH_CONFIG[provider]?.supported ?? false;
}

/**
 * Get web search tool configuration for a provider.
 * Returns undefined if provider doesn't support web search.
 */
export function getWebSearchConfig(provider: string): WebSearchConfig | undefined {
  const config = WEB_SEARCH_CONFIG[provider];
  return config?.supported ? config : undefined;
}
