import { describe, expect, it } from 'vitest';

import {
  SUGGESTED_LLMS,
  formatSuggestedLlms,
  WEB_SEARCH_CONFIG,
  hasWebSearchSupport,
  getWebSearchConfig,
  parseModelIdForDisplay,
} from '../../src/llms.js';

describe('llms', () => {
  describe('SUGGESTED_LLMS', () => {
    it('contains all major providers', () => {
      expect(SUGGESTED_LLMS).toHaveProperty('openai');
      expect(SUGGESTED_LLMS).toHaveProperty('anthropic');
      expect(SUGGESTED_LLMS).toHaveProperty('google');
      expect(SUGGESTED_LLMS).toHaveProperty('xai');
      expect(SUGGESTED_LLMS).toHaveProperty('deepseek');
    });

    it('has models for each provider', () => {
      for (const [_provider, models] of Object.entries(SUGGESTED_LLMS)) {
        expect(Array.isArray(models)).toBe(true);
        expect(models.length).toBeGreaterThan(0);
        // All models should be non-empty strings
        for (const model of models) {
          expect(typeof model).toBe('string');
          expect(model.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('formatSuggestedLlms', () => {
    it('returns formatted string with all providers', () => {
      const output = formatSuggestedLlms();
      expect(output).toContain('Available providers');
      expect(output).toContain('openai/');
      expect(output).toContain('anthropic/');
      expect(output).toContain('google/');
    });

    it('includes model IDs with provider prefix', () => {
      const output = formatSuggestedLlms();
      expect(output).toContain('anthropic/claude-opus-4-5');
      expect(output).toContain('openai/gpt-5-mini');
    });
  });

  describe('WEB_SEARCH_CONFIG', () => {
    it('defines config for all providers in SUGGESTED_LLMS', () => {
      for (const provider of Object.keys(SUGGESTED_LLMS)) {
        expect(WEB_SEARCH_CONFIG).toHaveProperty(provider);
      }
    });

    it('supported providers have toolNames', () => {
      for (const [_provider, config] of Object.entries(WEB_SEARCH_CONFIG)) {
        if (config.supported) {
          expect(config.toolName).toBeDefined();
          expect(config.toolName!.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('hasWebSearchSupport', () => {
    it('returns correct values for known and unknown providers', () => {
      expect(hasWebSearchSupport('openai')).toBe(true);
      expect(hasWebSearchSupport('deepseek')).toBe(false);
      expect(hasWebSearchSupport('unknown')).toBe(false);
    });
  });

  describe('getWebSearchConfig', () => {
    it('returns config with toolName for supported providers', () => {
      const config = getWebSearchConfig('openai');
      expect(config).toBeDefined();
      expect(config?.toolName).toBeDefined();
    });

    it('returns undefined for unsupported/unknown providers', () => {
      expect(getWebSearchConfig('deepseek')).toBeUndefined();
      expect(getWebSearchConfig('unknown')).toBeUndefined();
    });
  });

  describe('parseModelIdForDisplay', () => {
    it('parses valid provider/model format', () => {
      const result = parseModelIdForDisplay('anthropic/claude-sonnet-4');
      expect(result).toEqual({ provider: 'anthropic', model: 'claude-sonnet-4' });
    });

    it('handles various providers', () => {
      expect(parseModelIdForDisplay('openai/gpt-4o')).toEqual({
        provider: 'openai',
        model: 'gpt-4o',
      });
      expect(parseModelIdForDisplay('google/gemini-2.5-flash')).toEqual({
        provider: 'google',
        model: 'gemini-2.5-flash',
      });
    });

    it('returns unknown provider for model without slash', () => {
      const result = parseModelIdForDisplay('claude-sonnet-4');
      expect(result).toEqual({ provider: 'unknown', model: 'claude-sonnet-4' });
    });

    it('returns unknown provider for empty provider part', () => {
      const result = parseModelIdForDisplay('/model-name');
      expect(result).toEqual({ provider: 'unknown', model: '/model-name' });
    });

    it('returns unknown provider for empty model part', () => {
      const result = parseModelIdForDisplay('provider/');
      expect(result).toEqual({ provider: 'unknown', model: 'provider/' });
    });

    it('handles model names with multiple slashes', () => {
      const result = parseModelIdForDisplay('provider/model/variant');
      expect(result).toEqual({ provider: 'provider', model: 'model/variant' });
    });
  });
});
