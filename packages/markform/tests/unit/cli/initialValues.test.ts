/**
 * Tests for initial values parsing utilities.
 */
import { describe, expect, it } from 'vitest';

import {
  parseInitialValues,
  validateInitialValueFields,
} from '../../../src/cli/lib/initialValues.js';

describe('initialValues utilities', () => {
  describe('parseInitialValues', () => {
    // Table-driven tests: [input, expected patches]
    const VALID_CASES: [string[], unknown[]][] = [
      // String values
      [['name=John'], [{ op: 'set_string', fieldId: 'name', value: 'John' }]],
      [['field='], [{ op: 'set_string', fieldId: 'field', value: '' }]],
      [['formula=a=b+c'], [{ op: 'set_string', fieldId: 'formula', value: 'a=b+c' }]],

      // Number values
      [['count:number=42'], [{ op: 'set_number', fieldId: 'count', value: 42 }]],
      [['price:number=19.99'], [{ op: 'set_number', fieldId: 'price', value: 19.99 }]],
      [['temp:number=-5.5'], [{ op: 'set_number', fieldId: 'temp', value: -5.5 }]],
      [['score:NUMBER=0'], [{ op: 'set_number', fieldId: 'score', value: 0 }]],

      // List values
      [['tags:list=a,b,c'], [{ op: 'set_string_list', fieldId: 'tags', value: ['a', 'b', 'c'] }]],
      [
        ['tags:list=a , b , c'],
        [{ op: 'set_string_list', fieldId: 'tags', value: ['a', 'b', 'c'] }],
      ],
      [['tags:list=a,,b'], [{ op: 'set_string_list', fieldId: 'tags', value: ['a', 'b'] }]],
      [['tags:list='], [{ op: 'set_string_list', fieldId: 'tags', value: [] }]],

      // Empty input
      [[], []],

      // Mixed types
      [
        ['name=John', 'age:number=30', 'tags:list=dev,test'],
        [
          { op: 'set_string', fieldId: 'name', value: 'John' },
          { op: 'set_number', fieldId: 'age', value: 30 },
          { op: 'set_string_list', fieldId: 'tags', value: ['dev', 'test'] },
        ],
      ],
    ];

    for (const [input, expected] of VALID_CASES) {
      it(`parses ${JSON.stringify(input)}`, () => {
        expect(parseInitialValues(input)).toEqual(expected);
      });
    }

    // Error cases
    const ERROR_CASES: [string[], RegExp][] = [
      [['noequals'], /Invalid input format.*expected.*fieldId=value/],
      [['field'], /Invalid input format/],
      [['count:number=abc'], /Invalid number value/],
      [['count:number='], /Invalid number value/],
    ];

    for (const [input, errorPattern] of ERROR_CASES) {
      it(`throws for ${JSON.stringify(input)}`, () => {
        expect(() => parseInitialValues(input)).toThrow(errorPattern);
      });
    }
  });

  describe('validateInitialValueFields', () => {
    const validIds = new Set(['name', 'email', 'age', 'tags']);

    const VALIDATION_CASES: [unknown[], string[]][] = [
      // All valid
      [[{ op: 'set_string', fieldId: 'name', value: 'John' }], []],
      // One invalid
      [[{ op: 'set_string', fieldId: 'unknown', value: 'x' }], ['unknown']],
      // Multiple invalid
      [
        [
          { op: 'set_string', fieldId: 'bad1', value: '' },
          { op: 'set_string', fieldId: 'name', value: '' },
          { op: 'set_string', fieldId: 'bad2', value: '' },
        ],
        ['bad1', 'bad2'],
      ],
      // Empty
      [[], []],
    ];

    for (const [patches, expectedInvalid] of VALIDATION_CASES) {
      it(`validates ${patches.length} patches → ${expectedInvalid.length} invalid`, () => {
        expect(validateInitialValueFields(patches as never, validIds)).toEqual(expectedInvalid);
      });
    }
  });
});
