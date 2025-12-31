/**
 * Unit tests for agent prompts.
 *
 * These tests verify that the prompts sent to LLMs include documentation
 * for all field types and patch formats. This is critical because if a
 * field type is missing from the prompts, the LLM won't know how to
 * generate the correct patch format (e.g., set_table for table fields).
 */

import { describe, expect, it } from 'vitest';

import {
  PATCH_FORMAT_INSTRUCTIONS,
  getPatchFormatHint,
  PATCH_FORMATS,
} from '../../../src/harness/prompts.js';
import { parseForm } from '../../../src/engine/parse.js';
import { inspect } from '../../../src/engine/inspect.js';
import { applyPatches } from '../../../src/engine/apply.js';

// =============================================================================
// PATCH_FORMAT_INSTRUCTIONS Tests
// =============================================================================

describe('PATCH_FORMAT_INSTRUCTIONS', () => {
  describe('includes all field types', () => {
    const fieldTypes = [
      { kind: 'string', patchOp: 'set_string' },
      { kind: 'number', patchOp: 'set_number' },
      { kind: 'string_list', patchOp: 'set_string_list' },
      { kind: 'single_select', patchOp: 'set_single_select' },
      { kind: 'multi_select', patchOp: 'set_multi_select' },
      { kind: 'checkboxes', patchOp: 'set_checkboxes' },
      { kind: 'url', patchOp: 'set_url' },
      { kind: 'url_list', patchOp: 'set_url_list' },
      { kind: 'date', patchOp: 'set_date' },
      { kind: 'year', patchOp: 'set_year' },
      { kind: 'table', patchOp: 'set_table' },
    ];

    for (const { kind, patchOp } of fieldTypes) {
      it(`includes ${kind} field (${patchOp})`, () => {
        expect(PATCH_FORMAT_INSTRUCTIONS).toContain(kind);
        expect(PATCH_FORMAT_INSTRUCTIONS).toContain(patchOp);
      });
    }
  });

  it('includes skip_field for skipping fields', () => {
    expect(PATCH_FORMAT_INSTRUCTIONS).toContain('skip_field');
    expect(PATCH_FORMAT_INSTRUCTIONS).toContain('skip');
  });

  it('includes table-specific guidance about column IDs', () => {
    // This is critical - LLMs need to know about column IDs for tables
    expect(PATCH_FORMAT_INSTRUCTIONS).toContain('column');
    expect(PATCH_FORMAT_INSTRUCTIONS).toContain('rows');
  });
});

// =============================================================================
// Context Prompt Content Tests
// =============================================================================

