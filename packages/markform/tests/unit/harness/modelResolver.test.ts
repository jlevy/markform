/**
 * Unit tests for modelResolver pure functions.
 *
 * Tests parseModelId, getProviderNames, and getProviderInfo without
 * requiring actual model resolution (which needs network/API keys).
 */

import { describe, it, expect } from 'vitest';
import {
  parseModelId,
  getProviderNames,
  getProviderInfo,
} from '../../../src/harness/modelResolver.js';

describe('modelResolver', () => {
  describe('parseModelId', () => {
    // Table-driven valid model IDs
    const validModelIds = [
      { input: 'anthropic/claude-3-opus', provider: 'anthropic', modelId: 'claude-3-opus' },
      { input: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelId: 'claude-sonnet-4-5' },
      { input: 'openai/gpt-4', provider: 'openai', modelId: 'gpt-4' },
      { input: 'openai/gpt-4-turbo', provider: 'openai', modelId: 'gpt-4-turbo' },
      { input: 'google/gemini-pro', provider: 'google', modelId: 'gemini-pro' },
      { input: 'xai/grok-beta', provider: 'xai', modelId: 'grok-beta' },
      { input: 'deepseek/deepseek-chat', provider: 'deepseek', modelId: 'deepseek-chat' },
      // Model IDs with slashes in the model part
      {
        input: 'openai/o1-preview/2024-09-12',
        provider: 'openai',
        modelId: 'o1-preview/2024-09-12',
      },
      // Model IDs with special characters
      { input: 'anthropic/claude-3.5-sonnet', provider: 'anthropic', modelId: 'claude-3.5-sonnet' },
    ];

    it.each(validModelIds)('parses "$input" correctly', ({ input, provider, modelId }) => {
      const result = parseModelId(input);
      expect(result.provider).toBe(provider);
      expect(result.modelId).toBe(modelId);
    });

    // Table-driven invalid model IDs - no slash
    const noSlashCases = ['claude-3-opus', 'gpt-4', 'gemini-pro', 'anthropicmodel'];

    it.each(noSlashCases)('throws for model ID without slash: "%s"', (input) => {
      expect(() => parseModelId(input)).toThrow('Invalid model ID format');
      expect(() => parseModelId(input)).toThrow('Expected format: provider/model-id');
    });

    // Table-driven invalid model IDs - empty parts
    const emptyPartsCases = [
      { input: '/gpt-4', desc: 'empty provider' },
      { input: 'openai/', desc: 'empty model ID' },
      { input: '/', desc: 'both empty' },
    ];

    it.each(emptyPartsCases)('throws for $desc: "$input"', ({ input }) => {
      expect(() => parseModelId(input)).toThrow('Both provider and model ID are required');
    });

    // Extensible providers — parseModelId accepts any provider string
    const extensibleProviderCases = [
      { input: 'mistral/mistral-large', provider: 'mistral', modelId: 'mistral-large' },
      { input: 'cohere/command-r', provider: 'cohere', modelId: 'command-r' },
      { input: 'meta/llama-3', provider: 'meta', modelId: 'llama-3' },
      {
        input: 'deepinfra/meta-llama/Llama-3.3-70B',
        provider: 'deepinfra',
        modelId: 'meta-llama/Llama-3.3-70B',
      },
    ];

    it.each(extensibleProviderCases)(
      'parses extensible provider "$input" without throwing',
      ({ input, provider, modelId }) => {
        const result = parseModelId(input);
        expect(result.provider).toBe(provider);
        expect(result.modelId).toBe(modelId);
      },
    );
  });

  describe('getProviderNames', () => {
    it('returns array of supported provider names', () => {
      const providers = getProviderNames();
      expect(providers).toBeInstanceOf(Array);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('includes all expected providers', () => {
      const providers = getProviderNames();
      expect(providers).toContain('anthropic');
      expect(providers).toContain('openai');
      expect(providers).toContain('google');
      expect(providers).toContain('xai');
      expect(providers).toContain('deepseek');
    });

    it('returns exactly 5 providers', () => {
      const providers = getProviderNames();
      expect(providers).toHaveLength(5);
    });
  });

  describe('getProviderInfo', () => {
    // Table-driven provider info tests
    const providerInfoCases = [
      {
        provider: 'anthropic' as const,
        expectedPackage: '@ai-sdk/anthropic',
        expectedEnvVar: 'ANTHROPIC_API_KEY',
      },
      {
        provider: 'openai' as const,
        expectedPackage: '@ai-sdk/openai',
        expectedEnvVar: 'OPENAI_API_KEY',
      },
      {
        provider: 'google' as const,
        expectedPackage: '@ai-sdk/google',
        expectedEnvVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
      },
      {
        provider: 'xai' as const,
        expectedPackage: '@ai-sdk/xai',
        expectedEnvVar: 'XAI_API_KEY',
      },
      {
        provider: 'deepseek' as const,
        expectedPackage: '@ai-sdk/deepseek',
        expectedEnvVar: 'DEEPSEEK_API_KEY',
      },
    ];

    it.each(providerInfoCases)(
      'returns correct info for $provider',
      ({ provider, expectedPackage, expectedEnvVar }) => {
        const info = getProviderInfo(provider);
        expect(info.package).toBe(expectedPackage);
        expect(info.envVar).toBe(expectedEnvVar);
      },
    );

    it('returns ProviderInfo structure with required fields', () => {
      const info = getProviderInfo('anthropic');
      expect(info).toHaveProperty('package');
      expect(info).toHaveProperty('envVar');
      expect(typeof info.package).toBe('string');
      expect(typeof info.envVar).toBe('string');
    });
  });
});
