import { describe, it, expect } from 'vitest';

import { parseScopeRef, serializeScopeRef } from './scopeRef.js';

describe('parseScopeRef', () => {
  describe('field references', () => {
    it('parses simple field id', () => {
      expect(parseScopeRef('company_name')).toEqual({
        ok: true,
        ref: { type: 'field', fieldId: 'company_name' },
      });
    });

    it('rejects invalid characters', () => {
      expect(parseScopeRef('Company-Name').ok).toBe(false);
      expect(parseScopeRef('123_field').ok).toBe(false);
      expect(parseScopeRef('field name').ok).toBe(false);
    });
  });

  describe('qualified references (option/column)', () => {
    it('parses qualified ref', () => {
      expect(parseScopeRef('rating.bullish')).toEqual({
        ok: true,
        ref: { type: 'option', fieldId: 'rating', optionId: 'bullish' },
      });
    });

    it('parses multi-segment field id', () => {
      expect(parseScopeRef('docs_reviewed.ten_k')).toEqual({
        ok: true,
        ref: { type: 'option', fieldId: 'docs_reviewed', optionId: 'ten_k' },
      });
    });
  });

  describe('cell references', () => {
    it('parses cell ref with row index', () => {
      expect(parseScopeRef('key_people.name[0]')).toEqual({
        ok: true,
        ref: { type: 'cell', fieldId: 'key_people', columnId: 'name', rowIndex: 0 },
      });
    });

    it('parses large row index', () => {
      expect(parseScopeRef('films.title[999]')).toEqual({
        ok: true,
        ref: { type: 'cell', fieldId: 'films', columnId: 'title', rowIndex: 999 },
      });
    });

    it('rejects negative row index', () => {
      // Note: regex won't match negative, so this becomes invalid format
      expect(parseScopeRef('films.title[-1]').ok).toBe(false);
    });

    it('rejects non-numeric row index', () => {
      expect(parseScopeRef('films.title[abc]').ok).toBe(false);
    });
  });

  describe('invalid formats', () => {
    it('rejects empty string', () => {
      expect(parseScopeRef('').ok).toBe(false);
    });

    it('rejects just dots', () => {
      expect(parseScopeRef('.').ok).toBe(false);
      expect(parseScopeRef('field.').ok).toBe(false);
      expect(parseScopeRef('.option').ok).toBe(false);
    });

    it('rejects malformed cell refs', () => {
      expect(parseScopeRef('field.column[]').ok).toBe(false);
      expect(parseScopeRef('field.column[').ok).toBe(false);
      expect(parseScopeRef('field.column]').ok).toBe(false);
      expect(parseScopeRef('field.column[1').ok).toBe(false);
    });
  });
});

describe('serializeScopeRef', () => {
  it('round-trips field ref', () => {
    const ref = { type: 'field' as const, fieldId: 'company' };
    expect(serializeScopeRef(ref)).toBe('company');
  });

  it('round-trips option ref', () => {
    const ref = { type: 'option' as const, fieldId: 'rating', optionId: 'bullish' };
    expect(serializeScopeRef(ref)).toBe('rating.bullish');
  });

  it('round-trips column ref', () => {
    const ref = { type: 'column' as const, fieldId: 'films', columnId: 'title' };
    expect(serializeScopeRef(ref)).toBe('films.title');
  });

  it('round-trips cell ref', () => {
    const ref = { type: 'cell' as const, fieldId: 'people', columnId: 'name', rowIndex: 5 };
    expect(serializeScopeRef(ref)).toBe('people.name[5]');
  });

  it('handles zero row index', () => {
    const ref = { type: 'cell' as const, fieldId: 'table', columnId: 'col', rowIndex: 0 };
    expect(serializeScopeRef(ref)).toBe('table.col[0]');
  });
});
