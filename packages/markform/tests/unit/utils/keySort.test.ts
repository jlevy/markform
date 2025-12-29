/**
 * Tests for keySort utilities.
 */

import { describe, expect, it } from 'vitest';
import { priorityKeyComparator } from '../../../src/utils/keySort.js';

describe('priorityKeyComparator', () => {
  it('sorts priority keys first in order', () => {
    const comparator = priorityKeyComparator(['kind', 'id']);
    const keys = ['label', 'kind', 'required', 'id'];
    expect(keys.sort(comparator)).toEqual(['kind', 'id', 'label', 'required']);
  });

  it('sorts non-priority keys alphabetically', () => {
    const comparator = priorityKeyComparator(['kind']);
    const keys = ['zebra', 'alpha', 'kind', 'beta'];
    expect(keys.sort(comparator)).toEqual(['kind', 'alpha', 'beta', 'zebra']);
  });

  it('works with single priority key', () => {
    const comparator = priorityKeyComparator(['kind']);
    const keys = ['id', 'label', 'kind'];
    expect(keys.sort(comparator)).toEqual(['kind', 'id', 'label']);
  });

  it('works with empty priority list (pure alphabetical)', () => {
    const comparator = priorityKeyComparator([]);
    const keys = ['c', 'a', 'b'];
    expect(keys.sort(comparator)).toEqual(['a', 'b', 'c']);
  });

  it('handles all keys being priority keys', () => {
    const comparator = priorityKeyComparator(['c', 'a', 'b']);
    const keys = ['a', 'b', 'c'];
    expect(keys.sort(comparator)).toEqual(['c', 'a', 'b']);
  });

  it('handles duplicate keys in input', () => {
    const comparator = priorityKeyComparator(['kind']);
    const keys = ['id', 'kind', 'id', 'kind'];
    expect(keys.sort(comparator)).toEqual(['kind', 'kind', 'id', 'id']);
  });

  it('real-world example: serializing field attributes', () => {
    const attrs = { label: 'Name', kind: 'string', id: 'name', required: true };
    const comparator = priorityKeyComparator(['kind', 'id']);
    const sortedKeys = Object.keys(attrs).sort(comparator);
    expect(sortedKeys).toEqual(['kind', 'id', 'label', 'required']);
  });
});
