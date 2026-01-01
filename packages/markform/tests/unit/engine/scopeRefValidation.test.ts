/**
 * Tests for schema-aware scope reference resolution.
 */
import { describe, expect, it } from 'vitest';

import { resolveScopeRef, validateCellRowBounds } from '../../../src/engine/scopeRefValidation.js';
import { parseForm } from '../../../src/engine/parse.js';
import type { ParsedScopeRef } from '../../../src/engine/scopeRef.js';
import type { ResolvedCellRef } from '../../../src/engine/scopeRefValidation.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_FORM = `---
markform:
  spec: "MF/0.1"
  title: Test Form
---

{% form id="test" title="Test Form" %}

{% group id="main" title="Main" %}

{% field kind="string" id="name" label="Name" role="user" %}{% /field %}

{% field kind="single_select" id="priority" label="Priority" role="user" %}
- [ ] Low {% #low %}
- [ ] Medium {% #medium %}
- [ ] High {% #high %}
{% /field %}

{% field kind="checkboxes" id="tasks" label="Tasks" role="user" checkboxMode="multi" %}
- [ ] Task 1 {% #task1 %}
- [ ] Task 2 {% #task2 %}
{% /field %}

{% field kind="table" id="team" label="Team" role="user"
   columnIds=["col_name", "col_age"]
   columnTypes=["string", "number"] %}
| Name | Age |
|------|-----|
{% /field %}

{% /group %}

{% /form %}
`;

const PARSED_FORM = parseForm(TEST_FORM);
const TEST_SCHEMA = PARSED_FORM.schema;

// =============================================================================
// Tests
// =============================================================================

describe('scopeRefValidation', () => {
  describe('resolveScopeRef - field references', () => {
    const CASES: [string, ParsedScopeRef, boolean][] = [
      ['resolves existing string field', { type: 'field', fieldId: 'name' }, true],
      ['resolves existing select field', { type: 'field', fieldId: 'priority' }, true],
      ['resolves existing table field', { type: 'field', fieldId: 'team' }, true],
      ['fails for unknown field', { type: 'field', fieldId: 'unknown' }, false],
    ];

    for (const [desc, ref, shouldSucceed] of CASES) {
      it(desc, () => {
        const result = resolveScopeRef(TEST_SCHEMA, ref);
        expect(result.ok).toBe(shouldSucceed);
        if (shouldSucceed && result.ok) {
          expect(result.resolved.type).toBe('field');
        }
      });
    }
  });

  describe('resolveScopeRef - qualified references (options)', () => {
    it('resolves select option', () => {
      const ref: ParsedScopeRef = { type: 'qualified', fieldId: 'priority', qualifierId: 'high' };
      const result = resolveScopeRef(TEST_SCHEMA, ref);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.resolved.type).toBe('option');
      }
    });

    it('resolves checkbox option', () => {
      const ref: ParsedScopeRef = { type: 'qualified', fieldId: 'tasks', qualifierId: 'task1' };
      const result = resolveScopeRef(TEST_SCHEMA, ref);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.resolved.type).toBe('option');
      }
    });

    it('fails for unknown option', () => {
      const ref: ParsedScopeRef = { type: 'qualified', fieldId: 'priority', qualifierId: 'urgent' };
      const result = resolveScopeRef(TEST_SCHEMA, ref);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/option.*not found/i);
      }
    });

    it('fails for non-option field', () => {
      const ref: ParsedScopeRef = { type: 'qualified', fieldId: 'name', qualifierId: 'something' };
      const result = resolveScopeRef(TEST_SCHEMA, ref);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/does not support qualified/i);
      }
    });
  });

  describe('resolveScopeRef - qualified references (columns)', () => {
    it('resolves table column', () => {
      const ref: ParsedScopeRef = { type: 'qualified', fieldId: 'team', qualifierId: 'col_name' };
      const result = resolveScopeRef(TEST_SCHEMA, ref);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.resolved.type).toBe('column');
      }
    });

    it('fails for unknown column', () => {
      const ref: ParsedScopeRef = { type: 'qualified', fieldId: 'team', qualifierId: 'unknown' };
      const result = resolveScopeRef(TEST_SCHEMA, ref);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/column.*not found/i);
      }
    });
  });

  describe('resolveScopeRef - cell references', () => {
    it('resolves valid cell reference', () => {
      const ref: ParsedScopeRef = { type: 'cell', fieldId: 'team', row: 0, columnId: 'col_name' };
      const result = resolveScopeRef(TEST_SCHEMA, ref);
      expect(result.ok).toBe(true);
      if (result.ok && result.resolved.type === 'cell') {
        expect(result.resolved.row).toBe(0);
      }
    });

    it('fails for cell ref on non-table field', () => {
      const ref: ParsedScopeRef = { type: 'cell', fieldId: 'name', row: 0, columnId: 'col' };
      const result = resolveScopeRef(TEST_SCHEMA, ref);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/only valid for table/i);
      }
    });

    it('fails for unknown column in cell ref', () => {
      const ref: ParsedScopeRef = { type: 'cell', fieldId: 'team', row: 0, columnId: 'unknown' };
      const result = resolveScopeRef(TEST_SCHEMA, ref);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/column.*not found/i);
      }
    });

    it('fails for negative row index', () => {
      const ref: ParsedScopeRef = { type: 'cell', fieldId: 'team', row: -1, columnId: 'col_name' };
      const result = resolveScopeRef(TEST_SCHEMA, ref);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/invalid row/i);
      }
    });
  });

  describe('validateCellRowBounds', () => {
    // Get table field from parsed schema
    const tableField = TEST_SCHEMA.groups[0]!.children.find((f) => f.id === 'team');
    if (tableField?.kind !== 'table') {
      throw new Error('Test setup failed: table field not found');
    }
    const column = tableField.columns[0]!;

    const CASES: [number, number, boolean | string][] = [
      // [row, rowCount, expected]
      [0, 5, true],
      [4, 5, true],
      [5, 5, 'out of bounds'],
      [10, 5, 'out of bounds'],
      [-1, 5, 'negative'],
    ];

    for (const [row, rowCount, expected] of CASES) {
      const desc =
        typeof expected === 'boolean'
          ? `row ${row} with ${rowCount} rows → valid`
          : `row ${row} with ${rowCount} rows → ${expected}`;
      it(desc, () => {
        const ref: ResolvedCellRef = { type: 'cell', field: tableField, column, row };
        const result = validateCellRowBounds(ref, rowCount);
        if (expected === true) {
          expect(result).toBe(true);
        } else if (typeof result === 'string' && typeof expected === 'string') {
          expect(result).toMatch(new RegExp(expected, 'i'));
        }
      });
    }
  });
});
