/**
 * Unit tests for inspect.ts helper functions.
 *
 * Tests the exported helper functions for field lookup, role filtering,
 * and blocking checkpoint detection.
 */

import { describe, it, expect } from 'vitest';
import { parseForm } from '../../../src/engine/parse';
import {
  getAllFields,
  findFieldById,
  getFieldsForRoles,
  isCheckboxComplete,
  findBlockingCheckpoint,
  getBlockedFieldIds,
  filterIssuesByRole,
} from '../../../src/engine/inspect';
import type { InspectIssue } from '../../../src/engine/coreTypes';

// =============================================================================
// Test Fixtures
// =============================================================================

const ROLE_FORM = `---
spec: MF/0.1
---
{% form id="role_test" %}
{% group id="g1" %}
{% field kind="string" id="agent_field" label="Agent Field" role="agent" %}{% /field %}
{% field kind="string" id="user_field" label="User Field" role="user" %}{% /field %}
{% field kind="string" id="default_field" label="Default Field" %}{% /field %}
{% /group %}
{% /form %}
`;

const CHECKBOX_FORM = `---
spec: MF/0.1
---
{% form id="checkbox_test" %}
{% group id="g1" %}
{% field kind="checkboxes" id="simple_cb" label="Simple Checkboxes" checkboxMode="simple" %}
- [ ] Option A {% #opt_a %}
- [ ] Option B {% #opt_b %}
{% /field %}
{% field kind="checkboxes" id="explicit_cb" label="Explicit Checkboxes" checkboxMode="explicit" %}
- [ ] Yes/No A {% #yn_a %}
- [ ] Yes/No B {% #yn_b %}
{% /field %}
{% field kind="checkboxes" id="multi_cb" label="Multi Checkboxes" checkboxMode="multi" %}
- [ ] Task A {% #task_a %}
- [ ] Task B {% #task_b %}
{% /field %}
{% /group %}
{% /form %}
`;

const BLOCKING_FORM = `---
spec: MF/0.1
---
{% form id="blocking_test" %}
{% group id="g1" %}
{% field kind="string" id="before_approval" label="Before Approval" %}{% /field %}
{% field kind="checkboxes" id="approval" label="Approval" checkboxMode="simple" approvalMode="blocking" %}
- [ ] Approve {% #approve %}
{% /field %}
{% field kind="string" id="after_approval" label="After Approval" %}{% /field %}
{% /group %}
{% /form %}
`;

const MULTI_FIELD_FORM = `---
spec: MF/0.1
---
{% form id="multi_test" %}
{% group id="g1" title="Group 1" %}
{% field kind="string" id="field1" label="Field 1" %}{% /field %}
{% field kind="number" id="field2" label="Field 2" %}{% /field %}
{% /group %}
{% group id="g2" title="Group 2" %}
{% field kind="string" id="field3" label="Field 3" required=true %}{% /field %}
{% /group %}
{% /form %}
`;

// =============================================================================
// getAllFields Tests
// =============================================================================

describe('getAllFields', () => {
  it('returns all fields from all groups', () => {
    const form = parseForm(MULTI_FIELD_FORM);
    const fields = getAllFields(form);

    expect(fields).toHaveLength(3);
    expect(fields.map((f) => f.id)).toEqual(['field1', 'field2', 'field3']);
  });

  it('returns empty array for form with no fields', () => {
    const emptyFormMd = `---
spec: MF/0.1
---
{% form id="empty" %}
{% group id="g1" %}
{% /group %}
{% /form %}
`;
    const form = parseForm(emptyFormMd);
    const fields = getAllFields(form);

    expect(fields).toEqual([]);
  });

  it('preserves field order across groups', () => {
    const form = parseForm(MULTI_FIELD_FORM);
    const fields = getAllFields(form);

    // Fields should be in document order
    expect(fields[0]?.id).toBe('field1');
    expect(fields[1]?.id).toBe('field2');
    expect(fields[2]?.id).toBe('field3');
  });
});

// =============================================================================
// findFieldById Tests
// =============================================================================

describe('findFieldById', () => {
  it('finds field by exact ID', () => {
    const form = parseForm(MULTI_FIELD_FORM);

    const field = findFieldById(form, 'field2');
    expect(field).toBeDefined();
    expect(field?.id).toBe('field2');
    expect(field?.kind).toBe('number');
  });

  it('returns undefined for non-existent field', () => {
    const form = parseForm(MULTI_FIELD_FORM);

    const field = findFieldById(form, 'nonexistent');
    expect(field).toBeUndefined();
  });

  it('returns undefined for group ID (not a field)', () => {
    const form = parseForm(MULTI_FIELD_FORM);

    const field = findFieldById(form, 'g1');
    expect(field).toBeUndefined();
  });

  it('finds field with complex options', () => {
    const form = parseForm(CHECKBOX_FORM);

    const field = findFieldById(form, 'simple_cb');
    expect(field).toBeDefined();
    expect(field?.kind).toBe('checkboxes');
  });
});

