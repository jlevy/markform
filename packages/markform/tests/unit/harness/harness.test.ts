/**
 * Tests for the Form Harness.
 */

import { describe, expect, it } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';
import { createHarness, FormHarness } from '../../../src/harness/harness.js';
import { createMockAgent } from '../../../src/harness/mockAgent.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const SIMPLE_FORM = `---
markform:
  spec: MF/0.1
---

{% form id="test_form" %}

{% group id="basics" %}

{% field kind="string" id="name" label="Name" required=true %}{% /field %}

{% field kind="number" id="age" label="Age" required=true %}{% /field %}

{% /group %}

{% /form %}
`;

const FILLED_FORM = `---
markform:
  spec: MF/0.1
---

{% form id="test_form" %}

{% group id="basics" %}

{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
John Doe
\`\`\`
{% /field %}

{% field kind="number" id="age" label="Age" required=true %}
\`\`\`value
30
\`\`\`
{% /field %}

{% /group %}

{% /form %}
`;

// Table field form fixtures for testing patch type mismatch
const TABLE_FIELD_FORM = `---
markform:
  spec: MF/0.1
---

{% form id="test_form" %}

{% group id="risks" %}

{% field kind="table" id="company_risks" label="Company Risks" required=true
   columnIds=["risk_description", "likelihood", "impact"]
   columnLabels=["Risk", "Likelihood", "Impact"]
   columnTypes=["string", "string", "string"]
   minRows=1 maxRows=5 %}
| Risk | Likelihood | Impact |
|------|------------|--------|
{% /field %}

{% /group %}

{% /form %}
`;

const TABLE_FIELD_FORM_FILLED = `---
markform:
  spec: MF/0.1
---

{% form id="test_form" %}

{% group id="risks" %}

{% field kind="table" id="company_risks" label="Company Risks" required=true
   columnIds=["risk_description", "likelihood", "impact"]
   columnLabels=["Risk", "Likelihood", "Impact"]
   columnTypes=["string", "string", "string"]
   minRows=1 maxRows=5 %}
| Risk | Likelihood | Impact |
|------|------------|--------|
| Market volatility | High | Significant |
| Customer concentration | Medium | Moderate |
{% /field %}

{% /group %}

{% /form %}
`;

// =============================================================================
// Harness Tests
// =============================================================================

describe('FormHarness', () => {
  describe('creation', () => {
    it('creates harness with default config', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      expect(harness).toBeInstanceOf(FormHarness);
      expect(harness.getState()).toBe('init');
      expect(harness.getTurnNumber()).toBe(0);
    });

    it('creates harness with custom config', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form, {
        maxTurns: 5,
        maxPatchesPerTurn: 3,
      });

      expect(harness).toBeInstanceOf(FormHarness);
    });
  });

  describe('step', () => {
    it('returns step result with issues', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      const result = harness.step();

      expect(result.turnNumber).toBe(1);
      expect(result.isComplete).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.structureSummary.fieldCount).toBe(2);
    });

    it('transitions to wait state after step', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      harness.step();

      expect(harness.getState()).toBe('wait');
    });

    it('increments turn number on each step', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      harness.step();
      expect(harness.getTurnNumber()).toBe(1);

      // Apply empty patches to transition back
      harness.apply([], []);
      harness.step();
      expect(harness.getTurnNumber()).toBe(2);
    });
  });

  describe('apply', () => {
    it('applies valid patches', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      const stepResult = harness.step();

      const result = harness.apply(
        [
          { op: 'set_string', fieldId: 'name', value: 'Test' },
          { op: 'set_number', fieldId: 'age', value: 25 },
        ],
        stepResult.issues,
      );

      expect(result.isComplete).toBe(true);
    });

    it('throws when not in wait state', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      expect(() => harness.apply([], [])).toThrow('Cannot apply in state');
    });

    it('throws when too many patches', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form, { maxPatchesPerTurn: 1 });

      harness.step();

      expect(() =>
        harness.apply(
          [
            { op: 'set_string', fieldId: 'name', value: 'Test' },
            { op: 'set_number', fieldId: 'age', value: 25 },
          ],
          [],
        ),
      ).toThrow('Too many patches');
    });

    it('records turns', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      const stepResult = harness.step();
      harness.apply([{ op: 'set_string', fieldId: 'name', value: 'Test' }], stepResult.issues);

      const turns = harness.getTurns();
      expect(turns.length).toBe(1);
      expect(turns[0]?.turn).toBe(1);
      expect(turns[0]?.apply.patches.length).toBe(1);
    });

    it('reports patchesApplied count and empty rejectedPatches on success', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      const stepResult = harness.step();
      const result = harness.apply(
        [
          { op: 'set_string', fieldId: 'name', value: 'Test' },
          { op: 'set_number', fieldId: 'age', value: 25 },
        ],
        stepResult.issues,
      );

      expect(result.patchesApplied).toBe(2);
      expect(result.rejectedPatches).toEqual([]);
    });

    it('reports patchesApplied=0 and rejectedPatches with details when patches fail validation', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      const stepResult = harness.step();
      // Wrong type: applying string to number field should fail
      const result = harness.apply(
        [{ op: 'set_string', fieldId: 'age', value: 'not a number' }],
        stepResult.issues,
      );

      expect(result.patchesApplied).toBe(0);
      expect(result.rejectedPatches).toHaveLength(1);
      expect(result.rejectedPatches![0]!.patchIndex).toBe(0);
      expect(result.rejectedPatches![0]!.message).toContain(
        'Cannot apply set_string to number field',
      );
    });

    it('reports patchesApplied=0 and rejectedPatches when field does not exist', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      const stepResult = harness.step();
      const result = harness.apply(
        [{ op: 'set_string', fieldId: 'nonexistent', value: 'test' }],
        stepResult.issues,
      );

      expect(result.patchesApplied).toBe(0);
      expect(result.rejectedPatches).toHaveLength(1);
      expect(result.rejectedPatches![0]!.message).toContain('nonexistent');
    });
  });

  describe('completion', () => {
    it('detects complete form', () => {
      const form = parseForm(FILLED_FORM);
      const harness = createHarness(form);

      const result = harness.step();

      expect(result.isComplete).toBe(true);
      expect(harness.getState()).toBe('complete');
    });

    it('throws on step after complete', () => {
      const form = parseForm(FILLED_FORM);
      const harness = createHarness(form);

      harness.step(); // Completes

      expect(() => harness.step()).toThrow('Harness is complete');
    });
  });

  describe('max turns', () => {
    it('enforces max turns limit', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form, { maxTurns: 2 });

      // First turn
      harness.step();
      expect(harness.getTurnNumber()).toBe(1);
      harness.apply([], []);

      // Second turn
      harness.step();
      expect(harness.getTurnNumber()).toBe(2);

      // After second step with maxTurns=2, state should be wait still
      // but after apply, should transition to complete
      harness.apply([], []);
      expect(harness.getState()).toBe('complete');
      expect(harness.hasReachedMaxTurns()).toBe(true);
    });
  });

  describe('getMarkdown', () => {
    it('returns serialized form', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      const markdown = harness.getMarkdown();

      expect(markdown).toContain('{% form');
      expect(markdown).toContain('{% field kind="string"');
    });
  });

  describe('getMarkdownHash', () => {
    it('returns consistent hash', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      const hash1 = harness.getMarkdownHash();
      const hash2 = harness.getMarkdownHash();

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA256 hex
    });
  });

  describe('issue filtering', () => {
    // Form with 2 groups, 3 fields each (6 required fields total)
    const MULTI_GROUP_FORM = `---
markform:
  spec: MF/0.1
---

{% form id="test_form" %}

{% group id="group_a" %}
{% field kind="string" id="field_a1" label="A1" required=true %}{% /field %}
{% field kind="string" id="field_a2" label="A2" required=true %}{% /field %}
{% field kind="string" id="field_a3" label="A3" required=true %}{% /field %}
{% /group %}

{% group id="group_b" %}
{% field kind="string" id="field_b1" label="B1" required=true %}{% /field %}
{% field kind="string" id="field_b2" label="B2" required=true %}{% /field %}
{% field kind="string" id="field_b3" label="B3" required=true %}{% /field %}
{% /group %}

{% /form %}
`;

    it('limits issues by maxFieldsPerTurn', () => {
      const form = parseForm(MULTI_GROUP_FORM);
      const harness = createHarness(form, { maxFieldsPerTurn: 2 });

      const result = harness.step();

      // Should have at most 2 unique fields in the issues
      const fieldIds = new Set(result.issues.filter((i) => i.scope === 'field').map((i) => i.ref));
      expect(fieldIds.size).toBeLessThanOrEqual(2);
    });

    it('limits issues by maxGroupsPerTurn', () => {
      const form = parseForm(MULTI_GROUP_FORM);
      const harness = createHarness(form, { maxGroupsPerTurn: 1 });

      const result = harness.step();

      // Get unique group IDs from the field issues
      const fieldRefs = result.issues.filter((i) => i.scope === 'field').map((i) => i.ref);

      // Map field refs to their parent groups using the form's idIndex
      const groupIds = new Set<string>();
      for (const ref of fieldRefs) {
        const entry = form.idIndex.get(ref);
        if (entry?.parentId) {
          groupIds.add(entry.parentId);
        }
      }

      // Should only have fields from 1 group
      expect(groupIds.size).toBeLessThanOrEqual(1);
    });

    it('applies both field and group limits together', () => {
      const form = parseForm(MULTI_GROUP_FORM);
      const harness = createHarness(form, {
        maxGroupsPerTurn: 1,
        maxFieldsPerTurn: 2,
      });

      const result = harness.step();

      const fieldRefs = result.issues.filter((i) => i.scope === 'field').map((i) => i.ref);

      // Should have at most 2 fields from 1 group
      expect(fieldRefs.length).toBeLessThanOrEqual(2);
    });

    it('applies maxIssuesPerTurn after field/group filtering', () => {
      const form = parseForm(MULTI_GROUP_FORM);
      const harness = createHarness(form, {
        maxFieldsPerTurn: 5, // Would allow 5 fields
        maxIssuesPerTurn: 2, // But cap at 2 issues total
      });

      const result = harness.step();

      expect(result.issues.length).toBeLessThanOrEqual(2);
    });
  });
});

