/**
 * Unit tests for the set command's parseCliValue function.
 */

import { describe, it, expect } from 'vitest';
import { parseCliValue } from '../../../src/cli/commands/set.js';

describe('parseCliValue', () => {
  it('passes plain strings through unchanged', () => {
    expect(parseCliValue('hello')).toBe('hello');
  });

  it('passes numeric strings through as strings', () => {
    expect(parseCliValue('42')).toBe('42');
  });

  it('passes boolean-like strings through as strings', () => {
    expect(parseCliValue('true')).toBe('true');
    expect(parseCliValue('false')).toBe('false');
  });

  it('parses JSON arrays', () => {
    expect(parseCliValue('["a","b","c"]')).toEqual(['a', 'b', 'c']);
  });

  it('parses JSON objects', () => {
    expect(parseCliValue('{"key":"value"}')).toEqual({ key: 'value' });
  });

  it('returns string for invalid JSON starting with [', () => {
    expect(parseCliValue('[not json')).toBe('[not json');
  });

  it('returns string for invalid JSON starting with {', () => {
    expect(parseCliValue('{bad')).toBe('{bad');
  });

  it('passes empty string through', () => {
    expect(parseCliValue('')).toBe('');
  });

  it('passes strings with special characters through', () => {
    expect(parseCliValue('hello world!')).toBe('hello world!');
  });

  it('parses nested JSON objects', () => {
    const input = '{"name":"Alice","scores":[1,2,3]}';
    expect(parseCliValue(input)).toEqual({ name: 'Alice', scores: [1, 2, 3] });
  });

  it('parses JSON array of objects', () => {
    const input = '[{"col":"val"}]';
    expect(parseCliValue(input)).toEqual([{ col: 'val' }]);
  });
});
