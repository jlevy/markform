/**
 * Model Resolver - Parse and resolve AI SDK model identifiers.
 *
 * Parses model IDs in the format `provider/model-id` and dynamically
 * imports the corresponding AI SDK provider.
 */

import type { LanguageModel, Tool } from 'ai';

import { MarkformConfigError } from '../errors.js';
import type {
  AiSdkProviderCallable,
  BuiltInProviderName,
  ParsedModelId,
  ProviderAdapter,
  ProviderInfo,
  ProviderInput,
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

/**
 * Built-in providers available by default.
 * Exported so callers can inspect which providers are built-in.
 */
export const BUILT_IN_PROVIDERS: Readonly<Record<BuiltInProviderName, BuiltInProviderName>> =
  Object.freeze({
    anthropic: 'anthropic',
    openai: 'openai',
    google: 'google',
    xai: 'xai',
    deepseek: 'deepseek',
  });

// =============================================================================
// Provider Normalization
// =============================================================================

/** Known web search tool names from AI SDK providers. */
const KNOWN_WEB_SEARCH_TOOLS = [
  'webSearch',
  'webSearch_20250305',
  'googleSearch',
  'webSearchPreview',
];

/**
 * Extract web search tools from an AI SDK provider callable.
 * Duck-types the `.tools` property looking for known tool factory names.
 */
export function extractToolsFromProvider(
  provider: AiSdkProviderCallable,
): Record<string, Tool> | undefined {
  const providerTools = provider.tools;
  if (!providerTools || typeof providerTools !== 'object') return undefined;

  const extracted: Record<string, Tool> = {};
  for (const toolName of KNOWN_WEB_SEARCH_TOOLS) {
    const factory = providerTools[toolName];
    if (typeof factory === 'function') {
      try {
        const tool = factory({});
        if (tool) {
          const key = toolName === 'googleSearch' ? 'google_search' : 'web_search';
          extracted[key] = tool;
          break; // Only need one web search tool
        }
      } catch {
        // Tool factory failed — skip silently
      }
    }
  }

  return Object.keys(extracted).length > 0 ? extracted : undefined;
}

/**
 * Normalize a ProviderInput to a ProviderAdapter.
 * AI SDK provider callables are wrapped in an adapter shape.
 */
export function normalizeProvider(input: ProviderInput): ProviderAdapter {
  if (typeof input === 'function') {
    return {
      model: (id: string) => input(id),
      tools: extractToolsFromProvider(input),
    };
  }
  if ('model' in input && typeof input.model === 'function') {
    return input;
  }
  throw new MarkformConfigError(
    'Invalid provider: must be a ProviderAdapter (with .model() method) or an AI SDK provider callable',
    {
      option: 'providers',
      expectedType: 'ProviderAdapter | callable',
      receivedValue: typeof input,
    },
  );
}

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
export async function resolveModel(
  modelIdString: string,
  providers?: Record<string, ProviderInput>,
): Promise<ResolvedModel> {
  const { provider, modelId } = parseModelId(modelIdString);

  // 1. Check per-call custom providers first
  if (providers && provider in providers) {
    const adapter = normalizeProvider(providers[provider]!);
    try {
      const model = adapter.model(modelId);
      return { model, provider, modelId, tools: adapter.tools };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MarkformConfigError(
        `Custom provider "${provider}" failed to resolve model "${modelId}": ${message}`,
        { option: 'model', expectedType: 'valid model ID', receivedValue: modelIdString },
      );
    }
  }

  // 2. Fall back to built-in provider resolution
  const providerConfig = PROVIDERS[provider as BuiltInProviderName];
  if (!providerConfig) {
    const builtInNames = Object.keys(PROVIDERS);
    throw new MarkformConfigError(
      `Unknown provider: "${provider}". Built-in providers: ${builtInNames.join(', ')}. ` +
        `To use a custom provider, pass it via the \`providers\` option.`,
      {
        option: 'model',
        expectedType: 'provider name or custom provider',
        receivedValue: provider,
      },
    );
  }

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
