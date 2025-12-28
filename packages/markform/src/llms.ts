/**
 * LLM-related settings and configuration.
 *
 * This module centralizes LLM provider and model configuration,
 * including suggested models and web search support.
 */

// =============================================================================
// Suggested LLMs
// =============================================================================

/**
 * Suggested LLM models for the fill command, organized by provider.
 * These are shown in help/error messages. Only includes models from the
 * authoritative models.yaml configuration.
 */
export const SUGGESTED_LLMS: Record<string, string[]> = {
  openai: ['gpt-5-mini', 'gpt-5-nano', 'gpt-5.1', 'gpt-5-pro', 'gpt-5.2', 'gpt-5.2-pro'],
  anthropic: [
    'claude-opus-4-5',
    'claude-opus-4-1',
    'claude-sonnet-4-5',
    'claude-sonnet-4-0',
    'claude-haiku-4-5',
  ],
  google: [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-3-pro-preview',
  ],
  xai: ['grok-4', 'grok-4-fast'],
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
    toolName: 'web_search_preview',
    exportName: 'openaiTools',
  },
  google: {
    supported: true,
    toolName: 'googleSearch',
    exportName: 'googleTools',
  },
  xai: {
    supported: true,
    // xAI Grok has built-in web search, enabled via model settings
    toolName: 'xai_search',
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