// =============================================================================
// Mock Agent Tests
// =============================================================================

describe('MockAgent', () => {
  it('generates patches from completed form', async () => {
    const emptyForm = parseForm(SIMPLE_FORM);
    const filledForm = parseForm(FILLED_FORM);
    const agent = createMockAgent(filledForm);

    // Create fake issues for the empty fields
    const issues = [
      {
        ref: 'name',
        scope: 'field' as const,
        reason: 'required_missing' as const,
        message: 'Required field is empty',
        severity: 'required' as const,
        priority: 1,
      },
      {
        ref: 'age',
        scope: 'field' as const,
        reason: 'required_missing' as const,
        message: 'Required field is empty',
        severity: 'required' as const,
        priority: 2,
      },
    ];

    const response = await agent.fillFormTool(issues, emptyForm, 10);

    expect(response.patches.length).toBe(2);
    expect(response.patches[0]).toEqual({
      op: 'set_string',
      fieldId: 'name',
      value: 'John Doe',
    });
    expect(response.patches[1]).toEqual({
      op: 'set_number',
      fieldId: 'age',
      value: 30,
    });
  });

  it('respects maxPatches limit', async () => {
    const emptyForm = parseForm(SIMPLE_FORM);
    const filledForm = parseForm(FILLED_FORM);
    const agent = createMockAgent(filledForm);

    const issues = [
      {
        ref: 'name',
        scope: 'field' as const,
        reason: 'required_missing' as const,
        message: 'Required field is empty',
        severity: 'required' as const,
        priority: 1,
      },
      {
        ref: 'age',
        scope: 'field' as const,
        reason: 'required_missing' as const,
        message: 'Required field is empty',
        severity: 'required' as const,
        priority: 2,
      },
    ];

    const response = await agent.fillFormTool(issues, emptyForm, 1);

    expect(response.patches.length).toBe(1);
  });

  it('skips non-field issues', async () => {
    const emptyForm = parseForm(SIMPLE_FORM);
    const filledForm = parseForm(FILLED_FORM);
    const agent = createMockAgent(filledForm);

    const issues = [
      {
        ref: 'test_form',
        scope: 'form' as const,
        reason: 'validation_error' as const,
        message: 'Form error',
        severity: 'required' as const,
        priority: 1,
      },
    ];

    const response = await agent.fillFormTool(issues, emptyForm, 10);

    expect(response.patches.length).toBe(0);
  });

  it('generates patches for url fields', async () => {
    const URL_FORM_EMPTY = `---
markform:
  spec: MF/0.1
---

{% form id="test_form" %}

{% group id="urls" %}

{% field kind="url" id="website" label="Website" required=true %}{% /field %}

{% field kind="url_list" id="sources" label="Sources" required=true %}{% /field %}

{% /group %}

{% /form %}
`;

    const URL_FORM_FILLED = `---
markform:
  spec: MF/0.1
---

{% form id="test_form" %}

{% group id="urls" %}

{% field kind="url" id="website" label="Website" required=true %}
\`\`\`value
https://example.com
\`\`\`
{% /field %}

{% field kind="url_list" id="sources" label="Sources" required=true %}
\`\`\`value
https://docs.example.com
https://github.com/example
\`\`\`
{% /field %}

{% /group %}

{% /form %}
`;

    const emptyForm = parseForm(URL_FORM_EMPTY);
    const filledForm = parseForm(URL_FORM_FILLED);
    const agent = createMockAgent(filledForm);

    const issues = [
      {
        ref: 'website',
        scope: 'field' as const,
        reason: 'required_missing' as const,
        message: 'Required field is empty',
        severity: 'required' as const,
        priority: 1,
      },
      {
        ref: 'sources',
        scope: 'field' as const,
        reason: 'required_missing' as const,
        message: 'Required field is empty',
        severity: 'required' as const,
        priority: 2,
      },
    ];

    const response = await agent.fillFormTool(issues, emptyForm, 10);

    expect(response.patches.length).toBe(2);
    expect(response.patches[0]).toEqual({
      op: 'set_url',
      fieldId: 'website',
      value: 'https://example.com',
    });
    expect(response.patches[1]).toEqual({
      op: 'set_url_list',
      fieldId: 'sources',
      items: ['https://docs.example.com', 'https://github.com/example'],
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Harness + MockAgent Integration', () => {
  it('fills form to completion using mock agent', async () => {
    const emptyForm = parseForm(SIMPLE_FORM);
    const filledForm = parseForm(FILLED_FORM);

    const harness = createHarness(emptyForm);
    const agent = createMockAgent(filledForm);

    // First step
    let result = harness.step();
    expect(result.isComplete).toBe(false);

    // Generate and apply patches
    const response = await agent.fillFormTool(result.issues, emptyForm, 10);
    result = harness.apply(response.patches, result.issues);

    expect(result.isComplete).toBe(true);
    expect(harness.getState()).toBe('complete');

    // Verify turns recorded
    const turns = harness.getTurns();
    expect(turns.length).toBe(1);
    expect(turns[0]?.apply.patches.length).toBe(2);
  });
});

// =============================================================================
// Fill Mode Tests
// =============================================================================

describe('fillMode', () => {
  describe('continue mode (default)', () => {
    it('skips filled fields - form is immediately complete', () => {
      const form = parseForm(FILLED_FORM);
      const harness = createHarness(form);

      const result = harness.step();

      // Form is already complete with filled fields
      expect(result.isComplete).toBe(true);
      expect(result.issues.filter((i) => i.severity === 'required').length).toBe(0);
    });

    it('explicitly setting continue mode behaves same as default', () => {
      const form = parseForm(FILLED_FORM);
      const harness = createHarness(form, { fillMode: 'continue' });

      const result = harness.step();

      // Form is already complete with filled fields
      expect(result.isComplete).toBe(true);
    });
  });

  describe('overwrite mode', () => {
    it('clears target role fields on first step', () => {
      const form = parseForm(FILLED_FORM);
      const harness = createHarness(form, { fillMode: 'overwrite' });

      const result = harness.step();

      // Fields should have been cleared, so form is NOT complete
      expect(result.isComplete).toBe(false);
      // Should have issues for the cleared fields
      const requiredIssues = result.issues.filter((i) => i.severity === 'required');
      expect(requiredIssues.length).toBe(2); // name and age
    });

    it('allows re-filling cleared fields', async () => {
      const emptyForm = parseForm(SIMPLE_FORM);
      const filledForm = parseForm(FILLED_FORM);

      // Start with a filled form in overwrite mode
      const harness = createHarness(parseForm(FILLED_FORM), { fillMode: 'overwrite' });
      const agent = createMockAgent(filledForm);

      // First step - fields should be cleared
      let result = harness.step();
      expect(result.isComplete).toBe(false);

      // Generate and apply patches to re-fill
      const response = await agent.fillFormTool(result.issues, emptyForm, 10);
      result = harness.apply(response.patches, result.issues);

      // Form should be complete again
      expect(result.isComplete).toBe(true);
    });

    it('respects targetRoles when clearing', () => {
      // Form with mixed roles
      const MIXED_ROLE_FORM = `---
markform:
  spec: MF/0.1
  roles:
    - agent
    - user
  role_instructions:
    agent: Fill the agent fields
    user: Fill the user fields
---

{% form id="test_form" %}

{% group id="basics" %}

{% field kind="string" id="agent_field" label="Agent Field" required=true role="agent" %}
\`\`\`value
Agent Value
\`\`\`
{% /field %}

{% field kind="string" id="user_field" label="User Field" required=true role="user" %}
\`\`\`value
User Value
\`\`\`
{% /field %}

{% /group %}

{% /form %}
`;

      const form = parseForm(MIXED_ROLE_FORM);
      const harness = createHarness(form, {
        fillMode: 'overwrite',
        targetRoles: ['agent'],
      });

      const result = harness.step();

      // Only agent_field should have been cleared and reported as needing fill
      // user_field should be untouched
      const requiredIssues = result.issues.filter((i) => i.severity === 'required');
      expect(requiredIssues.length).toBe(1);
      expect(requiredIssues[0]?.ref).toBe('agent_field');

      // Verify that user_field still has its value
      const userResponse = form.responsesByFieldId.user_field;
      expect(userResponse?.value?.kind).toBe('string');
      if (userResponse?.value?.kind === 'string') {
        expect(userResponse.value.value).toBe('User Value');
      }
    });
  });
});

// =============================================================================
// Table Field Tests (patch type mismatch reproduction - markform issue)
// =============================================================================

describe('Table field patch handling', () => {
  describe('patch type validation', () => {
    it('rejects set_string patch on table field with clear error message', () => {
      const form = parseForm(TABLE_FIELD_FORM);
      const harness = createHarness(form);

      const stepResult = harness.step();

      // Simulate what an LLM might incorrectly generate - using set_string on a table field
      // This reproduces the real-world issue where models generate wrong patch types
      const result = harness.apply(
        [
          {
            op: 'set_string',
            fieldId: 'company_risks',
            value: 'Market volatility | High | Significant',
          },
        ],
        stepResult.issues,
      );

      expect(result.patchesApplied).toBe(0);
      expect(result.rejectedPatches).toHaveLength(1);
      expect(result.rejectedPatches![0]!.message).toContain(
        'Cannot apply set_string to table field',
      );
      expect(result.rejectedPatches![0]!.message).toContain('company_risks');
    });

    it('accepts set_table patch on table field', () => {
      const form = parseForm(TABLE_FIELD_FORM);
      const harness = createHarness(form);

      const stepResult = harness.step();

      // Correct patch format for table fields
      const result = harness.apply(
        [
          {
            op: 'set_table',
            fieldId: 'company_risks',
            rows: [
              {
                risk_description: 'Market volatility',
                likelihood: 'High',
                impact: 'Significant',
              },
              {
                risk_description: 'Customer concentration',
                likelihood: 'Medium',
                impact: 'Moderate',
              },
            ],
          },
        ],
        stepResult.issues,
      );

      expect(result.patchesApplied).toBe(1);
      expect(result.rejectedPatches).toEqual([]);
      expect(result.isComplete).toBe(true);
    });
  });

  describe('MockAgent generates correct table patches', () => {
    it('generates set_table patch from filled table form', async () => {
      const emptyForm = parseForm(TABLE_FIELD_FORM);
      const filledForm = parseForm(TABLE_FIELD_FORM_FILLED);
      const agent = createMockAgent(filledForm);

      const issues = [
        {
          ref: 'company_risks',
          scope: 'field' as const,
          reason: 'required_missing' as const,
          message: 'Required table field is empty',
          severity: 'required' as const,
          priority: 1,
        },
      ];

      const response = await agent.fillFormTool(issues, emptyForm, 10);

      expect(response.patches.length).toBe(1);
      expect(response.patches[0]!.op).toBe('set_table');
      if (response.patches[0]!.op === 'set_table') {
        expect(response.patches[0].rows).toHaveLength(2);
        expect(response.patches[0].rows[0]).toMatchObject({
          risk_description: 'Market volatility',
          likelihood: 'High',
          impact: 'Significant',
        });
      }
    });
  });

  describe('Harness + MockAgent integration with table fields', () => {
    it('fills table form to completion using mock agent', async () => {
      const emptyForm = parseForm(TABLE_FIELD_FORM);
      const filledForm = parseForm(TABLE_FIELD_FORM_FILLED);

      const harness = createHarness(emptyForm);
      const agent = createMockAgent(filledForm);

      // First step
      let result = harness.step();
      expect(result.isComplete).toBe(false);

      // Generate and apply patches
      const response = await agent.fillFormTool(result.issues, emptyForm, 10);
      expect(response.patches[0]!.op).toBe('set_table');

      result = harness.apply(response.patches, result.issues);

      expect(result.isComplete).toBe(true);
      expect(harness.getState()).toBe('complete');
    });
  });
});