describe('Context prompt for table fields', () => {
  // We import the internal buildContextPrompt indirectly through testing inspect issues
  // and verifying what the model would see

  const TABLE_FORM = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="risks" %}

{% field kind="table" id="company_risks" label="Company Risks" required=true
   columnIds=["risk_description", "likelihood", "impact"]
   columnLabels=["Risk", "Likelihood", "Impact"]
   columnTypes=["string", "string", "string"]
   minRows=2 maxRows=5 %}
| Risk | Likelihood | Impact |
|------|------------|--------|
{% /field %}

{% /group %}

{% /form %}
`;

  it('shows field kind as "table" in issues', () => {
    const form = parseForm(TABLE_FORM);
    const result = inspect(form);

    // The issue should reference the table field
    const tableIssue = result.issues.find((i) => i.ref === 'company_risks');
    expect(tableIssue).toBeDefined();
    expect(tableIssue!.scope).toBe('field');

    // Verify the field in schema is kind=table
    const field = form.schema.groups[0]?.children.find((f) => f.id === 'company_risks');
    expect(field).toBeDefined();
    expect(field!.kind).toBe('table');
  });

  it('table field has columns array in schema', () => {
    const form = parseForm(TABLE_FORM);
    const field = form.schema.groups[0]?.children.find((f) => f.id === 'company_risks');

    expect(field).toBeDefined();
    expect(field!.kind).toBe('table');
    if (field!.kind === 'table') {
      expect(field.columns).toHaveLength(3);
      expect(field.columns.map((c) => c.id)).toEqual(['risk_description', 'likelihood', 'impact']);
    }
  });

  it('table field has minRows and maxRows in schema', () => {
    const form = parseForm(TABLE_FORM);
    const field = form.schema.groups[0]?.children.find((f) => f.id === 'company_risks');

    expect(field).toBeDefined();
    expect(field!.kind).toBe('table');
    if (field!.kind === 'table') {
      expect(field.minRows).toBe(2);
      expect(field.maxRows).toBe(5);
    }
  });
});

// =============================================================================
// buildContextPrompt Integration Test
// =============================================================================

describe('buildContextPrompt shows table column info', () => {
  // This tests the logic used by buildContextPrompt indirectly:
  // When a table field issue is shown, the context should include column IDs
  // so the LLM knows how to structure the set_table patch.
  //
  // The actual buildContextPrompt function is internal, but we verify the
  // schema contains the necessary info that would be included in the prompt.

  const TABLE_FORM = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="risks" %}

{% field kind="table" id="company_risks" label="Company Risks" required=true
   columnIds=["risk_description", "likelihood", "impact", "monitoring_signal"]
   columnLabels=["Risk", "Likelihood", "Impact", "Monitoring Signal"]
   columnTypes=["string", "string", "string", "string"]
   minRows=2 maxRows=5 %}
| Risk | Likelihood | Impact | Monitoring Signal |
|------|------------|--------|-------------------|
{% /field %}

{% /group %}

{% /form %}
`;

  it('table field schema contains column IDs for LLM context', () => {
    const form = parseForm(TABLE_FORM);
    const field = form.schema.groups[0]?.children.find((f) => f.id === 'company_risks');

    expect(field).toBeDefined();
    expect(field!.kind).toBe('table');

    // Verify columns have the IDs that buildContextPrompt would show
    if (field!.kind === 'table') {
      const columnIds = field.columns.map((c) => c.id);
      expect(columnIds).toEqual(['risk_description', 'likelihood', 'impact', 'monitoring_signal']);
    }
  });

  it('table field schema contains row constraints for LLM context', () => {
    const form = parseForm(TABLE_FORM);
    const field = form.schema.groups[0]?.children.find((f) => f.id === 'company_risks');

    expect(field).toBeDefined();
    expect(field!.kind).toBe('table');

    // Verify minRows/maxRows that buildContextPrompt would show
    if (field!.kind === 'table') {
      expect(field.minRows).toBe(2);
      expect(field.maxRows).toBe(5);
    }
  });

  it('table field columns can indicate required status', () => {
    // Test that columns can have required status (for future use in context)
    // columnTypes can be objects with {type, required}
    const REQUIRED_COLS_FORM = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="data" %}
{% field kind="table" id="entries" label="Entries" required=true
   columnIds=["required_col", "optional_col"]
   columnLabels=["Required", "Optional"]
   columnTypes=[{type: "string", required: true}, {type: "string", required: false}] %}
| Required | Optional |
|----------|----------|
{% /field %}
{% /group %}
{% /form %}
`;

    const form = parseForm(REQUIRED_COLS_FORM);
    const field = form.schema.groups[0]?.children.find((f) => f.id === 'entries');

    expect(field).toBeDefined();
    expect(field!.kind).toBe('table');

    if (field!.kind === 'table') {
      expect(field.columns[0]?.required).toBe(true);
      expect(field.columns[1]?.required).toBe(false);
    }
  });
});

// =============================================================================
// Regression Test: Missing Field Type Documentation
// =============================================================================

describe('Regression: All supported field kinds documented in prompts', () => {
  // This test ensures we don't accidentally forget to document new field types
  // in the prompts. When a new field type is added, this test should fail
  // until the prompt is updated.

  const SUPPORTED_FIELD_KINDS = [
    'string',
    'number',
    'string_list',
    'single_select',
    'multi_select',
    'checkboxes',
    'url',
    'url_list',
    'date',
    'year',
    'table',
  ];

  it('PATCH_FORMAT_INSTRUCTIONS documents all supported field kinds', () => {
    for (const kind of SUPPORTED_FIELD_KINDS) {
      expect(PATCH_FORMAT_INSTRUCTIONS, `Missing documentation for field kind: ${kind}`).toContain(
        kind,
      );
    }
  });

  it('PATCH_FORMAT_INSTRUCTIONS has set_* operation for each field kind', () => {
    const expectedOps = [
      'set_string',
      'set_number',
      'set_string_list',
      'set_single_select',
      'set_multi_select',
      'set_checkboxes',
      'set_url',
      'set_url_list',
      'set_date',
      'set_year',
      'set_table',
    ];

    for (const op of expectedOps) {
      expect(PATCH_FORMAT_INSTRUCTIONS, `Missing patch operation: ${op}`).toContain(op);
    }
  });
});

// =============================================================================
// PATCH_FORMATS and getPatchFormatHint Tests
// =============================================================================

describe('PATCH_FORMATS', () => {
  it('has an entry for all field types', () => {
    const expectedKinds = [
      'string',
      'number',
      'string_list',
      'single_select',
      'multi_select',
      'checkboxes',
      'url',
      'url_list',
      'date',
      'year',
      'table',
    ];

    for (const kind of expectedKinds) {
      expect(PATCH_FORMATS[kind], `Missing PATCH_FORMATS entry for: ${kind}`).toBeDefined();
    }
  });
});

describe('getPatchFormatHint', () => {
  it('returns format for known field kinds', () => {
    expect(getPatchFormatHint('string')).toContain('set_string');
    expect(getPatchFormatHint('number')).toContain('set_number');
    expect(getPatchFormatHint('table')).toContain('set_table');
  });

  it('substitutes fieldId when provided', () => {
    const hint = getPatchFormatHint('string', 'my_field');
    expect(hint).toContain('fieldId: "my_field"');
  });

  it('substitutes column IDs for table fields', () => {
    const hint = getPatchFormatHint('table', 'ratings_table', ['source', 'score', 'votes']);
    expect(hint).toContain('set_table');
    expect(hint).toContain('ratings_table');
    expect(hint).toContain('"source"');
    expect(hint).toContain('"score"');
    expect(hint).toContain('"votes"');
  });

  it('returns generic message for unknown field kinds', () => {
    const hint = getPatchFormatHint('unknown_kind');
    expect(hint).toContain('correct');
    expect(hint).toContain('set_unknown_kind');
  });
});

// =============================================================================
// Type Mismatch Rejection Feedback Tests
// =============================================================================

describe('Type mismatch rejections include field info', () => {
  const TABLE_FORM = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="data" %}

{% field kind="table" id="ratings_table" label="Ratings" required=true
   columnIds=["source", "score", "votes"]
   columnLabels=["Source", "Score", "Votes"]
   columnTypes=["string", "number", "number"] %}
| Source | Score | Votes |
|--------|-------|-------|
{% /field %}

{% /group %}

{% /form %}
`;

  it('rejection includes fieldId and fieldKind when applying wrong patch type', () => {
    const form = parseForm(TABLE_FORM);

    // Try to apply set_string to a table field
    const result = applyPatches(form, [
      { op: 'set_string', fieldId: 'ratings_table', value: 'wrong patch type' },
    ]);

    expect(result.applyStatus).toBe('rejected');
    expect(result.rejectedPatches).toHaveLength(1);

    const rejection = result.rejectedPatches[0]!;
    expect(rejection.message).toContain('set_string');
    expect(rejection.message).toContain('table');
    expect(rejection.fieldId).toBe('ratings_table');
    expect(rejection.fieldKind).toBe('table');
    expect(rejection.columnIds).toEqual(['source', 'score', 'votes']);
  });

  it('rejection for non-table fields does not include columnIds', () => {
    const STRING_FORM = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="data" %}
{% field kind="string" id="name" label="Name" required=true %}
{% /field %}
{% /group %}
{% /form %}
`;
    const form = parseForm(STRING_FORM);

    // Try to apply set_table to a string field
    const result = applyPatches(form, [
      { op: 'set_table', fieldId: 'name', rows: [{ col1: 'value' }] },
    ]);

    expect(result.applyStatus).toBe('rejected');
    expect(result.rejectedPatches).toHaveLength(1);

    const rejection = result.rejectedPatches[0]!;
    expect(rejection.message).toContain('set_table');
    expect(rejection.message).toContain('string');
    expect(rejection.fieldId).toBe('name');
    expect(rejection.fieldKind).toBe('string');
    expect(rejection.columnIds).toBeUndefined();
  });

  it('getPatchFormatHint generates correct hint for rejected table field', () => {
    const form = parseForm(TABLE_FORM);

    // Try to apply set_string to a table field
    const result = applyPatches(form, [
      { op: 'set_string', fieldId: 'ratings_table', value: 'wrong' },
    ]);

    const rejection = result.rejectedPatches[0]!;

    // Generate hint from rejection info
    const hint = getPatchFormatHint(rejection.fieldKind!, rejection.fieldId, rejection.columnIds);

    // Verify hint includes all the right info
    expect(hint).toContain('set_table');
    expect(hint).toContain('ratings_table');
    expect(hint).toContain('"source"');
    expect(hint).toContain('"score"');
    expect(hint).toContain('"votes"');
  });
});
