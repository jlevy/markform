/**
 * Tests for researchHelpers - pure functions extracted from research command.
 */

import { describe, it, expect } from 'vitest';

import {
  validateResearchModel,
  parseResearchHarnessOptions,
} from '../../../src/cli/lib/researchHelpers.js';

describe('researchHelpers', () => {
  describe('validateResearchModel', () => {
    it('returns invalid when model is undefined', () => {
      const result = validateResearchModel(undefined, 'openai');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('--model is required');
    });

    it('returns invalid for provider without web search support', () => {
      // deepseek doesn't support web search
      const result = validateResearchModel('deepseek/deepseek-chat', 'deepseek');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not support web search');
      expect(result.webSearchProviders).toBeDefined();
      expect(Array.isArray(result.webSearchProviders)).toBe(true);
    });

    it('returns valid for provider with web search support', () => {
      // openai supports web search
      const result = validateResearchModel('openai/gpt-4', 'openai');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for google provider', () => {
      const result = validateResearchModel('google/gemini-2.5-flash', 'google');
      expect(result.valid).toBe(true);
    });

    it('returns valid for xai provider', () => {
      const result = validateResearchModel('xai/grok-4', 'xai');
      expect(result.valid).toBe(true);
    });
  });

  describe('parseResearchHarnessOptions', () => {
    it('parses valid options', () => {
      const result = parseResearchHarnessOptions({
        maxTurns: '5',
        maxPatches: '8',
        maxIssues: '3',
      });

      expect(result.maxTurns).toBe(5);
      expect(result.maxPatchesPerTurn).toBe(8);
      expect(result.maxIssuesPerTurn).toBe(3);
    });

    it('uses defaults for missing options', () => {
      const result = parseResearchHarnessOptions({});

      expect(result.maxTurns).toBe(10);
      expect(result.maxPatchesPerTurn).toBe(10);
      expect(result.maxIssuesPerTurn).toBe(10);
    });

    it('handles partial options', () => {
      const result = parseResearchHarnessOptions({
        maxTurns: '20',
      });

      expect(result.maxTurns).toBe(20);
      expect(result.maxPatchesPerTurn).toBe(10);
      expect(result.maxIssuesPerTurn).toBe(10);
    });

    it('handles string numbers correctly', () => {
      const result = parseResearchHarnessOptions({
        maxTurns: '100',
        maxPatches: '50',
        maxIssues: '25',
      });

      expect(result.maxTurns).toBe(100);
      expect(result.maxPatchesPerTurn).toBe(50);
      expect(result.maxIssuesPerTurn).toBe(25);
    });
  });
});
