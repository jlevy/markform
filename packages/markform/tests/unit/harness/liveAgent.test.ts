/**
 * Unit tests for LiveAgent custom tool injection.
 *
 * Tests the additionalTools functionality for injecting custom tools
 * and verifying tool override behavior.
 */

import { describe, expect, it } from 'vitest';
import {
  buildMockWireFormat,
  createLiveAgent,
  wrapToolsWithCallbacks,
  type LiveAgentConfig,
} from '../../../src/harness/liveAgent.js';
import { parseForm } from '../../../src/engine/parse.js';
import type { InspectIssue, PatchRejection } from '../../../src/engine/coreTypes.js';
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
    it('returns fill_form as base tool', () => {
      const config: LiveAgentConfig = {
        model: mockModel as any,
        enableWebSearch: false,
        maxRetries: 0,
      };
      const agent = createLiveAgent(config);

      const toolNames = agent.getAvailableToolNames();

      expect(toolNames).toContain('fill_form');
    });

    it('includes custom tools from additionalTools', () => {
      const config: LiveAgentConfig = {
        model: mockModel as any,
        enableWebSearch: false,
        maxRetries: 0,
        additionalTools: {
          custom_search: mockCustomTool,
          lookup_data: mockCustomTool,
        },
      };
      const agent = createLiveAgent(config);

      const toolNames = agent.getAvailableToolNames();

      expect(toolNames).toContain('fill_form');
      expect(toolNames).toContain('custom_search');
      expect(toolNames).toContain('lookup_data');
    });

    it('dedupes tool names when custom tool has same name as built-in', () => {
      // When enableWebSearch is false but a custom web_search is provided
      const config: LiveAgentConfig = {
        model: mockModel as any,
        enableWebSearch: false,
        maxRetries: 0,
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
        maxRetries: 0,
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
        maxRetries: 0,
        additionalTools: {},
      };
      const agent = createLiveAgent(config);

      const toolNames = agent.getAvailableToolNames();

      expect(toolNames).toEqual(['fill_form']);
    });

    it('handles undefined additionalTools gracefully', () => {
      const config: LiveAgentConfig = {
        model: mockModel as any,
        enableWebSearch: false,
        maxRetries: 0,
      };
      const agent = createLiveAgent(config);

      const toolNames = agent.getAvailableToolNames();

      expect(toolNames).toEqual(['fill_form']);
    });

    it('accepts maxRetries configuration', () => {
      const config: LiveAgentConfig = {
        model: mockModel as any,
        enableWebSearch: false,
        maxRetries: 5,
      };
      // Should not throw — maxRetries is a valid config option
      const agent = createLiveAgent(config);
      expect(agent).toBeDefined();
    });

    it('accepts maxRetries: 0 to disable retries (for fast tests)', () => {
      const config: LiveAgentConfig = {
        model: mockModel as any,
        enableWebSearch: false,
        maxRetries: 0,
      };
      // Should not throw — 0 disables retries for fast test execution
      const agent = createLiveAgent(config);
      expect(agent).toBeDefined();
    });
  });
});

describe('maxRetries is required (no default)', () => {
  it('maxRetries is a required field on LiveAgentConfig', () => {
    // Verify that maxRetries is required by checking the type system enforces it.
    // This test documents the intentional removal of DEFAULT_MAX_RETRIES.
    const config: LiveAgentConfig = {
      model: mockModel as any,
      enableWebSearch: false,
      maxRetries: 0,
    };
    const agent = createLiveAgent(config);
    expect(agent).toBeDefined();
  });

  it('CLI_DEFAULT_MAX_RETRIES is the single source for CLI retry default', async () => {
    const { CLI_DEFAULT_MAX_RETRIES } = await import('../../../src/settings.js');
    expect(CLI_DEFAULT_MAX_RETRIES).toBe(3);
  });
});

