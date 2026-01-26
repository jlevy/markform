/**
 * Unit tests for research form validation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  isResearchForm,
  validateResearchForm,
} from '../../../src/research/researchFormValidation.js';
import type { ParsedForm, Field, FieldResponse } from '../../../src/engine/coreTypes.js';

// Create a minimal mock form for testing
// Uses type assertions since we're testing metadata extension behavior
function createMockForm(overrides: Record<string, unknown> = {}): ParsedForm {
  const base = {
    source: '# Test Form',
    sourceWithResponses: '# Test Form',
    metadata: undefined,
    schema: {
      id: 'test',
      title: 'Test Form',
      groups: [],
    },
    responsesByFieldId: {},
  };
  return { ...base, ...overrides } as unknown as ParsedForm;
}

describe('isResearchForm', () => {
  it('returns false for forms without metadata', () => {
    const form = createMockForm({ metadata: undefined });
    expect(isResearchForm(form)).toBe(false);
  });

  it('returns false for forms with empty metadata', () => {
    const form = createMockForm({ metadata: {} });
    expect(isResearchForm(form)).toBe(false);
  });

  it('returns true when webSearchModel is set', () => {
    const form = createMockForm({
      metadata: { webSearchModel: 'openai/gpt-4' },
    });
    expect(isResearchForm(form)).toBe(true);
  });

  it('returns true when enableWebSearch is true', () => {
    const form = createMockForm({
      metadata: { enableWebSearch: true },
    });
    expect(isResearchForm(form)).toBe(true);
  });

  it('returns false when enableWebSearch is false', () => {
    const form = createMockForm({
      metadata: { enableWebSearch: false },
    });
    expect(isResearchForm(form)).toBe(false);
  });

  it('returns false for regular forms without research config', () => {
    const form = createMockForm({
      metadata: { title: 'Regular Form', model: 'anthropic/claude-sonnet' },
    });
    expect(isResearchForm(form)).toBe(false);
  });
});

describe('validateResearchForm', () => {
  it('returns invalid for forms with no fields', () => {
    const form = createMockForm({
      schema: { id: 'empty', title: 'Empty', groups: [] },
      responsesByFieldId: {},
    });
    const result = validateResearchForm(form);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('no fields');
  });

  it('returns valid for forms with fields in groups', () => {
    const mockField: Field = {
      id: 'field1',
      kind: 'string',
      label: 'Field 1',
      required: false,
      priority: 'medium',
      role: 'user',
    };
    const form = createMockForm({
      schema: {
        id: 'test',
        title: 'Test',
        groups: [
          {
            id: 'group1',
            title: 'Group 1',
            children: [mockField],
          },
        ],
      },
      responsesByFieldId: {},
    });
    const result = validateResearchForm(form);
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns valid for forms with responses', () => {
    const mockResponse: FieldResponse = {
      state: 'answered',
      value: { kind: 'string', value: 'test' },
    };
    const form = createMockForm({
      schema: { id: 'test', title: 'Test', groups: [] },
      responsesByFieldId: { field1: mockResponse },
    });
    const result = validateResearchForm(form);
    expect(result.isValid).toBe(true);
  });
});
