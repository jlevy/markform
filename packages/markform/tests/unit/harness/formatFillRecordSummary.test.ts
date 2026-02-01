/**
 * Tests for formatFillRecordSummary function.
 */

import { describe, it, expect } from 'vitest';
import { formatFillRecordSummary } from '../../../src/harness/formatFillRecordSummary.js';
import type { FillRecord } from '../../../src/harness/fillRecord.js';

/**
 * Create a minimal FillRecord for testing.
 */
function createTestRecord(overrides: Partial<FillRecord> = {}): FillRecord {
  const defaults: FillRecord = {
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    startedAt: '2026-01-29T12:00:00.000Z',
    completedAt: '2026-01-29T12:00:12.400Z',
    durationMs: 12400,
    status: 'completed',
    form: {
      id: 'test_form',
      title: 'Test Form',
      structure: {
        fieldCount: 20,
        groupCount: 5,
        optionCount: 0,
        fieldCountByKind: {
          string: 10,
          number: 2,
          string_list: 0,
          checkboxes: 0,
          single_select: 2,
          multi_select: 0,
          url: 2,
          url_list: 0,
          date: 2,
          year: 2,
          table: 0,
        },
        groupsById: {},
        fieldsById: {},
        optionsById: {},
      },
    },
    llm: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      totalCalls: 5,
      inputTokens: 2450,
      outputTokens: 890,
    },
    toolSummary: {
      totalCalls: 12,
      successfulCalls: 11,
      failedCalls: 1,
      successRate: 91.7,
      totalDurationMs: 5100,
      byTool: [
        {
          toolName: 'web_search',
          callCount: 5,
          successCount: 5,
          failureCount: 0,
          successRate: 100,
          timing: {
            totalMs: 6000,
            avgMs: 1200,
            minMs: 800,
            maxMs: 2100,
            p50Ms: 1100,
            p95Ms: 2100,
          },
        },
        {
          toolName: 'fill_form',
          callCount: 7,
          successCount: 6,
          failureCount: 1,
          successRate: 85.7,
          timing: {
            totalMs: 315,
            avgMs: 45,
            minMs: 30,
            maxMs: 80,
            p50Ms: 40,
            p95Ms: 80,
          },
        },
      ],
    },
    timingBreakdown: {
      totalMs: 12400,
      llmTimeMs: 6820,
      toolTimeMs: 5100,
      overheadMs: 480,
      breakdown: [
        { category: 'llm', label: 'LLM', ms: 6820, percentage: 55 },
        { category: 'tools', label: 'Tools', ms: 5100, percentage: 41 },
        { category: 'overhead', label: 'Overhead', ms: 480, percentage: 4 },
      ],
    },
    formProgress: {
      totalFields: 20,
      requiredFields: 18,
      unansweredFields: 2,
      answeredFields: 18,
      skippedFields: 0,
      abortedFields: 0,
      validFields: 18,
      invalidFields: 0,
      emptyFields: 2,
      filledFields: 18,
      emptyRequiredFields: 0,
      totalNotes: 0,
    },
    execution: {
      totalTurns: 5,
      parallelEnabled: false,
      orderLevels: [0],
      executionThreads: ['main'],
    },
    timeline: [],
  };

  return { ...defaults, ...overrides };
}

