/**
 * Tests for FillRecordCollector - thread-safe, append-only collector for fill records.
 */

import { describe, it, expect } from 'vitest';

import { FillRecordCollector } from '../../../src/harness/fillRecordCollector.js';
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
        executionId: '0-serial',
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
        executionId: '0-serial',
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
        executionId: '0-serial',
      });

      collector.onLlmCallStart({ model: 'claude-sonnet-4-5', executionId: '0-serial' });
      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 500,
        outputTokens: 100,
        executionId: '0-serial',
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
      collector.onTurnStart({ turnNumber: 1, issuesCount: 2, order: 0, executionId: '0-serial' });
      collector.onLlmCallStart({ model: 'claude-sonnet-4-5', executionId: '0-serial' });
      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 500,
        outputTokens: 100,
        executionId: '0-serial',
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
      collector.onTurnStart({ turnNumber: 2, issuesCount: 1, order: 0, executionId: '0-serial' });
      collector.onLlmCallStart({ model: 'claude-sonnet-4-5', executionId: '0-serial' });
      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 600,
        outputTokens: 150,
        executionId: '0-serial',
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

      collector.onTurnStart({ turnNumber: 1, issuesCount: 1, order: 0, executionId: '0-serial' });

      collector.onToolStart({
        name: 'web_search',
        input: { query: 'test query' },
        executionId: '0-serial',
      });
      collector.onToolEnd({
        name: 'web_search',
        output: { results: ['a', 'b'] },
        durationMs: 1500,
        executionId: '0-serial',
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

      collector.onTurnStart({ turnNumber: 1, issuesCount: 1, order: 0, executionId: '0-serial' });

      collector.onToolStart({
        name: 'web_search',
        input: { query: 'test' },
        executionId: '0-serial',
      });
      collector.onToolEnd({
        name: 'web_search',
        output: null,
        durationMs: 500,
        error: 'Rate limit exceeded',
        executionId: '0-serial',
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

      collector.onTurnStart({ turnNumber: 1, issuesCount: 2, order: 0, executionId: '0-serial' });

      // Multiple web searches
      collector.onToolStart({
        name: 'web_search',
        input: { query: 'q1' },
        executionId: '0-serial',
      });
      collector.onToolEnd({
        name: 'web_search',
        output: { results: ['a'] },
        durationMs: 1000,
        executionId: '0-serial',
      });

      collector.onToolStart({
        name: 'web_search',
        input: { query: 'q2' },
        executionId: '0-serial',
      });
      collector.onToolEnd({
        name: 'web_search',
        output: { results: ['b', 'c'] },
        durationMs: 2000,
        executionId: '0-serial',
      });

      // fill_form tool
      collector.onToolStart({
        name: 'fill_form',
        input: { patchCount: 2 },
        executionId: '0-serial',
      });
      collector.onToolEnd({
        name: 'fill_form',
        output: { applied: 2 },
        durationMs: 50,
        executionId: '0-serial',
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

      collector.onTurnStart({ turnNumber: 1, issuesCount: 1, order: 0, executionId: '0-serial' });
      collector.onLlmCallStart({ model: 'claude-sonnet-4-5', executionId: '0-serial' });
      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 500,
        outputTokens: 100,
        executionId: '0-serial',
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
      collector.onTurnStart({ turnNumber: 1, issuesCount: 1, order: 0, executionId: '0-serial' });
      collector.onLlmCallStart({ model: 'claude-sonnet-4-5', executionId: '0-serial' });
      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 300,
        outputTokens: 50,
        executionId: '0-serial',
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
        executionId: '1-batch-contact-0',
      });
      collector.onTurnStart({
        turnNumber: 3,
        issuesCount: 1,
        order: 1,
        executionId: '1-batch-contact-1',
      });

      collector.onLlmCallStart({ model: 'claude-sonnet-4-5', executionId: '1-batch-contact-0' });
      collector.onLlmCallStart({ model: 'claude-sonnet-4-5', executionId: '1-batch-contact-1' });

      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 200,
        outputTokens: 40,
        executionId: '1-batch-contact-1',
      });
      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 250,
        outputTokens: 45,
        executionId: '1-batch-contact-0',
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
      expect(record.execution.executionThreads).toContain('0-serial');
      expect(record.execution.executionThreads).toContain('1-batch-contact-0');
      expect(record.execution.executionThreads).toContain('1-batch-contact-1');

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

      collector.onTurnStart({ turnNumber: 1, issuesCount: 1, order: 0, executionId: '0-serial' });

      collector.onLlmCallStart({ model: 'claude-sonnet-4-5', executionId: '0-serial' });
      // Simulate LLM time
      collector.onLlmCallEnd({
        model: 'claude-sonnet-4-5',
        inputTokens: 500,
        outputTokens: 100,
        executionId: '0-serial',
      });

      collector.onToolStart({
        name: 'web_search',
        input: { query: 'test' },
        executionId: '0-serial',
      });
      collector.onToolEnd({
        name: 'web_search',
        output: {},
        durationMs: 1500,
        executionId: '0-serial',
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
});
