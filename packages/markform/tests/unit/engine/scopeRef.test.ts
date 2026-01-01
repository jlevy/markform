/**
 * Tests for scope reference parsing and serialization.
 */
import { describe, expect, it } from 'vitest';

import {
  parseScopeRef,
  serializeScopeRef,
  isCellRef,
  isQualifiedRef,
  isFieldRef,
  getFieldId,
  type ParsedScopeRef,
} from '../../../src/engine/scopeRef.js';

describe('scopeRef', () => {
  describe('parseScopeRef', () => {
    // Valid cases: [input, expectedRef]
    const VALID_CASES: [string, ParsedScopeRef][] = [
      // Simple field references
      ['myField', { type: 'field', fieldId: 'myField' }],
      ['_private', { type: 'field', fieldId: '_private' }],
      ['field_123', { type: 'field', fieldId: 'field_123' }],
      ['my-field', { type: 'field', fieldId: 'my-field' }],

      // Qualified references (field.qualifier)
      ['myField.optA', { type: 'qualified', fieldId: 'myField', qualifierId: 'optA' }],
      ['table.column_name', { type: 'qualified', fieldId: 'table', qualifierId: 'column_name' }],
      ['select.opt-1', { type: 'qualified', fieldId: 'select', qualifierId: 'opt-1' }],

      // Cell references (field[row].column)
      ['myTable[0].name', { type: 'cell', fieldId: 'myTable', row: 0, columnId: 'name' }],
      ['myTable[2].name', { type: 'cell', fieldId: 'myTable', row: 2, columnId: 'name' }],
      ['data[99].col', { type: 'cell', fieldId: 'data', row: 99, columnId: 'col' }],

      // Whitespace handling
      ['  myField  ', { type: 'field', fieldId: 'myField' }],
      [' field.opt ', { type: 'qualified', fieldId: 'field', qualifierId: 'opt' }],
    ];

    for (const [input, expected] of VALID_CASES) {
      it(`parses "${input}"`, () => {
        const result = parseScopeRef(input);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.ref).toEqual(expected);
        }
      });
    }

    // Invalid cases
    const INVALID_CASES: [string, RegExp][] = [
      ['', /empty/i],
      ['   ', /empty/i],
      ['123field', /invalid.*format/i], // Can't start with number
      ['field..opt', /invalid.*format/i], // Double dot
      ['field[abc].col', /invalid.*format/i], // Non-numeric row
      ['field[-1].col', /invalid.*format/i], // Negative row (format mismatch)
      ['field[].col', /invalid.*format/i], // Empty row
      ['a.b.c', /invalid.*format/i], // Too many dots
    ];

    for (const [input, errorPattern] of INVALID_CASES) {
      it(`rejects "${input || '(empty)'}"`, () => {
        const result = parseScopeRef(input);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toMatch(errorPattern);
        }
      });
    }
  });

  describe('serializeScopeRef', () => {
    const CASES: [ParsedScopeRef, string][] = [
      [{ type: 'field', fieldId: 'myField' }, 'myField'],
      [{ type: 'qualified', fieldId: 'myField', qualifierId: 'optA' }, 'myField.optA'],
      [{ type: 'cell', fieldId: 'myTable', row: 2, columnId: 'name' }, 'myTable[2].name'],
    ];

    for (const [ref, expected] of CASES) {
      it(`serializes ${ref.type} ref to "${expected}"`, () => {
        expect(serializeScopeRef(ref)).toBe(expected);
      });
    }
  });

  describe('round-trip', () => {
    const REFS = ['field', 'field.option', 'table[0].col', 'a_b.c_d', 'x[99].y'];

    for (const refStr of REFS) {
      it(`round-trips "${refStr}"`, () => {
        const parsed = parseScopeRef(refStr);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
          expect(serializeScopeRef(parsed.ref)).toBe(refStr);
        }
      });
    }
  });

  describe('type guards', () => {
    const fieldRef: ParsedScopeRef = { type: 'field', fieldId: 'f' };
    const qualifiedRef: ParsedScopeRef = { type: 'qualified', fieldId: 'f', qualifierId: 'q' };
    const cellRef: ParsedScopeRef = { type: 'cell', fieldId: 'f', row: 0, columnId: 'c' };

    it('isFieldRef', () => {
      expect(isFieldRef(fieldRef)).toBe(true);
      expect(isFieldRef(qualifiedRef)).toBe(false);
      expect(isFieldRef(cellRef)).toBe(false);
    });

    it('isQualifiedRef', () => {
      expect(isQualifiedRef(fieldRef)).toBe(false);
      expect(isQualifiedRef(qualifiedRef)).toBe(true);
      expect(isQualifiedRef(cellRef)).toBe(false);
    });

    it('isCellRef', () => {
      expect(isCellRef(fieldRef)).toBe(false);
      expect(isCellRef(qualifiedRef)).toBe(false);
      expect(isCellRef(cellRef)).toBe(true);
    });
  });

  describe('getFieldId', () => {
    const CASES: [ParsedScopeRef, string][] = [
      [{ type: 'field', fieldId: 'myField' }, 'myField'],
      [{ type: 'qualified', fieldId: 'myField', qualifierId: 'opt' }, 'myField'],
      [{ type: 'cell', fieldId: 'myTable', row: 0, columnId: 'col' }, 'myTable'],
    ];

    for (const [ref, expectedId] of CASES) {
      it(`extracts "${expectedId}" from ${ref.type} ref`, () => {
        expect(getFieldId(ref)).toBe(expectedId);
      });
    }
  });
});
