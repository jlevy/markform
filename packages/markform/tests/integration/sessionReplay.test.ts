/**
 * Session Replay Integration Tests
 *
 * Uses MockLanguageModelV3 from AI SDK to replay recorded sessions
 * without making actual LLM API calls. This enables testing of the
 * full LiveAgent flow with deterministic, repeatable results.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { MockLanguageModelV3 } from 'ai/test';

import { fillForm } from '../../src/harness/programmaticFill.js';
import { parseSession } from '../../src/engine/session.js';
import type { SessionTranscript } from '../../src/engine/coreTypes.js';

// =============================================================================
// Session-Based Mock Model
// =============================================================================

/**
 * Creates a MockLanguageModelV3 that replays recorded session responses.
 *
 * Each call to doGenerate returns the next turn's response from the session,
 * converted to the format expected by AI SDK V3.
 */
function createSessionMockModel(session: SessionTranscript): MockLanguageModelV3 {
  let turnIndex = 0;

  const doGenerate = (): any => {
    const turn = session.turns[turnIndex];
    if (!turn?.wire?.response) {
      throw new Error(`No wire response for turn ${turnIndex}`);
    }

    turnIndex++;

    // Convert session wire format to AI SDK V3 GenerateResult format
    // V3 uses `content` array with LanguageModelV3Content items
    const step = turn.wire.response.steps[0];
    const content =
      step?.toolCalls?.map((tc, idx) => ({
        type: 'tool-call' as const,
        toolCallId: `call_${idx}`,
        toolName: tc.toolName,
        // V3 expects input as stringified JSON
        input: typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input),
      })) ?? [];

    // V3 uses structured token counting
    const inputTokens = turn.wire.response.usage?.inputTokens ?? 0;
    const outputTokens = turn.wire.response.usage?.outputTokens ?? 0;

    return {
      content,
      finishReason: {
        type: 'tool-calls' as const,
        unified: 'tool-calls' as const,
        raw: 'tool_calls',
      },
      usage: {
        inputTokens: { total: inputTokens, noCache: inputTokens, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: outputTokens, noCache: outputTokens, cacheRead: 0, cacheWrite: 0 },
      },
      request: { body: '' },
      response: {
        id: `response_${turnIndex}`,
        timestamp: new Date(),
        modelId: 'mock-model',
      },
      warnings: [],
    };
  };

  return new MockLanguageModelV3({
    doGenerate,
    doStream: () => {
      throw new Error('Streaming not supported in session replay');
    },
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('Session Replay Integration', () => {
  const EXAMPLES_DIR = join(__dirname, '../../examples');

  describe('simple form session', () => {
    it('replays simple.session.yaml through fillForm with mock model', async () => {
      // Load session and form content
      const sessionPath = join(EXAMPLES_DIR, 'simple/simple.session.yaml');
      const sessionYaml = readFileSync(sessionPath, 'utf-8');
      const session = parseSession(sessionYaml);

      const formPath = join(EXAMPLES_DIR, 'simple/simple.form.md');
      const formContent = readFileSync(formPath, 'utf-8');

      // Create mock model from session
      const mockModel = createSessionMockModel(session);

      // Run fillForm with the mock model
      const result = await fillForm({
        form: formContent,
        model: mockModel,
        enableWebSearch: false,
        maxTurns: session.turns.length,
        maxPatchesPerTurn: 20,
        maxIssuesPerTurn: 20,
        targetRoles: ['*'],
        fillMode: 'continue',
        captureWireFormat: false,
      });

      // Verify results
      expect(result.turns).toBe(session.turns.length);
      expect(result.status.ok).toBe(session.final.expectComplete);
    });
  });

  describe('mock model utility', () => {
    it('creates MockLanguageModelV3 with doGenerate', () => {
      const minimalSession: SessionTranscript = {
        sessionVersion: '0.1.0',
        mode: 'mock',
        form: { path: 'test.form.md' },
        harness: {
          maxTurns: 1,
          maxPatchesPerTurn: 10,
          maxIssuesPerTurn: 10,
          targetRoles: ['*'],
          fillMode: 'continue',
        },
        turns: [
          {
            turn: 1,
            inspect: { issues: [] },
            apply: { patches: [] },
            after: {
              requiredIssueCount: 0,
              markdownSha256: 'abc123',
              answeredFieldCount: 0,
              skippedFieldCount: 0,
            },
            wire: {
              request: { system: 'test', prompt: 'test', tools: {} },
              response: {
                steps: [
                  {
                    toolCalls: [{ toolName: 'generatePatches', input: { patches: [] } }],
                    toolResults: [],
                    text: null,
                  },
                ],
                usage: { inputTokens: 100, outputTokens: 50 },
              },
            },
          },
        ],
        final: {
          expectComplete: false,
          expectedCompletedForm: 'test-filled.form.md',
        },
      };

      const mockModel = createSessionMockModel(minimalSession);

      expect(mockModel).toBeDefined();
      expect(mockModel.specificationVersion).toBe('v3');
      expect(mockModel.provider).toBe('mock-provider');
    });
  });
});
