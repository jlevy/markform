/**
 * LLM-related settings and configuration.
 *
 * This module centralizes LLM provider and model configuration,
 * including suggested models and web search support.
 */

// =============================================================================
// Model ID Parsing
// =============================================================================

/**
 * Parsed model ID components for display purposes.
 */
export interface DisplayModelId {
  /** Provider name (e.g., 'anthropic', 'openai') or 'unknown' */
  provider: string;
  /** Model name (e.g., 'claude-sonnet-4', 'gpt-4o') */
  model: string;
}

/**
 * Parse a model ID string into provider and model components for display.
 *
 * This is a non-throwing utility for extracting display-friendly components
 * from a model ID. For validation and resolution, use `parseModelId` from
 * `modelResolver.ts` instead.
 *
 * @param modelId - Model ID in format `provider/model-id`
 * @returns Parsed components with 'unknown' provider if format is invalid
 *
 * @example
 * parseModelIdForDisplay('anthropic/claude-sonnet-4')
 * // => { provider: 'anthropic', model: 'claude-sonnet-4' }
 *
 * parseModelIdForDisplay('claude-sonnet-4')
 * // => { provider: 'unknown', model: 'claude-sonnet-4' }
 */
export function parseModelIdForDisplay(modelId: string): DisplayModelId {
  const slashIndex = modelId.indexOf('/');
  if (slashIndex === -1 || slashIndex === 0 || slashIndex === modelId.length - 1) {
    return { provider: 'unknown', model: modelId };
  }
  return {
    provider: modelId.slice(0, slashIndex),
    model: modelId.slice(slashIndex + 1),
  };
}

// =============================================================================
// Suggested LLMs
// =============================================================================

/**
 * Suggested LLM models for the fill command, organized by provider.
 * These are shown in help/error messages and model selection prompts.
 */
export const SUGGESTED_LLMS: Record<string, string[]> = {
  openai: ['gpt-5-mini', 'gpt-5-nano', 'gpt-5.2', 'gpt-5.2-pro', 'o3', 'o3-mini'],
  anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
  google: ['gemini-3-flash', 'gemini-3-pro-preview', 'gemini-2.5-flash'],
  xai: ['grok-4', 'grok-4.1-fast'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
};

/**
 * Format suggested LLMs for display in help/error messages.
 */
export function formatSuggestedLlms(): string {
  const lines: string[] = ['Available providers and example models:'];
  for (const [provider, models] of Object.entries(SUGGESTED_LLMS)) {
    lines.push(`  ${provider}/`);
    for (const model of models) {
      lines.push(`    - ${provider}/${model}`);
    }
  }
  return lines.join('\n');
}

// =============================================================================
// Web Search Configuration
// =============================================================================

/**
 * Web search support configuration by provider.
 */
export interface WebSearchConfig {
  /** Whether the provider has native web search */
  supported: boolean;
  /** Tool name on providerSdk.tools (e.g., 'webSearch', 'googleSearch') */
  toolName?: string;
}

/**
 * Web search configuration per provider.
 *
 * Tool names are from Vercel AI SDK provider documentation:
 * - openai: https://ai-sdk.dev/providers/ai-sdk-providers/openai
 * - anthropic: https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
 * - google: https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai
 * - xai: https://ai-sdk.dev/providers/ai-sdk-providers/xai
 * - deepseek: https://ai-sdk.dev/providers/ai-sdk-providers/deepseek (no tools)
 */
export const WEB_SEARCH_CONFIG: Record<string, WebSearchConfig> = {
  // openai.tools.webSearch - https://ai-sdk.dev/providers/ai-sdk-providers/openai#web-search
  openai: {
    supported: true,
    toolName: 'webSearch',
  },
  // anthropic.tools.webSearch_20250305 - https://ai-sdk.dev/providers/ai-sdk-providers/anthropic#web-search
  anthropic: {
    supported: true,
    toolName: 'webSearch_20250305',
  },
  // google.tools.googleSearch - https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai#google-search-grounding
  google: {
    supported: true,
    toolName: 'googleSearch',
  },
  // xai.tools.webSearch - https://ai-sdk.dev/providers/ai-sdk-providers/xai#web-search-tool
  xai: {
    supported: true,
    toolName: 'webSearch',
  },
  // deepseek has no tools - https://ai-sdk.dev/providers/ai-sdk-providers/deepseek
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
