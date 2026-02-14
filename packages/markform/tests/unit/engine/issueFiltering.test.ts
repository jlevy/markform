/**
 * Unit tests for issue filtering utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  getFieldIdFromRef,
  filterIssuesByOrder,
  filterIssuesByScope,
} from '../../../src/engine/issueFiltering.js';
import type { InspectIssue, ParsedForm } from '../../../src/engine/coreTypes.js';
import { parseForm } from '../../../src/engine/parse.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Helper to create a minimal InspectIssue.
 */
function makeIssue(
  ref: string,
  scope: InspectIssue['scope'] = 'field',
  priority = 1,
): InspectIssue {
  return {
    ref,
    scope,
    reason: 'required_missing',
    message: `Issue for ${ref}`,
    severity: 'required',
    priority,
  };
}

/**
 * Load the simple form for testing.
 */
function loadSimpleForm(): ParsedForm {
  const content = readFileSync(
    resolve(__dirname, '../../../examples/simple/simple.form.md'),
    'utf-8',
  );
  return parseForm(content);
}

describe('getFieldIdFromRef', () => {
  it('returns ref directly for field scope', () => {
    expect(getFieldIdFromRef('name', 'field')).toBe('name');
  });

  it('extracts field ID from option ref', () => {
    expect(getFieldIdFromRef('priority.high', 'option')).toBe('priority');
  });

  it('extracts field ID from column ref', () => {
    expect(getFieldIdFromRef('table.col1', 'column')).toBe('table');
  });

  it('extracts field ID from cell ref', () => {
    expect(getFieldIdFromRef('table.col1', 'cell')).toBe('table');
  });

  it('returns undefined for form scope', () => {
    expect(getFieldIdFromRef('form_id', 'form')).toBeUndefined();
  });

  it('returns undefined for group scope', () => {
    expect(getFieldIdFromRef('group_id', 'group')).toBeUndefined();
  });
});

describe('filterIssuesByOrder', () => {
  it('returns all issues when no order attributes are used', () => {
    const form = loadSimpleForm();
    const issues = [makeIssue('name'), makeIssue('email'), makeIssue('age')];
    const result = filterIssuesByOrder(issues, form);
    expect(result).toEqual(issues);
  });

  it('always includes form-level issues', () => {
    const form = loadSimpleForm();
    const formIssue = makeIssue('form', 'form');
    const issues = [makeIssue('name'), formIssue];
    const result = filterIssuesByOrder(issues, form);
    expect(result).toContainEqual(formIssue);
  });
});

describe('filterIssuesByScope', () => {
  it('returns all issues when no limits configured', () => {
    const form = loadSimpleForm();
    const issues = [makeIssue('name'), makeIssue('email'), makeIssue('age')];
    const result = filterIssuesByScope(issues, form);
    expect(result).toEqual(issues);
  });

  it('limits distinct fields with maxFields', () => {
    const form = loadSimpleForm();
    const issues = [makeIssue('name'), makeIssue('email'), makeIssue('age'), makeIssue('tags')];
    const result = filterIssuesByScope(issues, form, 2);
    expect(result).toHaveLength(2);
    expect(result[0]!.ref).toBe('name');
    expect(result[1]!.ref).toBe('email');
  });

  it('allows multiple issues for the same field under the limit', () => {
    const form = loadSimpleForm();
    const issues = [
      makeIssue('name'),
      makeIssue('name'), // duplicate field
      makeIssue('email'),
    ];
    const result = filterIssuesByScope(issues, form, 2);
    // Both name issues + email = 3 (only 2 distinct fields)
    expect(result).toHaveLength(3);
  });

  it('always includes form-level issues', () => {
    const form = loadSimpleForm();
    const formIssue = makeIssue('form', 'form');
    const issues = [formIssue, makeIssue('name'), makeIssue('email')];
    const result = filterIssuesByScope(issues, form, 1);
    expect(result).toContainEqual(formIssue);
    // Plus 1 field
    expect(result).toHaveLength(2);
  });

  it('limits by maxGroups', () => {
    const form = loadSimpleForm();
    // name and email are in the same group, age is in another
    const issues = [makeIssue('name'), makeIssue('email'), makeIssue('age')];
    const result = filterIssuesByScope(issues, form, undefined, 1);
    // Should only include fields from the first group encountered
    expect(result.length).toBeLessThanOrEqual(issues.length);
    // All included issues should be from the same group
    const groups = new Set(
      result.map((i) => {
        const entry = form.idIndex.get(i.ref);
        return entry?.parentId;
      }),
    );
    expect(groups.size).toBeLessThanOrEqual(1);
  });
});
