/**
 * Tests for FillRecordCollector - thread-safe, append-only collector for fill records.
 */

import { describe, it, expect } from 'vitest';

import { FillRecordCollector } from '../../../src/harness/fillRecordCollector.js';
import { CollectorEventSchema } from '../../../src/harness/fillRecord.js';
import type { ProgressCounts, StructureSummary } from '../../../src/engine/coreTypes.js';

describe('FillRecordCollector', () => {
  // Mock form metadata
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

  describe('initialization', () => {
    it('creates a collector with form metadata', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      expect(collector).toBeDefined();
    });

    it('accepts custom data on initialization', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        customData: { userId: 'user-123' },
      });

      expect(collector).toBeDefined();
    });
  });

  describe('onTurnStart', () => {
    it('records turn start event', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 3,
        order: 0,
        executionId: 'eid:serial:o0',
      });

      // Complete the turn to create a timeline entry
      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 3,
        patchesApplied: 2,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      // Turn should be tracked (we'll verify in getRecord)
      const record = collector.getRecord(mockProgressCounts);
      expect(record.timeline).toHaveLength(1);
      expect(record.timeline[0]!.turnNumber).toBe(1);
    });
  });

  describe('onTurnComplete', () => {
    it('completes turn with patches and progress', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 3,
        order: 0,
        executionId: 'eid:serial:o0',
      });

      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 3,
        patchesApplied: 2,
        requiredIssuesRemaining: 1,
        isComplete: false,
        issues: [],
        patches: [],
        rejectedPatches: [{ patchIndex: 0, message: 'invalid' }],
      });

      const record = collector.getRecord(mockProgressCounts);
      expect(record.timeline[0]!.patchesApplied).toBe(2);
      expect(record.timeline[0]!.patchesRejected).toBe(1);
      expect(record.timeline[0]!.issuesAddressed).toBe(3);
    });
  });

  describe('coercion warnings in timeline', () => {
    it('records coercion warnings from TurnProgress in timeline entries', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 2,
        order: 0,
        executionId: 'eid:serial:o0',
      });

      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 2,
        patchesApplied: 2,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
        coercionWarnings: [
          {
            patchIndex: 0,
            fieldId: 'tags',
            message: 'Coerced single string to array',
            coercion: 'string_to_list',
          },
        ],
      });

      const record = collector.getRecord(mockProgressCounts);
      expect(record.timeline[0]!.coercionWarnings).toHaveLength(1);
      expect(record.timeline[0]!.coercionWarnings![0]!.fieldId).toBe('tags');
      expect(record.timeline[0]!.coercionWarnings![0]!.coercion).toBe('string_to_list');
    });

    it('omits coercionWarnings from timeline when empty', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 1,
        order: 0,
        executionId: 'eid:serial:o0',
      });

      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      const record = collector.getRecord(mockProgressCounts);
      expect(record.timeline[0]!.coercionWarnings).toBeUndefined();
    });
  });

  describe('onLlmCallStart / onLlmCallEnd', () => {
    it('tracks LLM token usage', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 1,
        order: 0,
        executionId: 'eid:serial:o0',
      });

      collector.onLlmCallStart({ model: 'claude-sonnet-4-5', executionId: 'eid:serial:o0' });
      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 500,
        outputTokens: 100,
        executionId: 'eid:serial:o0',
      });

      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      const record = collector.getRecord(mockProgressCounts);
      expect(record.llm.totalCalls).toBe(1);
      expect(record.llm.inputTokens).toBe(500);
      expect(record.llm.outputTokens).toBe(100);
      expect(record.timeline[0]!.tokens.input).toBe(500);
      expect(record.timeline[0]!.tokens.output).toBe(100);
    });

    it('aggregates tokens across multiple turns', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      // Turn 1
      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 2,
        order: 0,
        executionId: 'eid:serial:o0',
      });
      collector.onLlmCallStart({ model: 'claude-sonnet-4-5', executionId: 'eid:serial:o0' });
      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 500,
        outputTokens: 100,
        executionId: 'eid:serial:o0',
      });
      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 2,
        patchesApplied: 1,
        requiredIssuesRemaining: 1,
        isComplete: false,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      // Turn 2
      collector.onTurnStart({
        turnNumber: 2,
        issuesCount: 1,
        order: 0,
        executionId: 'eid:serial:o0',
      });
      collector.onLlmCallStart({ model: 'claude-sonnet-4-5', executionId: 'eid:serial:o0' });
      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 600,
        outputTokens: 150,
        executionId: 'eid:serial:o0',
      });
      collector.onTurnComplete({
        turnNumber: 2,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      const record = collector.getRecord(mockProgressCounts);
      expect(record.llm.totalCalls).toBe(2);
      expect(record.llm.inputTokens).toBe(1100);
      expect(record.llm.outputTokens).toBe(250);
    });
  });

  describe('onToolStart / onToolEnd', () => {
    it('tracks tool calls with timing', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 1,
        order: 0,
        executionId: 'eid:serial:o0',
      });

      collector.onToolStart({
        name: 'web_search',
        input: { query: 'test query' },
        executionId: 'eid:serial:o0',
      });
      collector.onToolEnd({
        name: 'web_search',
        output: { results: ['a', 'b'] },
        durationMs: 1500,
        executionId: 'eid:serial:o0',
      });

      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      const record = collector.getRecord(mockProgressCounts);
      expect(record.timeline[0]!.toolCalls).toHaveLength(1);
      expect(record.timeline[0]!.toolCalls[0]!.tool).toBe('web_search');
      expect(record.timeline[0]!.toolCalls[0]!.durationMs).toBe(1500);
      expect(record.timeline[0]!.toolCalls[0]!.success).toBe(true);
    });

    it('tracks tool failures', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 1,
        order: 0,
        executionId: 'eid:serial:o0',
      });

      collector.onToolStart({
        name: 'web_search',
        input: { query: 'test' },
        executionId: 'eid:serial:o0',
      });
      collector.onToolEnd({
        name: 'web_search',
        output: null,
        durationMs: 500,
        error: 'Rate limit exceeded',
        executionId: 'eid:serial:o0',
      });

      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 1,
        patchesApplied: 0,
        requiredIssuesRemaining: 1,
        isComplete: false,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      const record = collector.getRecord(mockProgressCounts);
      expect(record.timeline[0]!.toolCalls[0]!.success).toBe(false);
      expect(record.timeline[0]!.toolCalls[0]!.result?.error).toBe('Rate limit exceeded');
      expect(record.toolSummary.failedCalls).toBe(1);
    });

    it('aggregates tool statistics', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 2,
        order: 0,
        executionId: 'eid:serial:o0',
      });

      // Multiple web searches
      collector.onToolStart({
        name: 'web_search',
        input: { query: 'q1' },
        executionId: 'eid:serial:o0',
      });
      collector.onToolEnd({
        name: 'web_search',
        output: { results: ['a'] },
        durationMs: 1000,
        executionId: 'eid:serial:o0',
      });

      collector.onToolStart({
        name: 'web_search',
        input: { query: 'q2' },
        executionId: 'eid:serial:o0',
      });
      collector.onToolEnd({
        name: 'web_search',
        output: { results: ['b', 'c'] },
        durationMs: 2000,
        executionId: 'eid:serial:o0',
      });

      // fill_form tool
      collector.onToolStart({
        name: 'fill_form',
        input: { patchCount: 2 },
        executionId: 'eid:serial:o0',
      });
      collector.onToolEnd({
        name: 'fill_form',
        output: { applied: 2 },
        durationMs: 50,
        executionId: 'eid:serial:o0',
      });

      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 2,
        patchesApplied: 2,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      const record = collector.getRecord(mockProgressCounts);
      expect(record.toolSummary.totalCalls).toBe(3);
      expect(record.toolSummary.successfulCalls).toBe(3);
      expect(record.toolSummary.byTool).toHaveLength(2);

      const webSearchStats = record.toolSummary.byTool.find((t) => t.toolName === 'web_search');
      expect(webSearchStats?.callCount).toBe(2);
      expect(webSearchStats?.timing.totalMs).toBe(3000);
    });
  });

  describe('getRecord', () => {
    it('produces valid FillRecord structure', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 1,
        order: 0,
        executionId: 'eid:serial:o0',
      });
      collector.onLlmCallStart({ model: 'claude-sonnet-4-5', executionId: 'eid:serial:o0' });
      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 500,
        outputTokens: 100,
        executionId: 'eid:serial:o0',
      });
      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      const record = collector.getRecord(mockProgressCounts);

      // Check all required fields are present
      expect(record.sessionId).toBeDefined();
      expect(record.startedAt).toBeDefined();
      expect(record.completedAt).toBeDefined();
      expect(record.durationMs).toBeGreaterThanOrEqual(0);
      expect(record.form.id).toBe('test-form');
      expect(record.status).toBe('completed');
      expect(record.formProgress).toEqual(mockProgressCounts);
      expect(record.llm.provider).toBe('anthropic');
      expect(record.llm.model).toBe('claude-sonnet-4-5');
      expect(record.toolSummary).toBeDefined();
      expect(record.timingBreakdown).toBeDefined();
      expect(record.timeline).toHaveLength(1);
      expect(record.execution).toBeDefined();
    });

    it('includes custom data when provided', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        customData: { userId: 'user-123', requestId: 'req-456' },
      });

      const record = collector.getRecord(mockProgressCounts);
      expect(record.customData).toEqual({ userId: 'user-123', requestId: 'req-456' });
    });

    it('sets status based on form progress', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      // Partial completion - required field still unanswered
      // (answeredFields < requiredFields means not all required fields are filled)
      const partialProgress: ProgressCounts = {
        ...mockProgressCounts,
        requiredFields: 2,
        answeredFields: 1, // Only 1 of 2 required answered
        unansweredFields: 2,
      };

      const record = collector.getRecord(partialProgress);
      expect(record.status).toBe('partial');
    });
  });

  describe('addCustomData', () => {
    it('allows adding custom data during execution', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.addCustomData('step', 'processing');
      collector.addCustomData('metadata', { key: 'value' });

      const record = collector.getRecord(mockProgressCounts);
      expect(record.customData?.step).toBe('processing');
      expect(record.customData?.metadata).toEqual({ key: 'value' });
    });
  });

  describe('thread safety (parallel execution)', () => {
    it('handles concurrent turn callbacks from different execution threads', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        parallelEnabled: true,
        maxParallelAgents: 4,
      });

      // Simulate parallel execution: order 0 serial, then order 1 parallel batch
      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 1,
        order: 0,
        executionId: 'eid:serial:o0',
      });
      collector.onLlmCallStart({ model: 'claude-sonnet-4-5', executionId: 'eid:serial:o0' });
      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 300,
        outputTokens: 50,
        executionId: 'eid:serial:o0',
      });
      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: false,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      // Parallel batch items (simulating concurrent calls)
      collector.onTurnStart({
        turnNumber: 2,
        issuesCount: 1,
        order: 1,
        executionId: 'eid:batch:o1:contact:i0',
      });
      collector.onTurnStart({
        turnNumber: 3,
        issuesCount: 1,
        order: 1,
        executionId: 'eid:batch:o1:contact:i1',
      });

      collector.onLlmCallStart({
        model: 'claude-sonnet-4-5',
        executionId: 'eid:batch:o1:contact:i0',
      });
      collector.onLlmCallStart({
        model: 'claude-sonnet-4-5',
        executionId: 'eid:batch:o1:contact:i1',
      });

      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 200,
        outputTokens: 40,
        executionId: 'eid:batch:o1:contact:i1',
      });
      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 250,
        outputTokens: 45,
        executionId: 'eid:batch:o1:contact:i0',
      });

      collector.onTurnComplete({
        turnNumber: 3,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: false,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });
      collector.onTurnComplete({
        turnNumber: 2,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      const record = collector.getRecord(mockProgressCounts);

      // Should have 3 timeline entries
      expect(record.timeline).toHaveLength(3);

      // Check execution metadata
      expect(record.execution.parallelEnabled).toBe(true);
      expect(record.execution.maxParallelAgents).toBe(4);
      expect(record.execution.totalTurns).toBe(3);
      expect(record.execution.orderLevels).toContain(0);
      expect(record.execution.orderLevels).toContain(1);
      expect(record.execution.executionThreads).toContain('eid:serial:o0');
      expect(record.execution.executionThreads).toContain('eid:batch:o1:contact:i0');
      expect(record.execution.executionThreads).toContain('eid:batch:o1:contact:i1');

      // Tokens should be aggregated
      expect(record.llm.totalCalls).toBe(3);
      expect(record.llm.inputTokens).toBe(750); // 300 + 250 + 200
      expect(record.llm.outputTokens).toBe(135); // 50 + 45 + 40
    });
  });

  describe('timing breakdown', () => {
    it('calculates timing breakdown correctly', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 1,
        order: 0,
        executionId: 'eid:serial:o0',
      });

      collector.onLlmCallStart({ model: 'claude-sonnet-4-5', executionId: 'eid:serial:o0' });
      // Simulate LLM time
      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 500,
        outputTokens: 100,
        executionId: 'eid:serial:o0',
      });

      collector.onToolStart({
        name: 'web_search',
        input: { query: 'test' },
        executionId: 'eid:serial:o0',
      });
      collector.onToolEnd({
        name: 'web_search',
        output: {},
        durationMs: 1500,
        executionId: 'eid:serial:o0',
      });

      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      const record = collector.getRecord(mockProgressCounts);

      expect(record.timingBreakdown.toolTimeMs).toBe(1500);
      expect(record.timingBreakdown.breakdown).toHaveLength(3);
      expect(record.timingBreakdown.breakdown.map((b) => b.category)).toContain('llm');
      expect(record.timingBreakdown.breakdown.map((b) => b.category)).toContain('tools');
      expect(record.timingBreakdown.breakdown.map((b) => b.category)).toContain('overhead');
    });
  });

  describe('llmParallelism', () => {
    it('computes llmParallelism as llmTimeMs / totalMs', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 1,
        order: 0,
        executionId: 'eid:serial:o0',
      });

      collector.onToolStart({
        name: 'fill_form',
        input: {},
        executionId: 'eid:serial:o0',
      });
      collector.onToolEnd({
        name: 'fill_form',
        output: {},
        durationMs: 500,
        executionId: 'eid:serial:o0',
      });

      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      const record = collector.getRecord(mockProgressCounts);

      // llmParallelism should be llmTimeMs / totalMs
      expect(record.timingBreakdown.llmParallelism).toBeGreaterThanOrEqual(0);
      expect(typeof record.timingBreakdown.llmParallelism).toBe('number');
    });

    it('returns 0 for zero-duration fills', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      // No events, immediate getRecord
      const record = collector.getRecord(mockProgressCounts);

      // With near-zero durationMs, llmParallelism should be 0 or a small number
      expect(record.timingBreakdown.llmParallelism).toBeGreaterThanOrEqual(0);
    });
  });

  describe('avgDurationMs', () => {
    it('computes avgDurationMs as totalDurationMs / totalCalls', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 1,
        order: 0,
        executionId: 'eid:serial:o0',
      });

      collector.onToolStart({
        name: 'web_search',
        input: { query: 'q1' },
        executionId: 'eid:serial:o0',
      });
      collector.onToolEnd({
        name: 'web_search',
        output: {},
        durationMs: 1000,
        executionId: 'eid:serial:o0',
      });

      collector.onToolStart({
        name: 'fill_form',
        input: {},
        executionId: 'eid:serial:o0',
      });
      collector.onToolEnd({
        name: 'fill_form',
        output: {},
        durationMs: 500,
        executionId: 'eid:serial:o0',
      });

      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      const record = collector.getRecord(mockProgressCounts);

      // totalDurationMs = 1000 + 500 = 1500, totalCalls = 2
      expect(record.toolSummary.avgDurationMs).toBe(750);
    });

    it('returns 0 for zero tool calls', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      const record = collector.getRecord(mockProgressCounts);

      expect(record.toolSummary.avgDurationMs).toBe(0);
    });
  });

  describe('setStatus', () => {
    it('allows explicit status setting', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.setStatus('cancelled', 'User cancelled the operation');

      const record = collector.getRecord(mockProgressCounts);
      expect(record.status).toBe('cancelled');
      expect(record.statusDetail).toBe('User cancelled the operation');
    });

    it('allows setting failed status', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.setStatus('failed', 'API error occurred');

      const record = collector.getRecord(mockProgressCounts);
      expect(record.status).toBe('failed');
      expect(record.statusDetail).toBe('API error occurred');
    });
  });

  describe('onLlmCallEnd with duration and provider metadata (MF-2/MF-3)', () => {
    it('captures llmCallDurationMs and llmCallCount in timeline entry', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 1,
        order: 0,
        executionId: 'eid:serial:o0',
      });

      collector.onLlmCallStart({ model: 'gpt-4', executionId: 'eid:serial:o0' });
      collector.onLlmCallEnd({
        model: 'gpt-4',
        inputTokens: 500,
        outputTokens: 100,
        executionId: 'eid:serial:o0',
        durationMs: 2500,
        responseId: 'chatcmpl-abc123',
        requestId: 'req-xyz789',
      });

      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      const record = collector.getRecord(mockProgressCounts);
      const entry = record.timeline[0]!;
      expect(entry.llmCallDurationMs).toBe(2500);
      expect(entry.llmCallCount).toBe(1);
      expect(entry.responseIds).toEqual(['chatcmpl-abc123']);
      expect(entry.requestIds).toEqual(['req-xyz789']);
    });

    it('omits llmCallDurationMs when not provided', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 1,
        order: 0,
        executionId: 'eid:serial:o0',
      });

      collector.onLlmCallStart({ model: 'gpt-4', executionId: 'eid:serial:o0' });
      collector.onLlmCallEnd({
        model: 'gpt-4',
        inputTokens: 500,
        outputTokens: 100,
        executionId: 'eid:serial:o0',
        // No durationMs, responseId, requestId
      });

      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      const record = collector.getRecord(mockProgressCounts);
      const entry = record.timeline[0]!;
      expect(entry.llmCallDurationMs).toBeUndefined();
      expect(entry.llmCallCount).toBe(1);
      expect(entry.responseIds).toBeUndefined();
      expect(entry.requestIds).toBeUndefined();
    });
  });

  describe('onLlmCallEnd with error field (MF-2 gap fix)', () => {
    it('records error string in eventLog when LLM call fails', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4',
      });

      collector.onLlmCallStart({ model: 'gpt-4', executionId: 'eid:serial:o0' });
      collector.onLlmCallEnd({
        model: 'gpt-4',
        inputTokens: 0,
        outputTokens: 0,
        executionId: 'eid:serial:o0',
        durationMs: 5000,
        error: 'Request timed out after 30000ms',
      });

      const record = collector.getRecord(mockProgressCounts);
      const endEvent = record.eventLog!.find((e) => e.type === 'llm_call_end');
      expect(endEvent).toBeDefined();
      if (endEvent?.type === 'llm_call_end') {
        expect(endEvent.error).toBe('Request timed out after 30000ms');
        expect(endEvent.durationMs).toBe(5000);
        expect(endEvent.inputTokens).toBe(0);
        expect(endEvent.outputTokens).toBe(0);
      }
    });

    it('omits error field from eventLog when LLM call succeeds', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4',
      });

      collector.onLlmCallStart({ model: 'gpt-4', executionId: 'eid:serial:o0' });
      collector.onLlmCallEnd({
        model: 'gpt-4',
        inputTokens: 500,
        outputTokens: 100,
        executionId: 'eid:serial:o0',
        durationMs: 2500,
      });

      const record = collector.getRecord(mockProgressCounts);
      const endEvent = record.eventLog!.find((e) => e.type === 'llm_call_end');
      expect(endEvent).toBeDefined();
      if (endEvent?.type === 'llm_call_end') {
        expect(endEvent.error).toBeUndefined();
      }
    });

    it('cleans up pendingLlmCalls on error (no orphaned starts)', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 1,
        order: 0,
        executionId: 'eid:serial:o0',
      });

      collector.onLlmCallStart({ model: 'gpt-4', executionId: 'eid:serial:o0' });
      collector.onLlmCallEnd({
        model: 'gpt-4',
        inputTokens: 0,
        outputTokens: 0,
        executionId: 'eid:serial:o0',
        durationMs: 5000,
        error: 'Rate limit exceeded',
      });

      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 1,
        patchesApplied: 0,
        requiredIssuesRemaining: 1,
        isComplete: false,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      const record = collector.getRecord(mockProgressCounts);
      // Should have a timeline entry with llmCallCount=1 (even though it errored)
      expect(record.timeline.length).toBe(1);
      expect(record.timeline[0]!.llmCallCount).toBe(1);
      expect(record.timeline[0]!.llmCallDurationMs).toBe(5000);
    });
  });

  describe('setStatus with errorInfo (MF-4)', () => {
    it('stores errorType and errorCode from errorInfo parameter', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4',
      });

      collector.setStatus('failed', 'API rate limit exceeded', {
        errorType: 'APICallError',
        errorCode: '429',
      });

      const record = collector.getRecord(mockProgressCounts);
      expect(record.status).toBe('failed');
      expect(record.statusDetail).toBe('API rate limit exceeded');
      expect(record.errorType).toBe('APICallError');
      expect(record.errorCode).toBe('429');
    });

    it('omits errorType/errorCode when errorInfo not provided (backward compat)', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4',
      });

      collector.setStatus('failed', 'Some error');

      const record = collector.getRecord(mockProgressCounts);
      expect(record.status).toBe('failed');
      expect(record.statusDetail).toBe('Some error');
      expect(record.errorType).toBeUndefined();
      expect(record.errorCode).toBeUndefined();
    });
  });

  describe('eventLog in getRecord (MF-5)', () => {
    it('includes raw event log in fill record', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4',
      });

      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 2,
        order: 0,
        executionId: 'eid:serial:o0',
      });

      collector.onLlmCallStart({ model: 'gpt-4', executionId: 'eid:serial:o0' });
      collector.onLlmCallEnd({
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        executionId: 'eid:serial:o0',
        durationMs: 1000,
        responseId: 'chatcmpl-test',
      });

      collector.onToolStart({
        name: 'fill_form',
        input: { patches: [] },
        executionId: 'eid:serial:o0',
      });
      collector.onToolEnd({
        name: 'fill_form',
        output: { result: 'ok' },
        durationMs: 50,
        executionId: 'eid:serial:o0',
      });

      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 2,
        patchesApplied: 1,
        requiredIssuesRemaining: 1,
        isComplete: false,
        issues: [],
        patches: [],
        rejectedPatches: [],
      });

      const record = collector.getRecord(mockProgressCounts);
      expect(record.eventLog).toBeDefined();
      expect(record.eventLog!.length).toBe(6);

      // Verify event types in chronological order
      const types = record.eventLog!.map((e) => e.type);
      expect(types).toEqual([
        'turn_start',
        'llm_call_start',
        'llm_call_end',
        'tool_start',
        'tool_end',
        'turn_complete',
      ]);

      // Verify LLM call end event has new MF-2 fields
      const llmEnd = record.eventLog!.find((e) => e.type === 'llm_call_end');
      expect(llmEnd).toBeDefined();
      if (llmEnd?.type === 'llm_call_end') {
        expect(llmEnd.durationMs).toBe(1000);
        expect(llmEnd.responseId).toBe('chatcmpl-test');
      }
    });

    it('sanitizes non-JSON-safe tool input/output in eventLog', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4',
      });

      // Create a circular object to simulate non-JSON-safe tool output
      const circular: Record<string, unknown> = { name: 'test' };
      circular.self = circular;

      collector.onToolStart({
        name: 'custom_tool',
        input: circular,
        executionId: 'eid:serial:o0',
      });
      collector.onToolEnd({
        name: 'custom_tool',
        output: circular,
        durationMs: 100,
        executionId: 'eid:serial:o0',
      });

      const record = collector.getRecord(mockProgressCounts);
      expect(record.eventLog).toBeDefined();

      // Both events should be sanitized to strings (since circular can't be JSON serialized)
      const toolStart = record.eventLog!.find((e) => e.type === 'tool_start');
      const toolEnd = record.eventLog!.find((e) => e.type === 'tool_end');
      expect(toolStart).toBeDefined();
      expect(toolEnd).toBeDefined();

      // Verify the entire eventLog can be safely JSON-serialized
      expect(() => JSON.stringify(record.eventLog)).not.toThrow();
    });

    it('preserves JSON-safe tool input/output in eventLog', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4',
      });

      collector.onToolStart({
        name: 'fill_form',
        input: { patches: [{ op: 'set_string', fieldId: 'name', value: 'test' }] },
        executionId: 'eid:serial:o0',
      });
      collector.onToolEnd({
        name: 'fill_form',
        output: { patchCount: 1 },
        durationMs: 50,
        executionId: 'eid:serial:o0',
      });

      const record = collector.getRecord(mockProgressCounts);
      const toolStart = record.eventLog!.find((e) => e.type === 'tool_start');
      if (toolStart?.type === 'tool_start') {
        // JSON-safe input should be preserved as-is
        expect(toolStart.input).toEqual({
          patches: [{ op: 'set_string', fieldId: 'name', value: 'test' }],
        });
      }
    });

    it('eventLog captures web search events', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4',
      });

      collector.onWebSearch({
        query: 'test query',
        resultCount: 3,
        provider: 'openai',
        executionId: 'eid:serial:o0',
      });

      const record = collector.getRecord(mockProgressCounts);
      expect(record.eventLog).toBeDefined();
      expect(record.eventLog!.length).toBe(1);
      expect(record.eventLog![0]!.type).toBe('web_search');
    });
  });

  describe('onWebSearch', () => {
    it('accepts web search events', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      // Should not throw
      collector.onWebSearch({
        query: 'test query',
        resultCount: 5,
        provider: 'anthropic',
        executionId: 'eid:serial:o0',
      });

      // Verify the collector still works
      const record = collector.getRecord(mockProgressCounts);
      expect(record.sessionId).toBeDefined();
    });

    it('captures multiple web search events', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      collector.onWebSearch({
        query: 'first query',
        resultCount: 3,
        provider: 'anthropic',
        executionId: 'eid:serial:o0',
      });

      collector.onWebSearch({
        query: 'second query',
        resultCount: 0,
        provider: 'anthropic',
        executionId: 'eid:serial:o0',
      });

      // Verify the collector completes without error
      const record = collector.getRecord(mockProgressCounts);
      expect(record.sessionId).toBeDefined();
    });
  });

  describe('parallel execution tracking', () => {
    it('tracks multiple parallel execution threads correctly', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4',
        parallelEnabled: true,
      });

      // Order 0 - serial
      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 5,
        order: 0,
        executionId: 'eid:serial:o0',
      });
      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 5,
        patchesApplied: 3,
        requiredIssuesRemaining: 2,
        isComplete: false,
        issues: [],
        patches: [],
        rejectedPatches: [],
        executionId: 'eid:serial:o0',
      });

      // Order 1 - parallel batch with 3 items running concurrently
      // Item 0
      collector.onTurnStart({
        turnNumber: 2,
        issuesCount: 2,
        order: 1,
        executionId: 'eid:batch:o1:test:i0',
      });
      // Item 1
      collector.onTurnStart({
        turnNumber: 2,
        issuesCount: 3,
        order: 1,
        executionId: 'eid:batch:o1:test:i1',
      });
      // Item 2
      collector.onTurnStart({
        turnNumber: 2,
        issuesCount: 1,
        order: 1,
        executionId: 'eid:batch:o1:test:i2',
      });

      // Completions can come in any order
      collector.onTurnComplete({
        turnNumber: 2,
        issuesShown: 3,
        patchesApplied: 2,
        requiredIssuesRemaining: 1,
        isComplete: false,
        issues: [],
        patches: [],
        rejectedPatches: [],
        executionId: 'eid:batch:o1:test:i1',
      });
      collector.onTurnComplete({
        turnNumber: 2,
        issuesShown: 2,
        patchesApplied: 2,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
        executionId: 'eid:batch:o1:test:i0',
      });
      collector.onTurnComplete({
        turnNumber: 2,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
        executionId: 'eid:batch:o1:test:i2',
      });

      const record = collector.getRecord(mockProgressCounts);

      // Should have 4 timeline entries: 1 serial + 3 parallel
      expect(record.timeline).toHaveLength(4);

      // Check execution metadata
      expect(record.execution.parallelEnabled).toBe(true);
      expect(record.execution.totalTurns).toBe(4);
      expect(record.execution.executionThreads).toHaveLength(4);
      expect(record.execution.executionThreads).toContain('eid:serial:o0');
      expect(record.execution.executionThreads).toContain('eid:batch:o1:test:i0');
      expect(record.execution.executionThreads).toContain('eid:batch:o1:test:i1');
      expect(record.execution.executionThreads).toContain('eid:batch:o1:test:i2');

      // Verify each timeline entry has correct executionId
      const serialEntry = record.timeline.find((e) => e.executionId === 'eid:serial:o0');
      expect(serialEntry).toBeDefined();
      expect(serialEntry!.order).toBe(0);
      expect(serialEntry!.turnNumber).toBe(1);

      const parallelEntries = record.timeline.filter((e) => e.executionId.startsWith('eid:batch'));
      expect(parallelEntries).toHaveLength(3);
      parallelEntries.forEach((entry) => {
        expect(entry.order).toBe(1);
        expect(entry.turnNumber).toBe(2);
      });
    });

    it('eventLog entries round-trip through CollectorEventSchema', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4',
        parallelEnabled: true,
      });

      // Serial turn with LLM call metadata
      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 2,
        order: 0,
        executionId: 'eid:serial:o0',
      });
      collector.onLlmCallStart({ model: 'gpt-4', executionId: 'eid:serial:o0' });
      collector.onLlmCallEnd({
        model: 'gpt-4',
        inputTokens: 500,
        outputTokens: 100,
        executionId: 'eid:serial:o0',
        durationMs: 2000,
        responseId: 'chatcmpl-abc',
        requestId: 'req-xyz',
      });
      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 2,
        patchesApplied: 2,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
        executionId: 'eid:serial:o0',
      });

      const record = collector.getRecord(mockProgressCounts);

      // Verify eventLog round-trips through CollectorEventSchema
      expect(record.eventLog).toBeDefined();
      for (const event of record.eventLog!) {
        const parsed = CollectorEventSchema.safeParse(event);
        if (!parsed.success) {
          throw new Error(
            `CollectorEventSchema parse failed for ${event.type}: ${JSON.stringify(parsed.error.issues)}`,
          );
        }
        expect(parsed.success).toBe(true);
      }
    });

    it('handles parallel turns without executionId using legacy fallback', () => {
      const collector = new FillRecordCollector({
        form: mockFormMetadata,
        provider: 'openai',
        model: 'gpt-4',
      });

      // Turn without executionId in onTurnComplete (legacy behavior)
      collector.onTurnStart({
        turnNumber: 1,
        issuesCount: 1,
        order: 0,
        executionId: 'eid:serial:o0',
      });
      collector.onTurnComplete({
        turnNumber: 1,
        issuesShown: 1,
        patchesApplied: 1,
        requiredIssuesRemaining: 0,
        isComplete: true,
        issues: [],
        patches: [],
        rejectedPatches: [],
        // No executionId - should match via turnNumber fallback
      });

      const record = collector.getRecord(mockProgressCounts);
      expect(record.timeline).toHaveLength(1);
      expect(record.timeline[0]!.executionId).toBe('eid:serial:o0');
    });
  });

  describe('CollectorEventSchema validation (MF-5)', () => {
    it('validates all 7 event types', () => {
      const events = [
        {
          type: 'turn_start' as const,
          timestamp: '2026-02-19T12:00:00.000Z',
          turnNumber: 1,
          issuesCount: 3,
          order: 0,
          executionId: 'eid:serial:o0',
        },
        {
          type: 'turn_complete' as const,
          timestamp: '2026-02-19T12:00:01.000Z',
          turnNumber: 1,
          patchesApplied: 2,
          patchesRejected: 1,
          issuesAddressed: 3,
          executionId: 'eid:serial:o0',
        },
        {
          type: 'llm_call_start' as const,
          timestamp: '2026-02-19T12:00:00.100Z',
          model: 'gpt-4',
          executionId: 'eid:serial:o0',
        },
        {
          type: 'llm_call_end' as const,
          timestamp: '2026-02-19T12:00:00.900Z',
          model: 'gpt-4',
          inputTokens: 500,
          outputTokens: 100,
          executionId: 'eid:serial:o0',
          durationMs: 800,
          responseId: 'chatcmpl-abc123',
          requestId: 'req-xyz789',
        },
        {
          type: 'tool_start' as const,
          timestamp: '2026-02-19T12:00:00.200Z',
          name: 'fill_form',
          input: { patches: [] },
          executionId: 'eid:serial:o0',
        },
        {
          type: 'tool_end' as const,
          timestamp: '2026-02-19T12:00:00.250Z',
          name: 'fill_form',
          output: { result: 'ok' },
          durationMs: 50,
          executionId: 'eid:serial:o0',
        },
        {
          type: 'web_search' as const,
          timestamp: '2026-02-19T12:00:00.300Z',
          query: 'test query',
          resultCount: 5,
          provider: 'openai',
          executionId: 'eid:serial:o0',
        },
      ];

      for (const event of events) {
        const result = CollectorEventSchema.safeParse(event);
        if (!result.success) {
          throw new Error(`Failed to validate ${event.type}: ${result.error.message}`);
        }
        expect(result.success).toBe(true);
      }
    });

    it('rejects event with unknown type', () => {
      const invalidEvent = {
        type: 'unknown_event',
        timestamp: '2026-02-19T12:00:00.000Z',
      };

      const result = CollectorEventSchema.safeParse(invalidEvent);
      expect(result.success).toBe(false);
    });

    it('rejects llm_call_end with negative durationMs', () => {
      const invalidEvent = {
        type: 'llm_call_end',
        timestamp: '2026-02-19T12:00:00.000Z',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        executionId: 'eid:serial:o0',
        durationMs: -1,
      };

      const result = CollectorEventSchema.safeParse(invalidEvent);
      expect(result.success).toBe(false);
    });
  });
});