describe('formatFillRecordSummary', () => {
  it('formats a basic summary correctly', () => {
    const record = createTestRecord();
    const summary = formatFillRecordSummary(record);

    // Should contain key sections
    expect(summary).toContain('Fill completed');
    expect(summary).toContain('12.4s');
    expect(summary).toContain('5 turns');
    expect(summary).toContain('Tokens');
    expect(summary).toContain('Tools');
    expect(summary).toContain('Progress');
  });

  it('shows token counts with provider/model', () => {
    const record = createTestRecord();
    const summary = formatFillRecordSummary(record);

    expect(summary).toContain('2,450');
    expect(summary).toContain('890');
    expect(summary).toContain('anthropic/claude-sonnet-4-5');
  });

  it('shows tool summary', () => {
    const record = createTestRecord();
    const summary = formatFillRecordSummary(record);

    expect(summary).toContain('12 calls');
    expect(summary).toContain('11 succeeded');
    expect(summary).toContain('1 failed');
  });

  it('shows progress percentage', () => {
    const record = createTestRecord();
    const summary = formatFillRecordSummary(record);

    expect(summary).toContain('18/20');
    expect(summary).toContain('90%');
  });

  it('handles partial status', () => {
    const record = createTestRecord({
      status: 'partial',
      statusDetail: 'max_turns',
    });
    const summary = formatFillRecordSummary(record);

    expect(summary).toContain('Fill incomplete');
    expect(summary).toContain('max_turns');
  });

  it('handles zero tool calls', () => {
    const record = createTestRecord({
      toolSummary: {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        successRate: 0,
        totalDurationMs: 0,
        byTool: [],
      },
    });
    const summary = formatFillRecordSummary(record);

    expect(summary).toContain('0 calls');
  });

  it('verbose mode shows timing breakdown', () => {
    const record = createTestRecord();
    const summary = formatFillRecordSummary(record, { verbose: true });

    expect(summary).toContain('Timing');
    expect(summary).toContain('55%');
    expect(summary).toContain('LLM');
    expect(summary).toContain('41%');
    expect(summary).toContain('tools');
  });

  it('verbose mode shows per-tool stats', () => {
    const record = createTestRecord();
    const summary = formatFillRecordSummary(record, { verbose: true });

    expect(summary).toContain('web_search');
    expect(summary).toContain('fill_form');
  });

  it('formats sub-second durations as milliseconds', () => {
    const record = createTestRecord({ durationMs: 500 });
    const summary = formatFillRecordSummary(record);

    expect(summary).toContain('500ms');
  });

  it('formats seconds with one decimal place', () => {
    const record = createTestRecord({ durationMs: 5500 });
    const summary = formatFillRecordSummary(record);

    expect(summary).toContain('5.5s');
  });

  it('handles 100% completion', () => {
    const record = createTestRecord({
      formProgress: {
        totalFields: 20,
        requiredFields: 20,
        unansweredFields: 0,
        answeredFields: 20,
        skippedFields: 0,
        abortedFields: 0,
        validFields: 20,
        invalidFields: 0,
        emptyFields: 0,
        filledFields: 20,
        emptyRequiredFields: 0,
        totalNotes: 0,
      },
    });
    const summary = formatFillRecordSummary(record);

    expect(summary).toContain('20/20');
    expect(summary).toContain('100%');
  });

  it('handles 0% completion', () => {
    const record = createTestRecord({
      formProgress: {
        totalFields: 20,
        requiredFields: 20,
        unansweredFields: 20,
        answeredFields: 0,
        skippedFields: 0,
        abortedFields: 0,
        validFields: 0,
        invalidFields: 0,
        emptyFields: 20,
        filledFields: 0,
        emptyRequiredFields: 20,
        totalNotes: 0,
      },
    });
    const summary = formatFillRecordSummary(record);

    expect(summary).toContain('0/20');
    expect(summary).toContain('0%');
  });

  describe('empty timeline warnings', () => {
    it('warns when timeline is empty but totalTurns > 0', () => {
      // This indicates callback wiring bug - turn callbacks not firing
      const record = createTestRecord({
        timeline: [],
        execution: {
          totalTurns: 3,
          parallelEnabled: false,
          orderLevels: [0],
          executionThreads: ['cli-serial'],
        },
      });
      const summary = formatFillRecordSummary(record);

      expect(summary).toContain('Warning:');
      expect(summary).toContain('timeline is empty');
    });

    it('warns when timeline is empty but fields were filled', () => {
      // This indicates callback wiring bug - fields got filled but no timeline
      const record = createTestRecord({
        timeline: [],
        execution: {
          totalTurns: 0,
          parallelEnabled: false,
          orderLevels: [0],
          executionThreads: ['cli-serial'],
        },
        formProgress: {
          totalFields: 10,
          requiredFields: 10,
          unansweredFields: 0,
          answeredFields: 10,
          skippedFields: 0,
          abortedFields: 0,
          validFields: 10,
          invalidFields: 0,
          emptyFields: 0,
          filledFields: 10,
          emptyRequiredFields: 0,
          totalNotes: 0,
        },
      });
      const summary = formatFillRecordSummary(record);

      expect(summary).toContain('Warning:');
      expect(summary).toContain('timeline is empty');
    });

    it('does NOT warn when timeline is empty and no fields filled (empty form)', () => {
      // This is expected - no work was done
      const record = createTestRecord({
        timeline: [],
        execution: {
          totalTurns: 0,
          parallelEnabled: false,
          orderLevels: [0],
          executionThreads: ['cli-serial'],
        },
        formProgress: {
          totalFields: 10,
          requiredFields: 10,
          unansweredFields: 10,
          answeredFields: 0,
          skippedFields: 0,
          abortedFields: 0,
          validFields: 0,
          invalidFields: 0,
          emptyFields: 10,
          filledFields: 0,
          emptyRequiredFields: 10,
          totalNotes: 0,
        },
      });
      const summary = formatFillRecordSummary(record);

      expect(summary).not.toContain('Warning:');
      expect(summary).not.toContain('timeline is empty');
    });

    it('does NOT warn when timeline has entries', () => {
      // Normal case - timeline has data
      const record = createTestRecord({
        timeline: [
          {
            turnNumber: 1,
            order: 0,
            executionId: 'cli-serial',
            startedAt: '2026-01-29T12:00:00.000Z',
            completedAt: '2026-01-29T12:00:01.000Z',
            durationMs: 1000,
            issuesAddressed: 5,
            patchesApplied: 5,
            patchesRejected: 0,
            tokens: { input: 1000, output: 200 },
            toolCalls: [],
          },
        ],
        execution: {
          totalTurns: 1,
          parallelEnabled: false,
          orderLevels: [0],
          executionThreads: ['cli-serial'],
        },
      });
      const summary = formatFillRecordSummary(record);

      expect(summary).not.toContain('Warning:');
      expect(summary).not.toContain('timeline is empty');
    });
  });
});
