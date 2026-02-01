/**
 * Tests for CLI FillRecord-related functionality.
 */

import { describe, it, expect } from 'vitest';

import { FillRecordCollector } from '../../../src/harness/fillRecordCollector.js';
import type { StructureSummary, ProgressCounts } from '../../../src/engine/coreTypes.js';

// Mock form metadata for testing
const mockFormMetadata = {
  id: 'test-form',
  title: 'Test Form',
  description: 'A test form',
  structure: {
    groupCount: 1,
    fieldCount: 3,
    optionCount: 0,
    columnCount: 0,
    fieldCountByKind: {
      string: 2,
      number: 1,
      string_list: 0,
      checkboxes: 0,
      single_select: 0,
      multi_select: 0,
      url: 0,
      url_list: 0,
      date: 0,
      year: 0,
      table: 0,
    },
    groupsById: {},
    fieldsById: {},
    optionsById: {},
    columnsById: {},
  } as StructureSummary,
};

const mockProgressCounts: ProgressCounts = {
  totalFields: 3,
  requiredFields: 2,
  unansweredFields: 0,
  answeredFields: 3,
  skippedFields: 0,
  abortedFields: 0,
  validFields: 3,
  invalidFields: 0,
  emptyFields: 0,
  filledFields: 3,
  emptyRequiredFields: 0,
  totalNotes: 0,
};

