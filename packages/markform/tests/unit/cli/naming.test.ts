/**
 * Tests for naming convention utilities.
 */
import { describe, expect, it } from 'vitest';

import {
  toSnakeCase,
  toCamelCase,
  convertKeysToSnakeCase,
  convertKeysToCamelCase,
} from '../../../src/cli/lib/naming.js';

describe('naming utilities', () => {
  // Table-driven tests for string conversions
  const SNAKE_CASES: [string, string][] = [
    ['fieldCount', 'field_count'],
    ['parentFieldId', 'parent_field_id'],
    ['maxPatchesPerTurn', 'max_patches_per_turn'],
    ['already_snake', 'already_snake'],
    ['field', 'field'],
    ['', ''],
  ];

  const CAMEL_CASES: [string, string][] = [
    ['field_count', 'fieldCount'],
    ['parent_field_id', 'parentFieldId'],
    ['max_patches_per_turn', 'maxPatchesPerTurn'],
    ['alreadyCamel', 'alreadyCamel'],
    ['field', 'field'],
    ['', ''],
    // Note: '_private' → 'Private' (leading underscore is treated as separator)
  ];

  describe('toSnakeCase', () => {
    for (const [input, expected] of SNAKE_CASES) {
      it(`"${input}" → "${expected}"`, () => {
        expect(toSnakeCase(input)).toBe(expected);
      });
    }
  });

  describe('toCamelCase', () => {
    for (const [input, expected] of CAMEL_CASES) {
      it(`"${input}" → "${expected}"`, () => {
        expect(toCamelCase(input)).toBe(expected);
      });
    }
  });

  describe('convertKeysToSnakeCase', () => {
    const OBJECT_CASES: [unknown, unknown][] = [
      // Flat objects
      [
        { fieldCount: 5, parentFieldId: 'abc' },
        { field_count: 5, parent_field_id: 'abc' },
      ],
      // Nested objects
      [{ formSchema: { fieldId: 'test' } }, { form_schema: { field_id: 'test' } }],
      // Arrays
      [[{ fieldId: 'a' }], [{ field_id: 'a' }]],
      // Primitives pass through
      [null, null],
      [undefined, undefined],
      ['string', 'string'],
      [123, 123],
      [{}, {}],
    ];

    for (const [input, expected] of OBJECT_CASES) {
      it(`converts ${JSON.stringify(input)?.slice(0, 40)}`, () => {
        expect(convertKeysToSnakeCase(input)).toEqual(expected);
      });
    }
  });

  describe('convertKeysToCamelCase', () => {
    const OBJECT_CASES: [unknown, unknown][] = [
      [
        { field_count: 5, parent_field_id: 'abc' },
        { fieldCount: 5, parentFieldId: 'abc' },
      ],
      [{ form_schema: { field_id: 'test' } }, { formSchema: { fieldId: 'test' } }],
      [[{ field_id: 'a' }], [{ fieldId: 'a' }]],
      [null, null],
      [undefined, undefined],
      ['string', 'string'],
      [{}, {}],
    ];

    for (const [input, expected] of OBJECT_CASES) {
      it(`converts ${JSON.stringify(input)?.slice(0, 40)}`, () => {
        expect(convertKeysToCamelCase(input)).toEqual(expected);
      });
    }
  });

  describe('round-trip conversion', () => {
    it('camelCase → snake_case → camelCase preserves object', () => {
      const original = { fieldCount: 5, parentFieldId: 'abc', nested: { maxItems: 10 } };
      expect(convertKeysToCamelCase(convertKeysToSnakeCase(original))).toEqual(original);
    });

    it('snake_case → camelCase → snake_case preserves object', () => {
      const original = { field_count: 5, parent_field_id: 'abc', nested: { max_items: 10 } };
      expect(convertKeysToSnakeCase(convertKeysToCamelCase(original))).toEqual(original);
    });
  });
});