// =============================================================================
// getFieldsForRoles Tests
// =============================================================================

describe('getFieldsForRoles', () => {
  it('returns all fields when target is "*"', () => {
    const form = parseForm(ROLE_FORM);

    const fields = getFieldsForRoles(form, ['*']);
    expect(fields).toHaveLength(3);
  });

  it('filters fields by single role', () => {
    const form = parseForm(ROLE_FORM);

    const agentFields = getFieldsForRoles(form, ['agent']);
    expect(agentFields).toHaveLength(2); // agent_field and default_field (default role is 'agent')
    expect(agentFields.map((f) => f.id)).toContain('agent_field');
  });

  it('filters fields by multiple roles', () => {
    const form = parseForm(ROLE_FORM);

    const fields = getFieldsForRoles(form, ['agent', 'user']);
    expect(fields).toHaveLength(3);
  });

  it('returns empty array when no fields match role', () => {
    const form = parseForm(ROLE_FORM);

    const fields = getFieldsForRoles(form, ['admin']);
    expect(fields).toHaveLength(0);
  });
});

// =============================================================================
// isCheckboxComplete Tests
// =============================================================================

describe('isCheckboxComplete', () => {
  describe('simple mode', () => {
    it('returns false when checkbox is unanswered', () => {
      const form = parseForm(CHECKBOX_FORM);

      expect(isCheckboxComplete(form, 'simple_cb')).toBe(false);
    });

    it('returns false when not all options are done', () => {
      const form = parseForm(CHECKBOX_FORM);
      form.responsesByFieldId.simple_cb = {
        state: 'answered',
        value: {
          kind: 'checkboxes',
          values: { opt_a: 'done', opt_b: 'todo' },
        },
      };

      expect(isCheckboxComplete(form, 'simple_cb')).toBe(false);
    });

    it('returns true when all options are done', () => {
      const form = parseForm(CHECKBOX_FORM);
      form.responsesByFieldId.simple_cb = {
        state: 'answered',
        value: {
          kind: 'checkboxes',
          values: { opt_a: 'done', opt_b: 'done' },
        },
      };

      expect(isCheckboxComplete(form, 'simple_cb')).toBe(true);
    });
  });

  describe('explicit mode', () => {
    it('returns false when options are unfilled', () => {
      const form = parseForm(CHECKBOX_FORM);
      form.responsesByFieldId.explicit_cb = {
        state: 'answered',
        value: {
          kind: 'checkboxes',
          values: { yn_a: 'yes', yn_b: 'unfilled' },
        },
      };

      expect(isCheckboxComplete(form, 'explicit_cb')).toBe(false);
    });

    it('returns true when all options are yes or no', () => {
      const form = parseForm(CHECKBOX_FORM);
      form.responsesByFieldId.explicit_cb = {
        state: 'answered',
        value: {
          kind: 'checkboxes',
          values: { yn_a: 'yes', yn_b: 'no' },
        },
      };

      expect(isCheckboxComplete(form, 'explicit_cb')).toBe(true);
    });
  });

  describe('multi mode', () => {
    it('returns false when options are incomplete', () => {
      const form = parseForm(CHECKBOX_FORM);
      form.responsesByFieldId.multi_cb = {
        state: 'answered',
        value: {
          kind: 'checkboxes',
          values: { task_a: 'done', task_b: 'incomplete' },
        },
      };

      expect(isCheckboxComplete(form, 'multi_cb')).toBe(false);
    });

    it('returns true when all options are done or na', () => {
      const form = parseForm(CHECKBOX_FORM);
      form.responsesByFieldId.multi_cb = {
        state: 'answered',
        value: {
          kind: 'checkboxes',
          values: { task_a: 'done', task_b: 'na' },
        },
      };

      expect(isCheckboxComplete(form, 'multi_cb')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns true for non-checkbox field', () => {
      const form = parseForm(MULTI_FIELD_FORM);

      expect(isCheckboxComplete(form, 'field1')).toBe(true);
    });

    it('returns true for non-existent field', () => {
      const form = parseForm(MULTI_FIELD_FORM);

      expect(isCheckboxComplete(form, 'nonexistent')).toBe(true);
    });
  });
});

// =============================================================================
// findBlockingCheckpoint Tests
// =============================================================================

describe('findBlockingCheckpoint', () => {
  it('returns null when no blocking checkpoints exist', () => {
    const form = parseForm(CHECKBOX_FORM);

    const result = findBlockingCheckpoint(form);
    expect(result).toBeNull();
  });

  it('returns checkpoint info for incomplete blocking checkpoint', () => {
    const form = parseForm(BLOCKING_FORM);

    const result = findBlockingCheckpoint(form);
    expect(result).not.toBeNull();
    expect(result?.fieldId).toBe('approval');
    expect(result?.index).toBeGreaterThanOrEqual(0);
  });

  it('returns null when blocking checkpoint is complete', () => {
    const form = parseForm(BLOCKING_FORM);
    form.responsesByFieldId.approval = {
      state: 'answered',
      value: {
        kind: 'checkboxes',
        values: { approve: 'done' },
      },
    };

    const result = findBlockingCheckpoint(form);
    expect(result).toBeNull();
  });
});

// =============================================================================
// getBlockedFieldIds Tests
// =============================================================================

describe('getBlockedFieldIds', () => {
  it('returns field IDs after blocking checkpoint', () => {
    const form = parseForm(BLOCKING_FORM);
    const checkpoint = findBlockingCheckpoint(form);

    expect(checkpoint).not.toBeNull();
    const blockedIds = getBlockedFieldIds(form, checkpoint!);

    expect(blockedIds.has('after_approval')).toBe(true);
    expect(blockedIds.has('before_approval')).toBe(false);
    expect(blockedIds.has('approval')).toBe(false);
  });

  it('returns empty set when checkpoint is last field', () => {
    const lastCheckpointForm = `---
spec: MF/0.1
---
{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="first" label="First" %}{% /field %}
{% field kind="checkboxes" id="last_approval" label="Last" checkboxMode="simple" approvalMode="blocking" %}
- [ ] Approve {% #approve %}
{% /field %}
{% /group %}
{% /form %}
`;
    const form = parseForm(lastCheckpointForm);
    const checkpoint = findBlockingCheckpoint(form);

    expect(checkpoint).not.toBeNull();
    const blockedIds = getBlockedFieldIds(form, checkpoint!);

    expect(blockedIds.size).toBe(0);
  });
});

// =============================================================================
// filterIssuesByRole Tests
// =============================================================================

describe('filterIssuesByRole', () => {
  const mockIssues: InspectIssue[] = [
    {
      ref: 'agent_field',
      scope: 'field',
      reason: 'optional_unanswered',
      message: 'Test',
      severity: 'recommended',
      priority: 3,
    },
    {
      ref: 'user_field',
      scope: 'field',
      reason: 'optional_unanswered',
      message: 'Test',
      severity: 'recommended',
      priority: 3,
    },
    {
      ref: 'default_field',
      scope: 'field',
      reason: 'optional_unanswered',
      message: 'Test',
      severity: 'recommended',
      priority: 3,
    },
  ];

  it('returns all issues when no target roles specified', () => {
    const form = parseForm(ROLE_FORM);

    const filtered = filterIssuesByRole(mockIssues, form);
    expect(filtered).toHaveLength(3);
  });

  it('returns all issues when target is "*"', () => {
    const form = parseForm(ROLE_FORM);

    const filtered = filterIssuesByRole(mockIssues, form, ['*']);
    expect(filtered).toHaveLength(3);
  });

  it('filters issues by single role', () => {
    const form = parseForm(ROLE_FORM);

    const filtered = filterIssuesByRole(mockIssues, form, ['user']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.ref).toBe('user_field');
  });

  it('filters issues by multiple roles', () => {
    const form = parseForm(ROLE_FORM);

    const filtered = filterIssuesByRole(mockIssues, form, ['user', 'agent']);
    expect(filtered).toHaveLength(3);
  });

  it('adds blockedBy annotation for fields after blocking checkpoint', () => {
    const form = parseForm(BLOCKING_FORM);
    const issues: InspectIssue[] = [
      {
        ref: 'after_approval',
        scope: 'field',
        reason: 'optional_unanswered',
        message: 'Test',
        severity: 'recommended',
        priority: 3,
      },
    ];

    const filtered = filterIssuesByRole(issues, form);
    expect(filtered[0]?.blockedBy).toBe('approval');
  });

  it('handles option refs (fieldId.optionId)', () => {
    const form = parseForm(CHECKBOX_FORM);
    const issues: InspectIssue[] = [
      {
        ref: 'simple_cb.opt_a',
        scope: 'option',
        reason: 'checkbox_incomplete',
        message: 'Test',
        severity: 'recommended',
        priority: 3,
      },
    ];

    const filtered = filterIssuesByRole(issues, form, ['agent']);
    expect(filtered).toHaveLength(1);
  });
});
