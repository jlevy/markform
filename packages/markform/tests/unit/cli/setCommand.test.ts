/**
 * Unit tests for the set command's parseCliValue function.
 */

import { describe, it, expect } from 'vitest';
import { parseCliValue } from '../../../src/cli/commands/set.js';
import { parseForm } from '../../../src/engine/parse.js';
import { applyPatches } from '../../../src/engine/apply.js';

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

describe('set validation warnings', () => {
  it('should return validation_error issues when value violates pattern constraint', () => {
    const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% group id="g1" title="G1" %}
{% field kind="string" id="ticker" label="Ticker" pattern="^[A-Z]{1,5}$" %}{% /field %}
{% /group %}
{% /form %}`;

    const form = parseForm(formContent);
    // Set a lowercase value that violates the pattern — applyPatches accepts the value
    // but validate() flags it, so issues should contain a validation_error
    const result = applyPatches(form, [{ op: 'set_string', fieldId: 'ticker', value: 'aapl' }]);

    expect(result.applyStatus).toBe('applied');
    const validationIssues = result.issues.filter((i) => i.reason === 'validation_error');
    expect(validationIssues.length).toBeGreaterThan(0);
    expect(validationIssues[0]!.message).toContain('pattern');
  });
});