describe('FillRecord CLI helpers', () => {
  describe('sidecar file path derivation', () => {
    // This tests the pattern used in fill.ts for deriving sidecar paths
    const deriveSidecarPath = (outputPath: string): string => {
      return outputPath.replace(/\.(form\.)?md$/, '.fill.json');
    };

    it('handles .form.md extension', () => {
      expect(deriveSidecarPath('/path/to/doc.form.md')).toBe('/path/to/doc.fill.json');
    });

    it('handles plain .md extension', () => {
      expect(deriveSidecarPath('/path/to/doc.md')).toBe('/path/to/doc.fill.json');
    });

    it('handles paths with multiple dots', () => {
      expect(deriveSidecarPath('/path/to/doc.v1.form.md')).toBe('/path/to/doc.v1.fill.json');
    });

    it('handles versioned filenames', () => {
      expect(deriveSidecarPath('/forms/doc.001.form.md')).toBe('/forms/doc.001.fill.json');
    });

    it('preserves directory structure', () => {
      expect(deriveSidecarPath('/home/user/forms/project/report.form.md')).toBe(
        '/home/user/forms/project/report.fill.json',
      );
    });

    it('handles Windows-style paths', () => {
      // Note: regex still works on forward slashes; Windows paths with backslashes are normalized
      expect(deriveSidecarPath('C:/Users/docs/form.form.md')).toBe('C:/Users/docs/form.fill.json');
    });
  });

  describe('CLI callback wiring for FillRecordCollector', () => {
    /**
     * This test verifies that when the CLI creates callbacks for the collector,
     * it must include onTurnStart and onTurnComplete to populate the timeline.
     * See mf-mgxo bug: CLI was missing these callbacks causing empty timelines.
     */
    it('produces non-empty timeline when turn callbacks are properly wired', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4.1-mini',
      });

      // Simulate CLI callback object that properly wires turn callbacks
      const callbacks = {
        onTurnStart: (turn: {
          turnNumber: number;
          issuesCount: number;
          order?: number;
          executionId?: string;
        }) => {
          collector.onTurnStart({
            turnNumber: turn.turnNumber,
            issuesCount: turn.issuesCount,
            order: turn.order ?? 0,
            executionId: turn.executionId ?? 'cli-serial',
          });
        },
        onTurnComplete: (progress: {
          turnNumber: number;
          issuesShown: number;
          patchesApplied: number;
          requiredIssuesRemaining: number;
          isComplete: boolean;
          rejectedPatches?: { patchIndex: number; message: string; fieldId?: string }[];
          issues?: unknown[];
          patches?: unknown[];
        }) => {
          // The collector expects TurnProgress shape with rejectedPatches array
          collector.onTurnComplete({
            turnNumber: progress.turnNumber,
            issuesShown: progress.issuesShown,
            patchesApplied: progress.patchesApplied,
            requiredIssuesRemaining: progress.requiredIssuesRemaining,
            isComplete: progress.isComplete,
            rejectedPatches: progress.rejectedPatches ?? [],
            issues: (progress.issues ?? []) as never[],
            patches: (progress.patches ?? []) as never[],
          });
        },
        onToolStart: (call: { name: string; input: unknown; executionId: string }) => {
          collector.onToolStart(call);
        },
        onToolEnd: (call: {
          name: string;
          output: unknown;
          durationMs: number;
          error?: string;
          executionId: string;
        }) => {
          collector.onToolEnd(call);
        },
        onLlmCallStart: (call: { model: string; executionId: string }) => {
          collector.onLlmCallStart(call);
        },
        onLlmCallEnd: (call: {
          model: string;
          inputTokens: number;
          outputTokens: number;
          executionId: string;
        }) => {
          collector.onLlmCallEnd(call);
        },
      };

      // Simulate a 2-turn fill execution
      // Turn 1
      callbacks.onTurnStart({ turnNumber: 1, issuesCount: 3, executionId: 'cli-serial' });
      callbacks.onLlmCallStart({ model: 'gpt-4.1-mini', executionId: 'cli-serial' });
      callbacks.onToolStart({
        name: 'fill_form',
        input: { patches: [] },
        executionId: 'cli-serial',
      });
      callbacks.onToolEnd({
        name: 'fill_form',
        output: { success: true },
        durationMs: 150,
        executionId: 'cli-serial',
      });
      callbacks.onLlmCallEnd({
        model: 'gpt-4.1-mini',
        inputTokens: 1000,
        outputTokens: 200,
        executionId: 'cli-serial',
      });
      callbacks.onTurnComplete({
        turnNumber: 1,
        issuesShown: 3,
        patchesApplied: 2,
        requiredIssuesRemaining: 1,
        isComplete: false,
        rejectedPatches: [{ patchIndex: 0, message: 'validation error', fieldId: 'field1' }],
      });

      // Turn 2
      callbacks.onTurnStart({ turnNumber: 2, issuesCount: 1, executionId: 'cli-serial' });
      callbacks.onLlmCallStart({ model: 'gpt-4.1-mini', executionId: 'cli-serial' });
      callbacks.onToolStart({
        name: 'fill_form',
        input: { patches: [] },
        executionId: 'cli-serial',
      });
      callbacks.onToolEnd({
        name: 'fill_form',
        output: { success: true },
        durationMs: 120,
        executionId: 'cli-serial',
      });
      callbacks.onLlmCallEnd({
        model: 'gpt-4.1-mini',
        inputTokens: 800,
        outputTokens: 150,
        executionId: 'cli-serial',
      });
      callbacks.onTurnComplete({
        turnNumber: 2,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: true,
        rejectedPatches: [],
      });

      collector.setStatus('completed');
      const record = collector.getRecord(mockProgressCounts);

      // Verify timeline is populated (this is what was broken - mf-mgxo)
      expect(record.timeline).toBeDefined();
      expect(record.timeline.length).toBe(2);

      // Verify turn 1 details
      const turn1 = record.timeline[0];
      expect(turn1).toBeDefined();
      expect(turn1?.turnNumber).toBe(1);
      expect(turn1?.patchesApplied).toBe(2);
      expect(turn1?.patchesRejected).toBe(1);
      // Tool calls are matched by executionId - just verify they exist
      expect(turn1?.toolCalls).toBeDefined();
      expect(turn1?.toolCalls?.length).toBeGreaterThan(0);

      // Verify turn 2 details
      const turn2 = record.timeline[1];
      expect(turn2).toBeDefined();
      expect(turn2?.turnNumber).toBe(2);
      expect(turn2?.patchesApplied).toBe(1);

      // Verify execution metadata
      expect(record.execution.totalTurns).toBe(2);

      // Verify LLM totals
      expect(record.llm.totalCalls).toBe(2);
      expect(record.llm.inputTokens).toBe(1800);
      expect(record.llm.outputTokens).toBe(350);
    });

    it('produces empty timeline when turn callbacks are NOT wired (demonstrates bug)', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4.1-mini',
      });

      // Simulate the BROKEN CLI callback object (missing onTurnStart/onTurnComplete)
      // This is what the CLI was doing before the fix
      const brokenCallbacks = {
        // Missing: onTurnStart
        // Missing: onTurnComplete
        onToolStart: (call: { name: string; input: unknown; executionId: string }) => {
          collector.onToolStart(call);
        },
        onToolEnd: (call: {
          name: string;
          output: unknown;
          durationMs: number;
          error?: string;
          executionId: string;
        }) => {
          collector.onToolEnd(call);
        },
        onLlmCallStart: (call: { model: string; executionId: string }) => {
          collector.onLlmCallStart(call);
        },
        onLlmCallEnd: (call: {
          model: string;
          inputTokens: number;
          outputTokens: number;
          executionId: string;
        }) => {
          collector.onLlmCallEnd(call);
        },
      };

      // Simulate execution WITHOUT calling turn callbacks
      brokenCallbacks.onLlmCallStart({ model: 'gpt-4.1-mini', executionId: 'cli-serial' });
      brokenCallbacks.onToolStart({
        name: 'fill_form',
        input: { patches: [] },
        executionId: 'cli-serial',
      });
      brokenCallbacks.onToolEnd({
        name: 'fill_form',
        output: { success: true },
        durationMs: 150,
        executionId: 'cli-serial',
      });
      brokenCallbacks.onLlmCallEnd({
        model: 'gpt-4.1-mini',
        inputTokens: 1000,
        outputTokens: 200,
        executionId: 'cli-serial',
      });

      collector.setStatus('completed');
      const record = collector.getRecord(mockProgressCounts);

      // Timeline is empty because turn callbacks were never called
      expect(record.timeline.length).toBe(0);

      // But LLM totals are still captured (this was working)
      expect(record.llm.inputTokens).toBe(1000);
      expect(record.llm.outputTokens).toBe(200);

      // Total turns is 0 because no turns were recorded
      expect(record.execution.totalTurns).toBe(0);
    });
  });
});
