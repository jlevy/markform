/**
 * Tests for RejectionMockAgent.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  createRejectionMockAgent,
  RejectionMockAgent,
} from '../../../src/harness/rejectionMockAgent.js';
import { parseForm } from '../../../src/engine/parse.js';
import type { InspectIssue, ParsedForm, PatchRejection } from '../../../src/engine/coreTypes.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const FILLED_FORM = `---
markform:
  spec: "MF/0.1"
  title: Test Form
---

{% form id="test" title="Test Form" %}

{% group id="main" title="Main" %}

{% field kind="string" id="name" label="Name" role="user" required=true %}
\`\`\`value
Alice
\`\`\`
{% /field %}

{% field kind="table" id="data" label="Data" role="user" required=true
   columnIds=["col_name", "col_value"]
   columnTypes=["string", "number"] %}
| Name | Value |
|------|-------|
| Row1 | 100 |
{% /field %}

{% /group %}

{% /form %}
`;

const EMPTY_FORM = `---
markform:
  spec: "MF/0.1"
  title: Test Form
---

{% form id="test" title="Test Form" %}

{% group id="main" title="Main" %}

{% field kind="string" id="name" label="Name" role="user" required=true %}{% /field %}

{% field kind="table" id="data" label="Data" role="user" required=true
   columnIds=["col_name", "col_value"]
   columnTypes=["string", "number"] %}
| Name | Value |
|------|-------|
{% /field %}

{% /group %}

{% /form %}
`;

// Helper to create a field issue
function fieldIssue(fieldId: string): InspectIssue {
  return {
    ref: fieldId,
    scope: 'field',
    reason: 'required_missing',
    message: 'Required field is empty',
    severity: 'required',
    priority: 1,
  };
}

// Helper to create a form-level issue
function formIssue(): InspectIssue {
  return {
    ref: 'test',
    scope: 'form',
    reason: 'optional_unanswered',
    message: 'Form is incomplete',
    severity: 'recommended',
    priority: 10,
  };
}

describe('RejectionMockAgent', () => {
  let completedForm: ParsedForm;
  let emptyForm: ParsedForm;

  beforeAll(() => {
    completedForm = parseForm(FILLED_FORM);
    emptyForm = parseForm(EMPTY_FORM);
  });

  describe('createRejectionMockAgent', () => {
    it('creates an agent instance', () => {
      const agent = createRejectionMockAgent(completedForm);
      expect(agent).toBeInstanceOf(RejectionMockAgent);
    });
  });

  describe('generatePatches', () => {
    it('generates wrong patch type for table field on first attempt', async () => {
      const agent = createRejectionMockAgent(completedForm);
      const response = await agent.generatePatches([fieldIssue('data')], emptyForm, 10);

      expect(response.patches).toHaveLength(1);
      // First attempt should be set_string (wrong) for table field
      expect(response.patches[0]?.op).toBe('set_string');
      // Access fieldId via type narrowing
      const patch = response.patches[0];
      if (patch && 'fieldId' in patch) {
        expect(patch.fieldId).toBe('data');
      }
    });

    it('generates correct patch after rejection feedback', async () => {
      const agent = createRejectionMockAgent(completedForm);

      // First call - gets wrong patch
      await agent.generatePatches([fieldIssue('data')], emptyForm, 10);

      // Second call with rejection feedback
      const rejections: PatchRejection[] = [
        {
          patchIndex: 0,
          message: 'Type mismatch',
          fieldId: 'data',
          fieldKind: 'table',
          columnIds: ['col_name', 'col_value'],
        },
      ];

      const response = await agent.generatePatches([fieldIssue('data')], emptyForm, 10, rejections);

      expect(response.patches).toHaveLength(1);
      // After rejection, should generate correct set_table patch
      expect(response.patches[0]?.op).toBe('set_table');
      const patch = response.patches[0];
      if (patch && 'fieldId' in patch) {
        expect(patch.fieldId).toBe('data');
      }
    });

    it('generates correct patch for non-table fields immediately', async () => {
      const agent = createRejectionMockAgent(completedForm);
      const response = await agent.generatePatches([fieldIssue('name')], emptyForm, 10);

      expect(response.patches).toHaveLength(1);
      // Non-table fields should get correct patch immediately
      expect(response.patches[0]?.op).toBe('set_string');
      const patch = response.patches[0];
      if (patch?.op === 'set_string') {
        expect(patch.fieldId).toBe('name');
        expect(patch.value).toBe('Alice');
      }
    });

    it('skips non-field issues', async () => {
      const agent = createRejectionMockAgent(completedForm);
      const response = await agent.generatePatches([formIssue()], emptyForm, 10);

      expect(response.patches).toHaveLength(0);
    });

    it('respects maxPatches limit', async () => {
      const agent = createRejectionMockAgent(completedForm);
      const issues: InspectIssue[] = [fieldIssue('name'), fieldIssue('data')];

      const response = await agent.generatePatches(issues, emptyForm, 1);

      expect(response.patches).toHaveLength(1);
    });
  });
});
