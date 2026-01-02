/**
 * Unit tests for MockAgent.
 *
 * Tests the MockAgent's ability to generate patches for various field types.
 */

import { describe, it, expect } from 'vitest';
import { parseForm } from '../../../src/engine/parse.js';
import { MockAgent, createMockAgent } from '../../../src/harness/mockAgent.js';
import type { InspectIssue } from '../../../src/engine/coreTypes.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const DATE_YEAR_FORM = `---
spec: MF/0.1
---
{% form id="date_year_test" %}
{% group id="g1" %}
{% field kind="date" id="birthday" label="Birthday" %}{% /field %}
{% field kind="year" id="grad_year" label="Graduation Year" %}{% /field %}
{% /group %}
{% /form %}
`;

const TABLE_FORM = `---
spec: MF/0.1
---
{% form id="table_test" %}
{% group id="g1" %}
{% field kind="table" id="contacts" label="Contacts" columnIds=["name", "email"] %}
| Name | Email |
|------|-------|
{% /field %}
{% /group %}
{% /form %}
`;

const URL_FORM = `---
spec: MF/0.1
---
{% form id="url_test" %}
{% group id="g1" %}
{% field kind="url" id="website" label="Website" %}{% /field %}
{% field kind="url_list" id="references" label="References" %}{% /field %}
{% /group %}
{% /form %}
`;

const MIXED_FORM = `---
spec: MF/0.1
---
{% form id="mixed_test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}{% /field %}
{% field kind="number" id="age" label="Age" %}{% /field %}
{% field kind="string_list" id="tags" label="Tags" %}{% /field %}
{% field kind="single_select" id="status" label="Status" %}
- [ ] Active {% #active %}
- [ ] Inactive {% #inactive %}
{% /field %}
{% field kind="multi_select" id="roles" label="Roles" %}
- [ ] Admin {% #admin %}
- [ ] User {% #user %}
{% /field %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="simple" %}
- [ ] Task A {% #task_a %}
- [ ] Task B {% #task_b %}
{% /field %}
{% /group %}
{% /form %}
`;

// =============================================================================
// Tests
// =============================================================================

describe('MockAgent', () => {
  describe('date and year fields', () => {
    it('generates set_date patch for date field', async () => {
      const completedForm = parseForm(DATE_YEAR_FORM);
      completedForm.responsesByFieldId.birthday = {
        state: 'answered',
        value: { kind: 'date', value: '1990-05-15' },
      };

      const agent = new MockAgent(completedForm);
      const issues: InspectIssue[] = [
        {
          ref: 'birthday',
          scope: 'field',
          reason: 'optional_unanswered',
          message: 'Test',
          severity: 'recommended',
          priority: 3,
        },
      ];

      const result = await agent.fillFormTool(issues, parseForm(DATE_YEAR_FORM), 10);

      expect(result.patches).toHaveLength(1);
      expect(result.patches[0]).toEqual({
        op: 'set_date',
        fieldId: 'birthday',
        value: '1990-05-15',
      });
    });

    it('generates set_year patch for year field', async () => {
      const completedForm = parseForm(DATE_YEAR_FORM);
      completedForm.responsesByFieldId.grad_year = {
        state: 'answered',
        value: { kind: 'year', value: 2020 },
      };

      const agent = new MockAgent(completedForm);
      const issues: InspectIssue[] = [
        {
          ref: 'grad_year',
          scope: 'field',
          reason: 'optional_unanswered',
          message: 'Test',
          severity: 'recommended',
          priority: 3,
        },
      ];

      const result = await agent.fillFormTool(issues, parseForm(DATE_YEAR_FORM), 10);

      expect(result.patches).toHaveLength(1);
      expect(result.patches[0]).toEqual({
        op: 'set_year',
        fieldId: 'grad_year',
        value: 2020,
      });
    });

    it('skips date field with null value for optional field', async () => {
      const completedForm = parseForm(DATE_YEAR_FORM);
      completedForm.responsesByFieldId.birthday = {
        state: 'answered',
        value: { kind: 'date', value: null },
      };

      const agent = new MockAgent(completedForm);
      const issues: InspectIssue[] = [
        {
          ref: 'birthday',
          scope: 'field',
          reason: 'optional_unanswered',
          message: 'Test',
          severity: 'recommended',
          priority: 3,
        },
      ];

      const result = await agent.fillFormTool(issues, parseForm(DATE_YEAR_FORM), 10);

      expect(result.patches).toHaveLength(1);
      expect(result.patches[0]?.op).toBe('skip_field');
    });
  });

  describe('table fields', () => {
    it('generates set_table patch for table field with rows', async () => {
      const completedForm = parseForm(TABLE_FORM);
      completedForm.responsesByFieldId.contacts = {
        state: 'answered',
        value: {
          kind: 'table',
          rows: [
            {
              name: { state: 'answered', value: 'John' },
              email: { state: 'answered', value: 'john@test.com' },
            },
            {
              name: { state: 'answered', value: 'Jane' },
              email: { state: 'answered', value: 'jane@test.com' },
            },
          ],
        },
      };

      const agent = new MockAgent(completedForm);
      const issues: InspectIssue[] = [
        {
          ref: 'contacts',
          scope: 'field',
          reason: 'optional_unanswered',
          message: 'Test',
          severity: 'recommended',
          priority: 3,
        },
      ];

      const result = await agent.fillFormTool(issues, parseForm(TABLE_FORM), 10);

      expect(result.patches).toHaveLength(1);
      expect(result.patches[0]?.op).toBe('set_table');
      if (result.patches[0]?.op === 'set_table') {
        expect(result.patches[0].value).toHaveLength(2);
        expect(result.patches[0].value[0]).toEqual({ name: 'John', email: 'john@test.com' });
      }
    });

    it('skips table field with no rows for optional field', async () => {
      const completedForm = parseForm(TABLE_FORM);
      completedForm.responsesByFieldId.contacts = {
        state: 'answered',
        value: { kind: 'table', rows: [] },
      };

      const agent = new MockAgent(completedForm);
      const issues: InspectIssue[] = [
        {
          ref: 'contacts',
          scope: 'field',
          reason: 'optional_unanswered',
          message: 'Test',
          severity: 'recommended',
          priority: 3,
        },
      ];

      const result = await agent.fillFormTool(issues, parseForm(TABLE_FORM), 10);

      expect(result.patches).toHaveLength(1);
      expect(result.patches[0]?.op).toBe('skip_field');
    });
  });

  describe('url fields', () => {
    it('generates set_url patch for url field', async () => {
      const completedForm = parseForm(URL_FORM);
      completedForm.responsesByFieldId.website = {
        state: 'answered',
        value: { kind: 'url', value: 'https://example.com' },
      };

      const agent = new MockAgent(completedForm);
      const issues: InspectIssue[] = [
        {
          ref: 'website',
          scope: 'field',
          reason: 'optional_unanswered',
          message: 'Test',
          severity: 'recommended',
          priority: 3,
        },
      ];

      const result = await agent.fillFormTool(issues, parseForm(URL_FORM), 10);

      expect(result.patches).toHaveLength(1);
      expect(result.patches[0]).toEqual({
        op: 'set_url',
        fieldId: 'website',
        value: 'https://example.com',
      });
    });

    it('generates set_url_list patch for url_list field', async () => {
      const completedForm = parseForm(URL_FORM);
      completedForm.responsesByFieldId.references = {
        state: 'answered',
        value: { kind: 'url_list', items: ['https://a.com', 'https://b.com'] },
      };

      const agent = new MockAgent(completedForm);
      const issues: InspectIssue[] = [
        {
          ref: 'references',
          scope: 'field',
          reason: 'optional_unanswered',
          message: 'Test',
          severity: 'recommended',
          priority: 3,
        },
      ];

      const result = await agent.fillFormTool(issues, parseForm(URL_FORM), 10);

      expect(result.patches).toHaveLength(1);
      expect(result.patches[0]).toEqual({
        op: 'set_url_list',
        fieldId: 'references',
        value: ['https://a.com', 'https://b.com'],
      });
    });
  });

  describe('mixed fields', () => {
    it('generates patches for multiple field types', async () => {
      const completedForm = parseForm(MIXED_FORM);
      completedForm.responsesByFieldId.name = {
        state: 'answered',
        value: { kind: 'string', value: 'John' },
      };
      completedForm.responsesByFieldId.age = {
        state: 'answered',
        value: { kind: 'number', value: 30 },
      };
      completedForm.responsesByFieldId.tags = {
        state: 'answered',
        value: { kind: 'string_list', items: ['tag1', 'tag2'] },
      };
      completedForm.responsesByFieldId.status = {
        state: 'answered',
        value: { kind: 'single_select', selected: 'active' },
      };
      completedForm.responsesByFieldId.roles = {
        state: 'answered',
        value: { kind: 'multi_select', selected: ['admin'] },
      };
      completedForm.responsesByFieldId.tasks = {
        state: 'answered',
        value: { kind: 'checkboxes', values: { task_a: 'done', task_b: 'todo' } },
      };

      const agent = new MockAgent(completedForm);
      const issues: InspectIssue[] = [
        {
          ref: 'name',
          scope: 'field',
          reason: 'required_missing',
          message: 'Test',
          severity: 'required',
          priority: 1,
        },
        {
          ref: 'age',
          scope: 'field',
          reason: 'optional_unanswered',
          message: 'Test',
          severity: 'recommended',
          priority: 3,
        },
        {
          ref: 'tags',
          scope: 'field',
          reason: 'optional_unanswered',
          message: 'Test',
          severity: 'recommended',
          priority: 3,
        },
        {
          ref: 'status',
          scope: 'field',
          reason: 'optional_unanswered',
          message: 'Test',
          severity: 'recommended',
          priority: 3,
        },
        {
          ref: 'roles',
          scope: 'field',
          reason: 'optional_unanswered',
          message: 'Test',
          severity: 'recommended',
          priority: 3,
        },
        {
          ref: 'tasks',
          scope: 'field',
          reason: 'optional_unanswered',
          message: 'Test',
          severity: 'recommended',
          priority: 3,
        },
      ];

      const result = await agent.fillFormTool(issues, parseForm(MIXED_FORM), 10);

      expect(result.patches).toHaveLength(6);
      expect(result.patches.map((p) => p.op)).toEqual([
        'set_string',
        'set_number',
        'set_string_list',
        'set_single_select',
        'set_multi_select',
        'set_checkboxes',
      ]);
    });

    it('respects maxPatches limit', async () => {
      const completedForm = parseForm(MIXED_FORM);
      completedForm.responsesByFieldId.name = {
        state: 'answered',
        value: { kind: 'string', value: 'John' },
      };
      completedForm.responsesByFieldId.age = {
        state: 'answered',
        value: { kind: 'number', value: 30 },
      };
      completedForm.responsesByFieldId.tags = {
        state: 'answered',
        value: { kind: 'string_list', items: ['tag1'] },
      };

      const agent = new MockAgent(completedForm);
      const issues: InspectIssue[] = [
        {
          ref: 'name',
          scope: 'field',
          reason: 'required_missing',
          message: 'Test',
          severity: 'required',
          priority: 1,
        },
        {
          ref: 'age',
          scope: 'field',
          reason: 'optional_unanswered',
          message: 'Test',
          severity: 'recommended',
          priority: 3,
        },
        {
          ref: 'tags',
          scope: 'field',
          reason: 'optional_unanswered',
          message: 'Test',
          severity: 'recommended',
          priority: 3,
        },
      ];

      const result = await agent.fillFormTool(issues, parseForm(MIXED_FORM), 2);

      expect(result.patches).toHaveLength(2);
    });

    it('skips non-field issues', async () => {
      const completedForm = parseForm(MIXED_FORM);
      completedForm.responsesByFieldId.name = {
        state: 'answered',
        value: { kind: 'string', value: 'John' },
      };

      const agent = new MockAgent(completedForm);
      const issues: InspectIssue[] = [
        {
          ref: 'g1',
          scope: 'group',
          reason: 'validation_error',
          message: 'Test',
          severity: 'required',
          priority: 1,
        },
        {
          ref: 'name',
          scope: 'field',
          reason: 'required_missing',
          message: 'Test',
          severity: 'required',
          priority: 1,
        },
      ];

      const result = await agent.fillFormTool(issues, parseForm(MIXED_FORM), 10);

      expect(result.patches).toHaveLength(1);
      expect(result.patches[0]?.op).toBe('set_string');
    });

    it('skips unknown field IDs', async () => {
      const completedForm = parseForm(MIXED_FORM);
      completedForm.responsesByFieldId.name = {
        state: 'answered',
        value: { kind: 'string', value: 'John' },
      };

      const agent = new MockAgent(completedForm);
      const issues: InspectIssue[] = [
        {
          ref: 'nonexistent',
          scope: 'field',
          reason: 'required_missing',
          message: 'Test',
          severity: 'required',
          priority: 1,
        },
        {
          ref: 'name',
          scope: 'field',
          reason: 'required_missing',
          message: 'Test',
          severity: 'required',
          priority: 1,
        },
      ];

      const result = await agent.fillFormTool(issues, parseForm(MIXED_FORM), 10);

      expect(result.patches).toHaveLength(1);
      expect(result.patches[0]?.op).toBe('set_string');
    });

    it('skips already addressed fields', async () => {
      const completedForm = parseForm(MIXED_FORM);
      completedForm.responsesByFieldId.name = {
        state: 'answered',
        value: { kind: 'string', value: 'John' },
      };

      const agent = new MockAgent(completedForm);
      const issues: InspectIssue[] = [
        {
          ref: 'name',
          scope: 'field',
          reason: 'required_missing',
          message: 'Test1',
          severity: 'required',
          priority: 1,
        },
        {
          ref: 'name',
          scope: 'field',
          reason: 'validation_error',
          message: 'Test2',
          severity: 'required',
          priority: 2,
        },
      ];

      const result = await agent.fillFormTool(issues, parseForm(MIXED_FORM), 10);

      // Should only generate one patch for 'name', not two
      expect(result.patches).toHaveLength(1);
    });
  });

  describe('createMockAgent factory', () => {
    it('creates a MockAgent instance', () => {
      const completedForm = parseForm(MIXED_FORM);
      const agent = createMockAgent(completedForm);

      expect(agent).toBeInstanceOf(MockAgent);
    });
  });
});
