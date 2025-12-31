/**
 * Tests for fillLogging.ts - CLI logging callbacks factory.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createFillLoggingCallbacks } from '../../../src/cli/lib/fillLogging.js';
import type { CommandContext } from '../../../src/cli/lib/cliTypes.js';
import type { InspectIssue, Patch } from '../../../src/engine/coreTypes.js';
import type { TurnStats } from '../../../src/harness/harnessTypes.js';

describe('fillLogging', () => {
  // Capture console.log output
  let consoleOutput: string[];
  const originalLog = console.log;

  beforeEach(() => {
    consoleOutput = [];
    console.log = vi.fn((...args: unknown[]) => {
      consoleOutput.push(args.map(String).join(' '));
    });
  });

  afterEach(() => {
    console.log = originalLog;
  });

  describe('createFillLoggingCallbacks', () => {
    it('returns all expected callbacks', () => {
      const ctx: CommandContext = {
        verbose: false,
        quiet: false,
        dryRun: false,
        format: 'console',
        overwrite: false,
      };

      const callbacks = createFillLoggingCallbacks(ctx);

      expect(typeof callbacks.onIssuesIdentified).toBe('function');
      expect(typeof callbacks.onPatchesGenerated).toBe('function');
      expect(typeof callbacks.onTurnComplete).toBe('function');
      expect(typeof callbacks.onToolStart).toBe('function');
      expect(typeof callbacks.onToolEnd).toBe('function');
      expect(typeof callbacks.onLlmCallStart).toBe('function');
      expect(typeof callbacks.onLlmCallEnd).toBe('function');
    });

    describe('onIssuesIdentified', () => {
      it('logs turn number and issues by default', () => {
        const ctx: CommandContext = {
          verbose: false,
          quiet: false,
          dryRun: false,
          format: 'console',
          overwrite: false,
        };

        const callbacks = createFillLoggingCallbacks(ctx);
        const issues: InspectIssue[] = [
          {
            scope: 'field',
            ref: 'company_name',
            reason: 'required_missing',
            message: 'Required field is empty',
            severity: 'required',
            priority: 1,
          },
          {
            scope: 'field',
            ref: 'revenue',
            reason: 'validation_error',
            message: 'Invalid value',
            severity: 'required',
            priority: 2,
          },
        ];

        callbacks.onIssuesIdentified!({ turnNumber: 1, issues });

        expect(consoleOutput.length).toBe(1);
        expect(consoleOutput[0]).toContain('Turn 1');
        expect(consoleOutput[0]).toContain('company_name');
        expect(consoleOutput[0]).toContain('missing');
        expect(consoleOutput[0]).toContain('revenue');
        expect(consoleOutput[0]).toContain('invalid');
      });

      it('does not log when quiet mode is enabled', () => {
        const ctx: CommandContext = {
          verbose: false,
          quiet: true,
          dryRun: false,
          format: 'console',
          overwrite: false,
        };

        const callbacks = createFillLoggingCallbacks(ctx);
        callbacks.onIssuesIdentified!({ turnNumber: 1, issues: [] });

        expect(consoleOutput.length).toBe(0);
      });
    });

    describe('onPatchesGenerated', () => {
      it('logs patches with field IDs and values by default', () => {
        const ctx: CommandContext = {
          verbose: false,
          quiet: false,
          dryRun: false,
          format: 'console',
          overwrite: false,
        };

        const callbacks = createFillLoggingCallbacks(ctx);
        const patches: Patch[] = [
          { op: 'set_string', fieldId: 'company_name', value: 'Acme Corp' },
          { op: 'set_number', fieldId: 'revenue', value: 1000000 },
        ];

        callbacks.onPatchesGenerated!({ turnNumber: 1, patches });

        expect(consoleOutput.length).toBe(3); // header + 2 patches
        expect(consoleOutput[0]).toContain('2');
        expect(consoleOutput[0]).toContain('patch');
        expect(consoleOutput[1]).toContain('company_name');
        expect(consoleOutput[1]).toContain('Acme Corp');
        expect(consoleOutput[2]).toContain('revenue');
        expect(consoleOutput[2]).toContain('1000000');
      });

      it('shows token counts only in verbose mode', () => {
        const ctxVerbose: CommandContext = {
          verbose: true,
          quiet: false,
          dryRun: false,
          format: 'console',
          overwrite: false,
        };

        const ctxNormal: CommandContext = {
          verbose: false,
          quiet: false,
          dryRun: false,
          format: 'console',
          overwrite: false,
        };

        const patches: Patch[] = [{ op: 'set_string', fieldId: 'test', value: 'value' }];
        const stats: TurnStats = {
          inputTokens: 500,
          outputTokens: 100,
          toolCalls: [],
          formProgress: {
            answeredFields: 1,
            skippedFields: 0,
            requiredRemaining: 0,
            optionalRemaining: 0,
          },
        };

        // Normal mode - no token counts
        const callbacksNormal = createFillLoggingCallbacks(ctxNormal);
        callbacksNormal.onPatchesGenerated!({ turnNumber: 1, patches, stats });
        const normalOutput = [...consoleOutput];
        consoleOutput = [];

        // Verbose mode - should show token counts
        const callbacksVerbose = createFillLoggingCallbacks(ctxVerbose);
        callbacksVerbose.onPatchesGenerated!({ turnNumber: 1, patches, stats });

        // Normal should not have token info in main output
        const normalHasTokens = normalOutput.some(
          (line) => line.includes('500') && line.includes('100'),
        );
        expect(normalHasTokens).toBe(false);

        // Verbose should have token info
        const verboseHasTokens = consoleOutput.some(
          (line) => line.includes('500') && line.includes('100'),
        );
        expect(verboseHasTokens).toBe(true);
      });
    });

    describe('onTurnComplete', () => {
      it('logs completion status when complete', () => {
        const ctx: CommandContext = {
          verbose: false,
          quiet: false,
          dryRun: false,
          format: 'console',
          overwrite: false,
        };

        const callbacks = createFillLoggingCallbacks(ctx);
        callbacks.onTurnComplete!({
          turnNumber: 3,
          issuesShown: 0,
          patchesApplied: 5,
          requiredIssuesRemaining: 0,
          isComplete: true,
          issues: [],
          patches: [],
          rejectedPatches: [],
        });

        expect(consoleOutput.length).toBe(1);
        expect(consoleOutput[0]).toContain('Complete');
      });

      it('does not log when not complete', () => {
        const ctx: CommandContext = {
          verbose: false,
          quiet: false,
          dryRun: false,
          format: 'console',
          overwrite: false,
        };

        const callbacks = createFillLoggingCallbacks(ctx);
        callbacks.onTurnComplete!({
          turnNumber: 3,
          issuesShown: 2,
          patchesApplied: 5,
          requiredIssuesRemaining: 2,
          isComplete: false,
          issues: [],
          patches: [],
          rejectedPatches: [],
        });

        expect(consoleOutput.length).toBe(0);
      });
    });

    describe('tool callbacks (verbose only)', () => {
      it('onToolStart logs only in verbose mode', () => {
        const ctxNormal: CommandContext = {
          verbose: false,
          quiet: false,
          dryRun: false,
          format: 'console',
          overwrite: false,
        };

        const ctxVerbose: CommandContext = {
          verbose: true,
          quiet: false,
          dryRun: false,
          format: 'console',
          overwrite: false,
        };

        // Normal mode
        const callbacksNormal = createFillLoggingCallbacks(ctxNormal);
        callbacksNormal.onToolStart!({ name: 'web_search', input: {} });
        expect(consoleOutput.length).toBe(0);

        // Verbose mode
        const callbacksVerbose = createFillLoggingCallbacks(ctxVerbose);
        callbacksVerbose.onToolStart!({ name: 'web_search', input: {} });
        expect(consoleOutput.length).toBe(1);
        expect(consoleOutput[0]).toContain('web_search');
      });

      it('onToolEnd logs only in verbose mode', () => {
        const ctxVerbose: CommandContext = {
          verbose: true,
          quiet: false,
          dryRun: false,
          format: 'console',
          overwrite: false,
        };

        const callbacks = createFillLoggingCallbacks(ctxVerbose);
        callbacks.onToolEnd!({
          name: 'web_search',
          output: 'results',
          durationMs: 1234,
        });

        expect(consoleOutput.length).toBe(1);
        expect(consoleOutput[0]).toContain('web_search');
        expect(consoleOutput[0]).toContain('1234');
      });

      it('onToolEnd logs errors', () => {
        const ctxVerbose: CommandContext = {
          verbose: true,
          quiet: false,
          dryRun: false,
          format: 'console',
          overwrite: false,
        };

        const callbacks = createFillLoggingCallbacks(ctxVerbose);
        callbacks.onToolEnd!({
          name: 'web_search',
          output: null,
          durationMs: 500,
          error: 'Network timeout',
        });

        expect(consoleOutput.length).toBe(1);
        expect(consoleOutput[0]).toContain('failed');
        expect(consoleOutput[0]).toContain('Network timeout');
      });
    });

    describe('LLM callbacks (verbose only)', () => {
      it('onLlmCallStart logs only in verbose mode', () => {
        const ctxVerbose: CommandContext = {
          verbose: true,
          quiet: false,
          dryRun: false,
          format: 'console',
          overwrite: false,
        };

        const callbacks = createFillLoggingCallbacks(ctxVerbose);
        callbacks.onLlmCallStart!({ model: 'claude-sonnet' });

        expect(consoleOutput.length).toBe(1);
        expect(consoleOutput[0]).toContain('claude-sonnet');
      });

      it('onLlmCallEnd logs token counts in verbose mode', () => {
        const ctxVerbose: CommandContext = {
          verbose: true,
          quiet: false,
          dryRun: false,
          format: 'console',
          overwrite: false,
        };

        const callbacks = createFillLoggingCallbacks(ctxVerbose);
        callbacks.onLlmCallEnd!({
          model: 'claude-sonnet',
          inputTokens: 1000,
          outputTokens: 250,
        });

        expect(consoleOutput.length).toBe(1);
        expect(consoleOutput[0]).toContain('1000');
        expect(consoleOutput[0]).toContain('250');
      });
    });

    describe('spinner integration', () => {
      it('updates spinner message for web search', () => {
        const ctx: CommandContext = {
          verbose: false,
          quiet: false,
          dryRun: false,
          format: 'console',
          overwrite: false,
        };

        const spinnerMessage = vi.fn();
        const callbacks = createFillLoggingCallbacks(ctx, {
          spinner: {
            message: spinnerMessage,
            update: vi.fn(),
            stop: vi.fn(),
            error: vi.fn(),
            getElapsedMs: () => 0,
          },
        });

        callbacks.onToolStart!({ name: 'web_search', input: {} });

        expect(spinnerMessage).toHaveBeenCalledWith('Web search...');
      });
    });
  });
});
