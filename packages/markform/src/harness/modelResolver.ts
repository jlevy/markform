/**
 * Model Resolver - Parse and resolve AI SDK model identifiers.
 *
 * Parses model IDs in the format `provider/model-id` and dynamically
 * imports the corresponding AI SDK provider.
 */

import type { LanguageModel } from 'ai';

import type { ParsedModelId, ProviderInfo, ProviderName, ResolvedModel } from './harnessTypes.js';

// Re-export types for backwards compatibility
export type { ParsedModelId, ProviderInfo, ProviderName, ResolvedModel } from './harnessTypes.js';

/**
 * Map of provider names to their npm package and env var.
 */
const PROVIDERS: Record<ProviderName, { package: string; envVar: string; createFn: string }> = {
  anthropic: {
    package: '@ai-sdk/anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    createFn: 'createAnthropic',
  },
  openai: {
    package: '@ai-sdk/openai',
    envVar: 'OPENAI_API_KEY',
    createFn: 'createOpenAI',
  },
  google: {
    package: '@ai-sdk/google',
    envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
    createFn: 'createGoogleGenerativeAI',
  },
  xai: {
    package: '@ai-sdk/xai',
    envVar: 'XAI_API_KEY',
    createFn: 'createXai',
  },
  deepseek: {
    package: '@ai-sdk/deepseek',
    envVar: 'DEEPSEEK_API_KEY',
    createFn: 'createDeepSeek',
  },
};

// =============================================================================
// Model Resolution
// =============================================================================

/**
 * Parse a model ID string into provider and model components.
 *
 * @param modelIdString - Model ID in format `provider/model-id`
 * @returns Parsed model identifier
 * @throws Error if format is invalid
 */
export function parseModelId(modelIdString: string): ParsedModelId {
  const slashIndex = modelIdString.indexOf('/');
  if (slashIndex === -1) {
    throw new Error(
      `Invalid model ID format: "${modelIdString}". Expected format: provider/model-id (e.g., anthropic/claude-sonnet-4-5)`,
    );
  }

  const provider = modelIdString.slice(0, slashIndex);
  const modelId = modelIdString.slice(slashIndex + 1);

  if (!provider || !modelId) {
    throw new Error(
      `Invalid model ID format: "${modelIdString}". Both provider and model ID are required.`,
    );
  }

  const supportedProviders = Object.keys(PROVIDERS);
  if (!supportedProviders.includes(provider)) {
    throw new Error(
      `Unknown provider: "${provider}". Supported providers: ${supportedProviders.join(', ')}`,
    );
  }

  return {
    provider: provider as ProviderName,
    modelId,
  };
}

/**
 * Resolve a model ID string to an AI SDK language model.
 *
 * Dynamically imports the provider package and creates the model instance.
 *
 * @param modelIdString - Model ID in format `provider/model-id`
 * @returns Resolved model with provider info
 * @throws Error if provider not installed or API key missing
 */
export async function resolveModel(modelIdString: string): Promise<ResolvedModel> {
  const { provider, modelId } = parseModelId(modelIdString);
  const providerConfig = PROVIDERS[provider];

  // Check for API key
  const apiKey = process.env[providerConfig.envVar];
  if (!apiKey) {
    throw new Error(
      `Missing API key for "${provider}" provider (model: ${modelIdString}).\n` +
        `Set the ${providerConfig.envVar} environment variable or add it to your .env file.`,
    );
  }

  // Dynamically import the provider
  let providerModule: Record<string, (modelId: string) => LanguageModel>;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    providerModule = await import(providerConfig.package);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Cannot find module') || message.includes('ERR_MODULE_NOT_FOUND')) {
      throw new Error(
        `Provider package not installed for model "${modelIdString}".\n` +
          `Install with: pnpm add ${providerConfig.package}`,
      );
    }
    throw error;
  }

  // Get the createProvider function (e.g., createAnthropic, createOpenAI, createGoogleGenerativeAI)
  const createFn = providerModule[providerConfig.createFn] as  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | ((options: { apiKey: string }) => any)
    | undefined;

  let model: LanguageModel;

  if (createFn && typeof createFn === 'function') {
    // Use the factory function with explicit API key
    // The provider instance is callable: providerInstance(modelId) returns a LanguageModel
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    model = createFn({ apiKey })(modelId);
  } else {
    // Fallback: try the simple provider function (for backwards compatibility)
    const providerFn = providerModule[provider] as ((modelId: string) => LanguageModel) | undefined;
    if (typeof providerFn !== 'function') {
      throw new Error(
        `Provider package "${providerConfig.package}" does not export expected function "${provider}" or "${providerConfig.createFn}"`,
      );
    }
    model = providerFn(modelId);
  }

  return {
    model,
    provider,
    modelId,
  };
}

/**
 * Get list of supported provider names.
 */
export function getProviderNames(): ProviderName[] {
  return Object.keys(PROVIDERS) as ProviderName[];
}

/**
 * Get provider info for display purposes.
 */
export function getProviderInfo(provider: ProviderName): ProviderInfo {
  const config = PROVIDERS[provider];
  return {
    package: config.package,
    envVar: config.envVar,
  };
}
