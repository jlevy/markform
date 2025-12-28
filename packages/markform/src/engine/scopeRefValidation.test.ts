import { describe, it, expect } from 'vitest';

import { validateScopeRef } from './scopeRefValidation.js';
import type { FormSchema } from './coreTypes.js';

const mockSchema: FormSchema = {
  id: 'test_form',
  groups: [
    {
      id: 'group1',
      children: [
        {
          id: 'rating',
          kind: 'single_select',
          label: 'Rating',
          required: true,
          priority: 'medium',
          role: 'agent',
          options: [
            { id: 'bullish', label: 'Bullish' },
            { id: 'bearish', label: 'Bearish' },
          ],
        },
        {
          id: 'checkboxes',
          kind: 'checkboxes',
          label: 'Features',
          required: false,
          priority: 'medium',
          role: 'agent',
          checkboxMode: 'multi',
          approvalMode: 'none',
          options: [
            { id: 'feature_a', label: 'Feature A' },
            { id: 'feature_b', label: 'Feature B' },
          ],
        },
        {
          id: 'films',
          kind: 'table',
          label: 'Films',
          required: false,
          priority: 'medium',
          role: 'agent',
          columns: [
            { id: 'title', label: 'Title', type: 'string' },
            { id: 'year', label: 'Year', type: 'year' },
            { id: 'genre', label: 'Genre', type: 'string' },
          ],
        },
        {
          id: 'company_name',
          kind: 'string',
          label: 'Company Name',
          required: true,
          priority: 'high',
          role: 'agent',
        },
      ],
    },
  ],
};

describe('validateScopeRef', () => {
  describe('field validation', () => {
    it('accepts valid field', () => {
      const ref = { type: 'field' as const, fieldId: 'company_name' };
      const result = validateScopeRef(ref, mockSchema);
      expect(result.ok).toBe(true);
      expect(result.scope).toBe('field');
    });

    it('rejects unknown field', () => {
      const ref = { type: 'field' as const, fieldId: 'nonexistent' };
      const result = validateScopeRef(ref, mockSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unknown field');
    });
  });

  describe('option validation', () => {
    it('accepts valid option in select field', () => {
      const ref = { type: 'option' as const, fieldId: 'rating', optionId: 'bullish' };
      const result = validateScopeRef(ref, mockSchema);
      expect(result.ok).toBe(true);
      expect(result.scope).toBe('option');
    });

    it('accepts valid option in checkboxes field', () => {
      const ref = { type: 'option' as const, fieldId: 'checkboxes', optionId: 'feature_a' };
      const result = validateScopeRef(ref, mockSchema);
      expect(result.ok).toBe(true);
      expect(result.scope).toBe('option');
    });

    it('rejects unknown option', () => {
      const ref = { type: 'option' as const, fieldId: 'rating', optionId: 'unknown' };
      const result = validateScopeRef(ref, mockSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unknown option');
      expect(result.error).toContain('Valid options:');
    });

    it('rejects option ref on non-selectable field', () => {
      const ref = { type: 'option' as const, fieldId: 'company_name', optionId: 'something' };
      const result = validateScopeRef(ref, mockSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not selectable or table');
    });
  });

  describe('column validation', () => {
    it('accepts valid column in table field', () => {
      const ref = { type: 'column' as const, fieldId: 'films', columnId: 'title' };
      const result = validateScopeRef(ref, mockSchema);
      expect(result.ok).toBe(true);
      expect(result.scope).toBe('column');
    });

    it('rejects unknown column', () => {
      const ref = { type: 'column' as const, fieldId: 'films', columnId: 'nonexistent' };
      const result = validateScopeRef(ref, mockSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unknown column');
      expect(result.error).toContain('Valid columns:');
    });

    it('rejects column ref on non-table field', () => {
      const ref = { type: 'column' as const, fieldId: 'rating', columnId: 'score' };
      const result = validateScopeRef(ref, mockSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('is single_select, not table');
    });
  });

  describe('cell validation', () => {
    it('accepts valid cell ref', () => {
      const ref = { type: 'cell' as const, fieldId: 'films', columnId: 'title', rowIndex: 2 };
      const result = validateScopeRef(ref, mockSchema, { films: 5 });
      expect(result.ok).toBe(true);
      expect(result.scope).toBe('cell');
    });

    it('rejects cell ref on non-table field', () => {
      const ref = { type: 'cell' as const, fieldId: 'company_name', columnId: 'x', rowIndex: 0 };
      const result = validateScopeRef(ref, mockSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('is string, not table');
    });

    it('rejects unknown column in cell ref', () => {
      const ref = { type: 'cell' as const, fieldId: 'films', columnId: 'nonexistent', rowIndex: 0 };
      const result = validateScopeRef(ref, mockSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unknown column');
    });

    it('accepts in-bounds row index', () => {
      const ref = { type: 'cell' as const, fieldId: 'films', columnId: 'title', rowIndex: 2 };
      const result = validateScopeRef(ref, mockSchema, { films: 5 });
      expect(result.ok).toBe(true);
    });

    it('rejects out-of-bounds row index', () => {
      const ref = { type: 'cell' as const, fieldId: 'films', columnId: 'title', rowIndex: 10 };
      const result = validateScopeRef(ref, mockSchema, { films: 5 });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('out of bounds');
      expect(result.error).toContain('has 5 rows');
    });

    it('skips bounds check when rowCounts not provided', () => {
      const ref = { type: 'cell' as const, fieldId: 'films', columnId: 'title', rowIndex: 999 };
      const result = validateScopeRef(ref, mockSchema);
      expect(result.ok).toBe(true); // No bounds check without rowCounts
    });
  });

  describe('option/column disambiguation', () => {
    it('resolves qualified ref as option for select field', () => {
      const ref = { type: 'option' as const, fieldId: 'rating', optionId: 'bullish' };
      const result = validateScopeRef(ref, mockSchema);
      expect(result.ok).toBe(true);
      expect(result.scope).toBe('option');
    });

    it('resolves qualified ref as column for table field', () => {
      const ref = { type: 'option' as const, fieldId: 'films', optionId: 'title' };
      const result = validateScopeRef(ref, mockSchema);
      expect(result.ok).toBe(true);
      expect(result.scope).toBe('column');
    });

    it('rejects qualified ref that matches neither option nor column', () => {
      const ref = { type: 'option' as const, fieldId: 'films', optionId: 'nonexistent' };
      const result = validateScopeRef(ref, mockSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unknown column');
    });
  });
});
