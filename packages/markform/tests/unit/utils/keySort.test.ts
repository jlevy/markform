/**
 * Tests for keySort utilities.
 */

import { describe, expect, it } from 'vitest';
import { customKeySort, keyComparator, priorityKeyComparator } from '../../../src/utils/keySort.js';

describe('customKeySort', () => {
  it('returns index for priority keys', () => {
    const keyFn = customKeySort(['kind', 'id', 'label']);
    expect(keyFn('kind')).toEqual([0, 'kind']);
    expect(keyFn('id')).toEqual([1, 'id']);
    expect(keyFn('label')).toEqual([2, 'label']);
  });

  it('returns Infinity for non-priority keys', () => {
    const keyFn = customKeySort(['kind', 'id']);
    expect(keyFn('required')).toEqual([Infinity, 'required']);
    expect(keyFn('zebra')).toEqual([Infinity, 'zebra']);
  });

  it('works with empty priority list', () => {
    const keyFn = customKeySort<string>([]);
    expect(keyFn('anything')).toEqual([Infinity, 'anything']);
  });

  it('works with non-string types', () => {
    const keyFn = customKeySort([1, 2, 3]);
    expect(keyFn(1)).toEqual([0, 1]);
    expect(keyFn(2)).toEqual([1, 2]);
    expect(keyFn(99)).toEqual([Infinity, 99]);
  });
});

describe('keyComparator', () => {
  it('sorts by extracted key values', () => {
    const byLength = keyComparator((s: string) => s.length);
    const items = ['aaa', 'b', 'cc'];
    expect(items.sort(byLength)).toEqual(['b', 'cc', 'aaa']);
  });

  it('handles equal keys', () => {
    const byLength = keyComparator((s: string) => s.length);
    const result = byLength('ab', 'cd');
    expect(result).toBe(0);
  });

  it('returns -1 when first key is smaller', () => {
    const byValue = keyComparator((n: number) => n);
    expect(byValue(1, 2)).toBe(-1);
  });

  it('returns 1 when first key is larger', () => {
    const byValue = keyComparator((n: number) => n);
    expect(byValue(2, 1)).toBe(1);
  });

  it('works with tuple keys for lexicographic comparison', () => {
    const byTuple = keyComparator((s: string) => [s.length, s] as [number, string]);
    const items = ['bb', 'aa', 'c'];
    expect(items.sort(byTuple)).toEqual(['c', 'aa', 'bb']);
  });
});

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