describe('wrapToolsWithCallbacks', () => {
  // Helper to extract the execute function from a wrapped tool
  const getExecute = (tool: Tool | undefined) =>
    (tool as unknown as { execute: (input: unknown) => Promise<unknown> }).execute;

  describe('tool error handling (#153)', () => {
    it('re-throws with original message when tool execute fails', async () => {
      const failingTool = {
        description: 'A tool that throws',
        inputSchema: {},
        execute: () => Promise.reject(new Error('Network timeout')),
      } as unknown as Tool;

      const wrapped = wrapToolsWithCallbacks({ failing: failingTool });

      await expect(getExecute(wrapped.failing)({})).rejects.toThrow('Network timeout');
    });

    it('re-throws with non-empty fallback when error has empty message', async () => {
      const failingTool = {
        description: 'A tool that throws empty error',
        inputSchema: {},
        execute: () => Promise.reject(new Error('')),
      } as unknown as Tool;

      const wrapped = wrapToolsWithCallbacks({ failing: failingTool });

      // Must throw with a non-empty message (empty would cause Anthropic API 400)
      await expect(getExecute(wrapped.failing)({})).rejects.toThrow('Tool call failed');
    });

    it('re-throws with stringified message for non-Error thrown values', async () => {
      const failingTool = {
        description: 'A tool that throws a string',
        inputSchema: {},
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- testing non-Error rejection
        execute: () => Promise.reject('string error from tool'),
      } as unknown as Tool;

      const wrapped = wrapToolsWithCallbacks({ failing: failingTool });

      await expect(getExecute(wrapped.failing)({})).rejects.toThrow('string error from tool');
    });

    it('calls onToolEnd callback with error before re-throwing', async () => {
      const failingTool = {
        description: 'A tool that throws',
        inputSchema: {},
        execute: () => Promise.reject(new Error('API error')),
      } as unknown as Tool;

      let capturedError: string | undefined;
      const wrapped = wrapToolsWithCallbacks(
        { failing: failingTool },
        {
          onToolEnd: ({ error }) => {
            capturedError = error;
          },
        },
      );

      await expect(getExecute(wrapped.failing)({})).rejects.toThrow('API error');
      expect(capturedError).toBe('API error');
    });

    it('passes through successful tool results unchanged', async () => {
      const successTool = {
        description: 'A tool that succeeds',
        inputSchema: {},
        execute: () => Promise.resolve({ data: 'success' }),
      } as unknown as Tool;

      const wrapped = wrapToolsWithCallbacks({ success: successTool });

      const result = await getExecute(wrapped.success)({});
      expect(result).toEqual({ data: 'success' });
    });

    it('passes through declarative tools (no execute) unchanged', () => {
      const declarativeTool = {
        description: 'A declarative tool',
        inputSchema: {},
      } as unknown as Tool;

      const wrapped = wrapToolsWithCallbacks({ declarative: declarativeTool });
      expect(wrapped.declarative).toBe(declarativeTool);
    });
  });
});

describe('buildMockWireFormat prompt hygiene', () => {
  const PROMPT_HYGIENE_FORM = `---
markform:
  spec: MF/0.1
  title: Prompt Hygiene Test
  roles:
    - agent
  role_instructions:
    agent: Use %SKIP% (No evidence) or %ABORT% (Tooling failure) if needed.
---

<!-- form id="prompt_hygiene" title="Prompt Hygiene Test" -->

<!-- instructions ref="prompt_hygiene" -->
When unavailable, write %SKIP:No evidence%.
<!-- /instructions -->

<!-- group id="main" title="Main" -->

<!-- field kind="string" id="notes" role="agent" label="Notes" -->
\`\`\`value
%SKIP% (No value in fixture)
\`\`\`
<!-- /field -->

<!-- instructions ref="notes" -->
Fallback: %ABORT(Tool timeout)%.
<!-- /instructions -->

<!-- /group -->

<!-- /form -->
`;

  const issues: InspectIssue[] = [
    {
      ref: 'notes',
      scope: 'field',
      reason: 'optional_unanswered',
      message: 'Optional field not yet addressed',
      severity: 'recommended',
      priority: 1,
    },
  ];

  it('sanitizes sentinel literals in model-visible system/context prompts', () => {
    const form = parseForm(PROMPT_HYGIENE_FORM);
    const previousRejections: PatchRejection[] = [
      {
        patchIndex: 0,
        message: 'Value contains %SKIP% sentinel. Try %ABORT:No source% instead.',
      },
    ];

    const wire = buildMockWireFormat(form, issues, [], 10, 'agent', previousRejections);

    expect(wire.request.system).toContain('(skipped: No evidence)');
    expect(wire.request.system).toContain('(aborted: Tooling failure)');
    expect(wire.request.system).toContain('(aborted: Tool timeout)');
    expect(wire.request.system).not.toContain('%SKIP%');
    expect(wire.request.system).not.toContain('%ABORT%');

    expect(wire.request.prompt).toContain('(aborted: No source)');
    expect(wire.request.prompt).toContain('(skipped: No value in fixture)');
    expect(wire.request.prompt).not.toContain('%SKIP%');
    expect(wire.request.prompt).not.toContain('%ABORT%');
  });

  it('removes YAML frontmatter from embedded form markdown shown to the model', () => {
    const form = parseForm(PROMPT_HYGIENE_FORM);
    const wire = buildMockWireFormat(form, issues, [], 10, 'agent');

    expect(wire.request.prompt).toContain('```markdown');
    expect(wire.request.prompt).toContain(
      '<!-- form id="prompt_hygiene" title="Prompt Hygiene Test" -->',
    );
    expect(wire.request.prompt).not.toContain('markform:');
    expect(wire.request.prompt).not.toContain('role_instructions:');
    expect(wire.request.prompt).not.toContain('---\nmarkform:');
  });
});
