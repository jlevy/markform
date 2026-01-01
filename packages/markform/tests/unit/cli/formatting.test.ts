/**
 * Unit tests for CLI formatting utilities.
 *
 * Tests pure formatting functions used for CLI output.
 */

import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatTiming,
  formatCount,
  formatState,
  formatPriority,
  issueReasonToStatus,
  formatIssueBrief,
  formatIssuesSummary,
  formatTurnIssues,
  formatFormLabel,
  formatFormHint,
  formatFormLogLine,
  colors,
} from '../../../src/cli/lib/formatting.js';
import type { InspectIssue } from '../../../src/engine/coreTypes.js';
import type { FormDisplayInfo } from '../../../src/cli/lib/cliTypes.js';

describe('formatting', () => {
  describe('colors', () => {
    it('applies success color', () => {
      const result = colors.success('ok');
      // eslint-disable-next-line no-control-regex
      expect(result.replace(/\x1b\[[0-9;]*m/g, '')).toBe('ok');
    });

    it('applies error color', () => {
      const result = colors.error('fail');
      // eslint-disable-next-line no-control-regex
      expect(result.replace(/\x1b\[[0-9;]*m/g, '')).toBe('fail');
    });

    it('applies warn color', () => {
      const result = colors.warn('warning');
      // eslint-disable-next-line no-control-regex
      expect(result.replace(/\x1b\[[0-9;]*m/g, '')).toBe('warning');
    });

    it('applies info color', () => {
      const result = colors.info('info');
      // eslint-disable-next-line no-control-regex
      expect(result.replace(/\x1b\[[0-9;]*m/g, '')).toBe('info');
    });

    it('applies dim color', () => {
      const result = colors.dim('faded');
      // eslint-disable-next-line no-control-regex
      expect(result.replace(/\x1b\[[0-9;]*m/g, '')).toBe('faded');
    });

    it('applies bold style', () => {
      const result = colors.bold('strong');
      // eslint-disable-next-line no-control-regex
      expect(result.replace(/\x1b\[[0-9;]*m/g, '')).toBe('strong');
    });

    it('applies title style', () => {
      const result = colors.title('heading');
      // eslint-disable-next-line no-control-regex
      expect(result.replace(/\x1b\[[0-9;]*m/g, '')).toBe('heading');
    });
  });

  describe('formatDuration', () => {
    const cases = [
      { input: 0, expected: '0.0s' },
      { input: 100, expected: '0.1s' },
      { input: 500, expected: '0.5s' },
      { input: 1000, expected: '1.0s' },
      { input: 1500, expected: '1.5s' },
      { input: 12345, expected: '12.3s' },
      { input: 60000, expected: '60.0s' },
    ];

    it.each(cases)('formats $input ms as $expected', ({ input, expected }) => {
      expect(formatDuration(input)).toBe(expected);
    });
  });

  describe('formatTiming', () => {
    it('formats timing with label and duration', () => {
      const result = formatTiming('Processing', 1500);
      // Strip ANSI codes for comparison
      // eslint-disable-next-line no-control-regex
      expect(result.replace(/\x1b\[[0-9;]*m/g, '')).toBe('⏰ Processing: 1.5s');
    });

    it('formats timing with zero duration', () => {
      const result = formatTiming('Init', 0);
      // eslint-disable-next-line no-control-regex
      expect(result.replace(/\x1b\[[0-9;]*m/g, '')).toBe('⏰ Init: 0.0s');
    });
  });

  describe('formatCount', () => {
    const cases = [
      { count: 0, label: 'item', expected: '0 items' },
      { count: 1, label: 'item', expected: '1 item' },
      { count: 2, label: 'item', expected: '2 items' },
      { count: 10, label: 'field', expected: '10 fields' },
      { count: 1, label: 'issue', expected: '1 issue' },
      { count: 5, label: 'patch', expected: '5 patchs' }, // Note: naive pluralization
    ];

    it.each(cases)('formats $count $label correctly', ({ count, label, expected }) => {
      expect(formatCount(count, label)).toBe(expected);
    });
  });

  describe('formatState', () => {
    const cases = [
      { state: 'complete', contains: 'complete' },
      { state: 'incomplete', contains: 'incomplete' },
      { state: 'empty', contains: 'empty' },
      { state: 'invalid', contains: 'invalid' },
      { state: 'unknown', contains: 'unknown' }, // passthrough
    ];

    it.each(cases)('formats "$state" state', ({ state, contains }) => {
      const result = formatState(state);
      // Strip ANSI codes for comparison
      // eslint-disable-next-line no-control-regex
      expect(result.replace(/\x1b\[[0-9;]*m/g, '')).toContain(contains);
    });
  });

  describe('formatPriority', () => {
    const cases = [
      { priority: 1, expected: 'P1' },
      { priority: 2, expected: 'P2' },
      { priority: 3, expected: 'P3' },
      { priority: 4, expected: 'P4' },
      { priority: 5, expected: 'P5' },
      { priority: 6, expected: 'P6' }, // default case
    ];

    it.each(cases)('formats priority $priority as $expected', ({ priority, expected }) => {
      const result = formatPriority(priority);
      // Strip ANSI codes for comparison
      // eslint-disable-next-line no-control-regex
      expect(result.replace(/\x1b\[[0-9;]*m/g, '')).toBe(expected);
    });
  });

  describe('issueReasonToStatus', () => {
    const cases = [
      { reason: 'required_missing' as const, expected: 'missing' },
      { reason: 'validation_error' as const, expected: 'invalid' },
      { reason: 'checkbox_incomplete' as const, expected: 'incomplete' },
      { reason: 'min_items_not_met' as const, expected: 'too-few' },
      { reason: 'optional_unanswered' as const, expected: 'unanswered' },
    ];

    it.each(cases)('converts "$reason" to "$expected"', ({ reason, expected }) => {
      expect(issueReasonToStatus(reason)).toBe(expected);
    });
  });

  describe('formatIssueBrief', () => {
    it('formats issue as "fieldId (status)"', () => {
      const issue: InspectIssue = {
        ref: 'company_name',
        scope: 'field',
        reason: 'required_missing',
        message: 'Required field is empty',
        severity: 'required',
        priority: 1,
      };
      expect(formatIssueBrief(issue)).toBe('company_name (missing)');
    });

    it('formats various issue reasons', () => {
      const validationIssue: InspectIssue = {
        ref: 'age',
        scope: 'field',
        reason: 'validation_error',
        message: 'Invalid value',
        severity: 'required',
        priority: 2,
      };
      expect(formatIssueBrief(validationIssue)).toBe('age (invalid)');
    });
  });

  describe('formatIssuesSummary', () => {
    it('formats empty issues list', () => {
      expect(formatIssuesSummary([])).toBe('');
    });

    it('formats single issue', () => {
      const issues: InspectIssue[] = [
        {
          ref: 'name',
          scope: 'field',
          reason: 'required_missing',
          message: 'Test',
          severity: 'required',
          priority: 1,
        },
      ];
      expect(formatIssuesSummary(issues)).toBe('name (missing)');
    });

    it('formats multiple issues as comma-separated list', () => {
      const issues: InspectIssue[] = [
        {
          ref: 'name',
          scope: 'field',
          reason: 'required_missing',
          message: 'Test',
          severity: 'required',
          priority: 1,
        },
        {
          ref: 'age',
          scope: 'field',
          reason: 'validation_error',
          message: 'Test',
          severity: 'required',
          priority: 2,
        },
        {
          ref: 'tasks',
          scope: 'field',
          reason: 'checkbox_incomplete',
          message: 'Test',
          severity: 'recommended',
          priority: 3,
        },
      ];
      expect(formatIssuesSummary(issues)).toBe('name (missing), age (invalid), tasks (incomplete)');
    });
  });

  describe('formatTurnIssues', () => {
    it('formats zero issues', () => {
      expect(formatTurnIssues([])).toBe('0 issues');
    });

    it('formats issues with count and brief list', () => {
      const issues: InspectIssue[] = [
        {
          ref: 'name',
          scope: 'field',
          reason: 'required_missing',
          message: 'Test',
          severity: 'required',
          priority: 1,
        },
        {
          ref: 'age',
          scope: 'field',
          reason: 'validation_error',
          message: 'Test',
          severity: 'required',
          priority: 2,
        },
      ];
      expect(formatTurnIssues(issues)).toBe('2 issue(s): name (missing), age (invalid)');
    });

    it('truncates with "+N more" when exceeding maxShow', () => {
      const issues: InspectIssue[] = Array.from({ length: 8 }, (_, i) => ({
        ref: `field${i}`,
        scope: 'field' as const,
        reason: 'required_missing' as const,
        message: 'Test',
        severity: 'required' as const,
        priority: 1,
      }));

      const result = formatTurnIssues(issues, 5);
      expect(result).toContain('8 issue(s):');
      expect(result).toContain('+3 more');
    });

    it('respects custom maxShow parameter', () => {
      const issues: InspectIssue[] = Array.from({ length: 5 }, (_, i) => ({
        ref: `field${i}`,
        scope: 'field' as const,
        reason: 'required_missing' as const,
        message: 'Test',
        severity: 'required' as const,
        priority: 1,
      }));

      const result = formatTurnIssues(issues, 2);
      expect(result).toContain('5 issue(s):');
      expect(result).toContain('+3 more');
    });
  });

  describe('formatFormLabel', () => {
    it('formats filename only', () => {
      const info: FormDisplayInfo = { filename: 'test.form.md' };
      expect(formatFormLabel(info)).toBe('test.form.md');
    });

    it('formats filename with title', () => {
      const info: FormDisplayInfo = {
        filename: 'movie.form.md',
        title: 'Movie Research',
      };
      expect(formatFormLabel(info)).toBe('movie.form.md - Movie Research');
    });

    it('formats with runMode', () => {
      const info: FormDisplayInfo = {
        filename: 'movie.form.md',
        title: 'Movie Research',
        runMode: 'research',
      };
      expect(formatFormLabel(info)).toBe('movie.form.md - Movie Research [research]');
    });

    it('formats with runMode but no title', () => {
      const info: FormDisplayInfo = {
        filename: 'test.form.md',
        runMode: 'fill',
      };
      expect(formatFormLabel(info)).toBe('test.form.md [fill]');
    });
  });

  describe('formatFormHint', () => {
    it('returns empty string when no description', () => {
      const info: FormDisplayInfo = { filename: 'test.form.md' };
      expect(formatFormHint(info)).toBe('');
    });

    it('returns description when present', () => {
      const info: FormDisplayInfo = {
        filename: 'test.form.md',
        description: 'A helpful form for testing',
      };
      expect(formatFormHint(info)).toBe('A helpful form for testing');
    });
  });

  describe('formatFormLogLine', () => {
    it('formats with prefix and filename only', () => {
      const info: FormDisplayInfo = { filename: 'test.form.md' };
      const result = formatFormLogLine(info, '✓');
      // Strip ANSI codes for comparison
      // eslint-disable-next-line no-control-regex
      expect(result.replace(/\x1b\[[0-9;]*m/g, '')).toBe('✓ test.form.md');
    });

    it('formats with prefix, filename and title', () => {
      const info: FormDisplayInfo = {
        filename: 'movie.form.md',
        title: 'Movie Research',
      };
      const result = formatFormLogLine(info, '→');
      // Strip ANSI codes for comparison
      // eslint-disable-next-line no-control-regex
      expect(result.replace(/\x1b\[[0-9;]*m/g, '')).toBe('→ movie.form.md - Movie Research');
    });

    it('includes title with dim styling', () => {
      const info: FormDisplayInfo = {
        filename: 'test.form.md',
        title: 'Test Form',
      };
      const result = formatFormLogLine(info, '✓');
      // Should contain ANSI codes for dimming around title
      expect(result).toContain('test.form.md');
      expect(result).toContain('Test Form');
    });
  });

  describe('issueReasonToStatus edge cases', () => {
    it('returns "issue" for unknown reasons', () => {
      // Test the default case for unrecognized reasons
      // Use type casting to test with a non-standard reason
      const unknownReason = 'unknown_reason' as Parameters<typeof issueReasonToStatus>[0];
      expect(issueReasonToStatus(unknownReason)).toBe('issue');
    });
  });
});
