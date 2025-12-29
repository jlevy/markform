/**
 * Key-based sorting utilities.
 */

/** Create a comparator from a key function. */
function keyComparator<T, K>(keyFn: (item: T) => K): (a: T, b: T) => number {
  return (a, b) => {
    const ka = keyFn(a),
      kb = keyFn(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };
}

/**
 * Comparator that sorts priority keys first (in order), then remaining keys alphabetically.
 *
 * @example
 * ```ts
 * const attrs = { label: 'Name', kind: 'string', id: 'name', required: true };
 * const keys = Object.keys(attrs).sort(priorityKeyComparator(['kind', 'id']));
 * // => ['kind', 'id', 'label', 'required']
 * ```
 */
export function priorityKeyComparator(priorityKeys: string[]): (a: string, b: string) => number {
  return keyComparator((key: string) => {
    const i = priorityKeys.indexOf(key);
    return [i !== -1 ? i : Infinity, key] as [number, string];
  });
}
