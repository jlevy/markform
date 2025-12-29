/**
 * Key-based sorting utilities.
 *
 * Provides Python-style key functions for sorting, where you define how to
 * extract a sort key from each element rather than writing a comparator.
 */

/**
 * Create a sort key function that prioritizes specific keys first (in order),
 * followed by remaining keys in natural order.
 *
 * Returns a tuple where priority keys get their index (0, 1, 2, ...),
 * and non-priority keys get Infinity. The second element is the key itself
 * for natural ordering among non-priority keys.
 *
 * @example
 * ```ts
 * const keyFn = customKeySort(['kind', 'id']);
 * keyFn('kind')  // => [0, 'kind']
 * keyFn('id')    // => [1, 'id']
 * keyFn('label') // => [Infinity, 'label']
 * keyFn('zebra') // => [Infinity, 'zebra']
 * ```
 */
export function customKeySort<T>(priorityKeys: T[]): (key: T) => [number, T] {
  return (key: T): [number, T] => {
    const i = priorityKeys.indexOf(key);
    return i !== -1 ? [i, key] : [Infinity, key];
  };
}

/**
 * Create a comparator from a key function.
 *
 * This is the TypeScript equivalent of Python's `sorted(items, key=keyFn)`.
 * The key function extracts a comparable value from each item, and items
 * are sorted by comparing their keys.
 *
 * @example
 * ```ts
 * // Sort strings by length
 * const byLength = keyComparator((s: string) => s.length);
 * ['aaa', 'b', 'cc'].sort(byLength) // => ['b', 'cc', 'aaa']
 *
 * // Sort with priority keys first
 * const byPriority = keyComparator(customKeySort(['kind', 'id']));
 * ['label', 'kind', 'id'].sort(byPriority) // => ['kind', 'id', 'label']
 * ```
 */
export function keyComparator<T, K>(keyFn: (item: T) => K): (a: T, b: T) => number {
  return (a: T, b: T) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };
}

/**
 * Create a comparator that sorts priority keys first (in order),
 * then remaining keys alphabetically.
 *
 * This is a convenience function combining `keyComparator` and `customKeySort`.
 *
 * @example
 * ```ts
 * const attrs = { label: 'Name', kind: 'string', id: 'name', required: true };
 * const keys = Object.keys(attrs).sort(priorityKeyComparator(['kind', 'id']));
 * // => ['kind', 'id', 'label', 'required']
 * ```
 */
export function priorityKeyComparator(priorityKeys: string[]): (a: string, b: string) => number {
  return keyComparator(customKeySort(priorityKeys));
}
