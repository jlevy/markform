import { describe, expect, it } from 'vitest';

import {
  SUGGESTED_LLMS,
  formatSuggestedLlms,
  WEB_SEARCH_CONFIG,
  hasWebSearchSupport,
  getWebSearchConfig,
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

    it('marks openai, google, xai as supported', () => {
      expect(WEB_SEARCH_CONFIG.openai?.supported).toBe(true);
      expect(WEB_SEARCH_CONFIG.google?.supported).toBe(true);
      expect(WEB_SEARCH_CONFIG.xai?.supported).toBe(true);
    });

    it('marks anthropic, deepseek as unsupported', () => {
      expect(WEB_SEARCH_CONFIG.anthropic?.supported).toBe(false);
      expect(WEB_SEARCH_CONFIG.deepseek?.supported).toBe(false);
    });

    it('provides tool names for supported providers', () => {
      expect(WEB_SEARCH_CONFIG.openai?.toolName).toBe('web_search_preview');
      expect(WEB_SEARCH_CONFIG.google?.toolName).toBe('googleSearch');
    });
  });

  describe('hasWebSearchSupport', () => {
    it('returns true for supported providers', () => {
      expect(hasWebSearchSupport('openai')).toBe(true);
      expect(hasWebSearchSupport('google')).toBe(true);
      expect(hasWebSearchSupport('xai')).toBe(true);
    });

    it('returns false for unsupported providers', () => {
      expect(hasWebSearchSupport('anthropic')).toBe(false);
      expect(hasWebSearchSupport('deepseek')).toBe(false);
    });

    it('returns false for unknown providers', () => {
      expect(hasWebSearchSupport('unknown')).toBe(false);
      expect(hasWebSearchSupport('')).toBe(false);
    });
  });

  describe('getWebSearchConfig', () => {
    it('returns config for supported providers', () => {
      const openaiConfig = getWebSearchConfig('openai');
      expect(openaiConfig).toBeDefined();
      expect(openaiConfig?.supported).toBe(true);
      expect(openaiConfig?.toolName).toBe('web_search_preview');

      const googleConfig = getWebSearchConfig('google');
      expect(googleConfig).toBeDefined();
      expect(googleConfig?.supported).toBe(true);
      expect(googleConfig?.toolName).toBe('googleSearch');
    });

    it('returns undefined for unsupported providers', () => {
      expect(getWebSearchConfig('anthropic')).toBeUndefined();
      expect(getWebSearchConfig('deepseek')).toBeUndefined();
    });

    it('returns undefined for unknown providers', () => {
      expect(getWebSearchConfig('unknown')).toBeUndefined();
    });
  });
});
