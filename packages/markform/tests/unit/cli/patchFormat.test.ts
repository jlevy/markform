/**
 * Unit tests for patch formatting utilities.
 *
 * Tests pure formatting functions for displaying patches in CLI.
 */

import { describe, it, expect } from 'vitest';
import { formatPatchValue, formatPatchType } from '../../../src/cli/lib/patchFormat.js';
import type { Patch } from '../../../src/engine/coreTypes.js';

describe('patchFormat', () => {
  describe('formatPatchValue', () => {
    describe('set_string', () => {
      it('formats string value with quotes', () => {
        const patch: Patch = { op: 'set_string', fieldId: 'name', value: 'John Doe' };
        expect(formatPatchValue(patch)).toBe('"John Doe"');
      });

      it('formats null/empty as (empty)', () => {
        const patch: Patch = { op: 'set_string', fieldId: 'name', value: null };
        expect(formatPatchValue(patch)).toBe('(empty)');
      });

      it('formats empty string as (empty)', () => {
        const patch: Patch = { op: 'set_string', fieldId: 'name', value: '' };
        expect(formatPatchValue(patch)).toBe('(empty)');
      });
    });

    describe('set_number', () => {
      it('formats number value', () => {
        const patch: Patch = { op: 'set_number', fieldId: 'age', value: 42 };
        expect(formatPatchValue(patch)).toBe('42');
      });

      it('formats zero', () => {
        const patch: Patch = { op: 'set_number', fieldId: 'count', value: 0 };
        expect(formatPatchValue(patch)).toBe('0');
      });

      it('formats null as (empty)', () => {
        const patch: Patch = { op: 'set_number', fieldId: 'age', value: null };
        expect(formatPatchValue(patch)).toBe('(empty)');
      });
    });

    describe('set_string_list', () => {
      it('formats string array', () => {
        const patch: Patch = { op: 'set_string_list', fieldId: 'tags', items: ['a', 'b', 'c'] };
        expect(formatPatchValue(patch)).toBe('[a, b, c]');
      });

      it('formats empty array as (empty)', () => {
        const patch: Patch = { op: 'set_string_list', fieldId: 'tags', items: [] };
        expect(formatPatchValue(patch)).toBe('(empty)');
      });
    });

    describe('set_single_select', () => {
      it('formats selected option', () => {
        const patch: Patch = { op: 'set_single_select', fieldId: 'priority', selected: 'high' };
        expect(formatPatchValue(patch)).toBe('high');
      });

      it('formats null as (none)', () => {
        const patch: Patch = { op: 'set_single_select', fieldId: 'priority', selected: null };
        expect(formatPatchValue(patch)).toBe('(none)');
      });
    });

    describe('set_multi_select', () => {
      it('formats selected options', () => {
        const patch: Patch = {
          op: 'set_multi_select',
          fieldId: 'categories',
          selected: ['a', 'b'],
        };
        expect(formatPatchValue(patch)).toBe('[a, b]');
      });

      it('formats empty selection as (none)', () => {
        const patch: Patch = { op: 'set_multi_select', fieldId: 'categories', selected: [] };
        expect(formatPatchValue(patch)).toBe('(none)');
      });
    });

    describe('set_checkboxes', () => {
      it('formats checkbox values', () => {
        const patch: Patch = {
          op: 'set_checkboxes',
          fieldId: 'tasks',
          values: { task1: 'done', task2: 'todo' },
        };
        expect(formatPatchValue(patch)).toBe('task1:done, task2:todo');
      });

      it('formats empty checkboxes', () => {
        const patch: Patch = { op: 'set_checkboxes', fieldId: 'tasks', values: {} };
        expect(formatPatchValue(patch)).toBe('');
      });
    });

    describe('clear_field', () => {
      it('formats as (cleared)', () => {
        const patch: Patch = { op: 'clear_field', fieldId: 'name' };
        expect(formatPatchValue(patch)).toBe('(cleared)');
      });
    });

    describe('skip_field', () => {
      it('formats with reason', () => {
        const patch: Patch = {
          op: 'skip_field',
          fieldId: 'name',
          role: 'agent',
          reason: 'Not applicable',
        };
        expect(formatPatchValue(patch)).toBe('(skipped: Not applicable)');
      });

      it('formats without reason', () => {
        const patch: Patch = { op: 'skip_field', fieldId: 'name', role: 'agent' };
        expect(formatPatchValue(patch)).toBe('(skipped)');
      });
    });

    describe('abort_field', () => {
      it('formats with reason', () => {
        const patch: Patch = {
          op: 'abort_field',
          fieldId: 'name',
          role: 'agent',
          reason: 'Too complex',
        };
        expect(formatPatchValue(patch)).toBe('(aborted: Too complex)');
      });

      it('formats without reason', () => {
        const patch: Patch = { op: 'abort_field', fieldId: 'name', role: 'agent' };
        expect(formatPatchValue(patch)).toBe('(aborted)');
      });
    });

    describe('set_url', () => {
      it('formats URL with quotes', () => {
        const patch: Patch = { op: 'set_url', fieldId: 'website', value: 'https://example.com' };
        expect(formatPatchValue(patch)).toBe('"https://example.com"');
      });

      it('formats null as (empty)', () => {
        const patch: Patch = { op: 'set_url', fieldId: 'website', value: null };
        expect(formatPatchValue(patch)).toBe('(empty)');
      });
    });

    describe('set_url_list', () => {
      it('formats URL array', () => {
        const patch: Patch = {
          op: 'set_url_list',
          fieldId: 'refs',
          items: ['https://a.com', 'https://b.com'],
        };
        expect(formatPatchValue(patch)).toBe('[https://a.com, https://b.com]');
      });

      it('formats empty array as (empty)', () => {
        const patch: Patch = { op: 'set_url_list', fieldId: 'refs', items: [] };
        expect(formatPatchValue(patch)).toBe('(empty)');
      });
    });

    describe('set_date', () => {
      it('formats date with quotes', () => {
        const patch: Patch = { op: 'set_date', fieldId: 'birthday', value: '1990-05-15' };
        expect(formatPatchValue(patch)).toBe('"1990-05-15"');
      });

      it('formats null as (empty)', () => {
        const patch: Patch = { op: 'set_date', fieldId: 'birthday', value: null };
        expect(formatPatchValue(patch)).toBe('(empty)');
      });
    });

    describe('set_year', () => {
      it('formats year value', () => {
        const patch: Patch = { op: 'set_year', fieldId: 'grad_year', value: 2020 };
        expect(formatPatchValue(patch)).toBe('2020');
      });

      it('formats null as (empty)', () => {
        const patch: Patch = { op: 'set_year', fieldId: 'grad_year', value: null };
        expect(formatPatchValue(patch)).toBe('(empty)');
      });
    });

    describe('set_table', () => {
      it('formats row count', () => {
        const patch: Patch = {
          op: 'set_table',
          fieldId: 'contacts',
          rows: [{ name: 'John' }, { name: 'Jane' }],
        };
        expect(formatPatchValue(patch)).toBe('[2 rows]');
      });

      it('formats empty rows as (empty)', () => {
        const patch: Patch = { op: 'set_table', fieldId: 'contacts', rows: [] };
        expect(formatPatchValue(patch)).toBe('(empty)');
      });
    });

    describe('add_note', () => {
      it('formats note text', () => {
        const patch: Patch = { op: 'add_note', ref: 'name', role: 'agent', text: 'This is a note' };
        expect(formatPatchValue(patch)).toBe('note: This is a note');
      });
    });

    describe('remove_note', () => {
      it('formats note removal', () => {
        const patch: Patch = { op: 'remove_note', noteId: 'note_123' };
        expect(formatPatchValue(patch)).toBe('(remove note note_123)');
      });
    });

    describe('truncation', () => {
      it('truncates long string values', () => {
        const longValue = 'a'.repeat(1500);
        const patch: Patch = { op: 'set_string', fieldId: 'text', value: longValue };
        const result = formatPatchValue(patch);
        expect(result.length).toBeLessThan(1100); // 1000 chars + quotes + ellipsis
        expect(result).toContain('…');
      });
    });
  });

  describe('formatPatchType', () => {
    const cases: { patch: Patch; expected: string }[] = [
      { patch: { op: 'set_string', fieldId: 'x', value: 'v' }, expected: 'string' },
      { patch: { op: 'set_number', fieldId: 'x', value: 1 }, expected: 'number' },
      { patch: { op: 'set_string_list', fieldId: 'x', items: [] }, expected: 'string_list' },
      { patch: { op: 'set_single_select', fieldId: 'x', selected: null }, expected: 'select' },
      { patch: { op: 'set_multi_select', fieldId: 'x', selected: [] }, expected: 'multi_select' },
      { patch: { op: 'set_checkboxes', fieldId: 'x', values: {} }, expected: 'checkboxes' },
      { patch: { op: 'clear_field', fieldId: 'x' }, expected: 'clear' },
      { patch: { op: 'skip_field', fieldId: 'x', role: 'agent' }, expected: 'skip' },
      { patch: { op: 'abort_field', fieldId: 'x', role: 'agent' }, expected: 'abort' },
      { patch: { op: 'set_url', fieldId: 'x', value: null }, expected: 'url' },
      { patch: { op: 'set_url_list', fieldId: 'x', items: [] }, expected: 'url_list' },
      { patch: { op: 'set_date', fieldId: 'x', value: null }, expected: 'date' },
      { patch: { op: 'set_year', fieldId: 'x', value: null }, expected: 'year' },
      { patch: { op: 'set_table', fieldId: 'x', rows: [] }, expected: 'table' },
      { patch: { op: 'add_note', ref: 'x', role: 'agent', text: 't' }, expected: 'note' },
      { patch: { op: 'remove_note', noteId: 'n' }, expected: 'remove_note' },
    ];

    it.each(cases)('formats $patch.op as $expected', ({ patch, expected }) => {
      expect(formatPatchType(patch)).toBe(expected);
    });
  });
});
