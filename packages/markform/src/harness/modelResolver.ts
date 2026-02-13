/**
 * Model Resolver - Parse and resolve AI SDK model identifiers.
 *
 * Parses model IDs in the format `provider/model-id` and dynamically
 * imports the corresponding AI SDK provider.
 */

import type { LanguageModel } from 'ai';

import { MarkformConfigError } from '../errors.js';
import type {
  BuiltInProviderName,
  ParsedModelId,
  ProviderInfo,
  ProviderName,
  ResolvedModel,
} from './harnessTypes.js';

// Re-export types for backwards compatibility
export type {
  BuiltInProviderName,
  ParsedModelId,
  ProviderAdapter,
  ProviderInfo,
  ProviderInput,
  ProviderName,
  ResolvedModel,
} from './harnessTypes.js';

/**
 * Map of provider names to their npm package and env var.
 */
const PROVIDERS: Record<
  BuiltInProviderName,
  { package: string; envVar: string; createFn: string }
> = {
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
    throw new MarkformConfigError(
      `Invalid model ID format: "${modelIdString}". Expected format: provider/model-id (e.g., anthropic/claude-sonnet-4-5)`,
      { option: 'model', expectedType: 'provider/model-id format', receivedValue: modelIdString },
    );
  }

  const provider = modelIdString.slice(0, slashIndex);
  const modelId = modelIdString.slice(slashIndex + 1);

  if (!provider || !modelId) {
    throw new MarkformConfigError(
      `Invalid model ID format: "${modelIdString}". Both provider and model ID are required.`,
      {
        option: 'model',
        expectedType: 'non-empty provider and model-id',
        receivedValue: modelIdString,
      },
    );
  }

  return { provider, modelId };
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
  const providerConfig = PROVIDERS[provider as BuiltInProviderName];

  // Check for API key
  const apiKey = process.env[providerConfig.envVar];
  if (!apiKey) {
    throw new MarkformConfigError(
      `Missing API key for "${provider}" provider (model: ${modelIdString}).\n` +
        `Set the ${providerConfig.envVar} environment variable or add it to your .env file.`,
      { option: providerConfig.envVar, expectedType: 'API key string', receivedValue: undefined },
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
      throw new MarkformConfigError(
        `Provider package not installed for model "${modelIdString}".\n` +
          `Install with: pnpm add ${providerConfig.package}`,
        {
          option: 'model',
          expectedType: 'installed provider package',
          receivedValue: providerConfig.package,
        },
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
      throw new MarkformConfigError(
        `Provider package "${providerConfig.package}" does not export expected function "${provider}" or "${providerConfig.createFn}"`,
        {
          option: 'model',
          expectedType: 'valid provider export',
          receivedValue: Object.keys(providerModule).join(', '),
        },
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
