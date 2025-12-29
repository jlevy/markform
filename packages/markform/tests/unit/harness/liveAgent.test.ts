/**
 * Unit tests for LiveAgent custom tool injection.
 *
 * Tests the additionalTools functionality for injecting custom tools
 * and verifying tool override behavior.
 */

import { describe, expect, it } from 'vitest';
import { createLiveAgent, type LiveAgentConfig } from '../../../src/harness/liveAgent.js';
import type { Tool } from 'ai';

// Mock a minimal LanguageModel - we only need it for constructor
const mockModel = {
  specificationVersion: 'v1' as const,
  provider: 'test-provider',
  modelId: 'test-model',
  defaultObjectGenerationMode: 'json' as const,
  doGenerate: () =>
    Promise.resolve({
      text: '',
      finishReason: 'stop' as const,
      usage: { inputTokens: 0, outputTokens: 0 },
      rawCall: { rawPrompt: '', rawSettings: {} },
      rawResponse: { headers: {} },
      request: { body: '' },
      response: { id: '', timestamp: new Date(), modelId: '' },
      warnings: [],
      logprobs: undefined,
      providerMetadata: {},
    }),
  doStream: () =>
    Promise.resolve({
      stream: new ReadableStream(),
      rawCall: { rawPrompt: '', rawSettings: {} },
      rawResponse: { headers: {} },
      request: { body: '' },
      warnings: [],
    }),
} as const;

// Mock custom tool - minimal definition
const mockCustomTool = {
  description: 'A custom test tool',
  inputSchema: {},
} as Tool;

describe('LiveAgent', () => {
  describe('getAvailableToolNames', () => {
    it('returns generatePatches as base tool', () => {
      const config: LiveAgentConfig = {
        model: mockModel as any,
        enableWebSearch: false,
      };
      const agent = createLiveAgent(config);

      const toolNames = agent.getAvailableToolNames();

      expect(toolNames).toContain('generatePatches');
    });

    it('includes custom tools from additionalTools', () => {
      const config: LiveAgentConfig = {
        model: mockModel as any,
        enableWebSearch: false,
        additionalTools: {
          custom_search: mockCustomTool,
          lookup_data: mockCustomTool,
        },
      };
      const agent = createLiveAgent(config);

      const toolNames = agent.getAvailableToolNames();

      expect(toolNames).toContain('generatePatches');
      expect(toolNames).toContain('custom_search');
      expect(toolNames).toContain('lookup_data');
    });

    it('dedupes tool names when custom tool has same name as built-in', () => {
      // When enableWebSearch is false but a custom web_search is provided
      const config: LiveAgentConfig = {
        model: mockModel as any,
        enableWebSearch: false,
        additionalTools: {
          web_search: mockCustomTool, // Custom tool with same name
        },
      };
      const agent = createLiveAgent(config);

      const toolNames = agent.getAvailableToolNames();

      // Should have web_search exactly once (the custom one)
      const webSearchCount = toolNames.filter((n) => n === 'web_search').length;
      expect(webSearchCount).toBe(1);
    });
  });

  describe('constructor', () => {
    it('stores enableWebSearch correctly when false', () => {
      const config: LiveAgentConfig = {
        model: mockModel as any,
        enableWebSearch: false,
      };
      const agent = createLiveAgent(config);

      // Verify web search is not included when disabled
      const toolNames = agent.getAvailableToolNames();
      expect(toolNames).not.toContain('web_search');
    });

    it('handles empty additionalTools gracefully', () => {
      const config: LiveAgentConfig = {
        model: mockModel as any,
        enableWebSearch: false,
        additionalTools: {},
      };
      const agent = createLiveAgent(config);

      const toolNames = agent.getAvailableToolNames();

      expect(toolNames).toEqual(['generatePatches']);
    });

    it('handles undefined additionalTools gracefully', () => {
      const config: LiveAgentConfig = {
        model: mockModel as any,
        enableWebSearch: false,
      };
      const agent = createLiveAgent(config);

      const toolNames = agent.getAvailableToolNames();

      expect(toolNames).toEqual(['generatePatches']);
    });
  });
});
