import { describe, expect, it } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';
import { applyPatches } from '../../../src/engine/apply.js';
import type { Patch } from '../../../src/engine/coreTypes.js';

describe('engine/apply', () => {
  describe('set_string patch', () => {
    it('applies set_string to string field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_string', fieldId: 'name', value: 'John Doe' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.name?.value).toEqual({
        kind: 'string',
        value: 'John Doe',
      });
    });

    it('rejects set_string on non-string field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% number-field id="age" label="Age" %}{% /number-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_string', fieldId: 'age', value: '25' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('rejected');
    });
  });

  describe('set_number patch', () => {
    it('applies set_number to number field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% number-field id="age" label="Age" %}{% /number-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_number', fieldId: 'age', value: 25 }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.age?.value).toEqual({
        kind: 'number',
        value: 25,
      });
    });
  });

  describe('set_string_list patch', () => {
    it('applies set_string_list to string-list field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-list id="tags" label="Tags" %}{% /string-list %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_string_list', fieldId: 'tags', items: ['a', 'b', 'c'] }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.tags?.value).toEqual({
        kind: 'string_list',
        items: ['a', 'b', 'c'],
      });
    });
  });

  describe('set_single_select patch', () => {
    it('applies set_single_select to single-select field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% single-select id="priority" label="Priority" %}
- [ ] High {% #high %}
- [ ] Low {% #low %}
{% /single-select %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_single_select', fieldId: 'priority', selected: 'high' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.priority?.value).toEqual({
        kind: 'single_select',
        selected: 'high',
      });
    });

    it('rejects invalid option id', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% single-select id="priority" label="Priority" %}
- [ ] High {% #high %}
- [ ] Low {% #low %}
{% /single-select %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: 'set_single_select', fieldId: 'priority', selected: 'invalid' },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('rejected');
    });
  });

  describe('set_multi_select patch', () => {
    it('applies set_multi_select to multi-select field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% multi-select id="categories" label="Categories" %}
- [ ] Tech {% #tech %}
- [ ] Finance {% #finance %}
- [ ] Health {% #health %}
{% /multi-select %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: 'set_multi_select', fieldId: 'categories', selected: ['tech', 'health'] },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.categories?.value).toEqual({
        kind: 'multi_select',
        selected: ['tech', 'health'],
      });
    });
  });

  describe('set_checkboxes patch', () => {
    it('applies set_checkboxes with merge behavior', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% checkboxes id="tasks" label="Tasks" checkboxMode="multi" %}
- [x] First {% #first %}
- [ ] Second {% #second %}
- [ ] Third {% #third %}
{% /checkboxes %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      // Apply patch for second only - should merge with existing
      const patches: Patch[] = [
        {
          op: 'set_checkboxes',
          fieldId: 'tasks',
          values: { second: 'done' },
        },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      const response = form.responsesByFieldId.tasks;
      const value = response?.value;
      expect(value?.kind).toBe('checkboxes');
      if (value?.kind === 'checkboxes') {
        // First should still be done (from original)
        expect(value.values.first).toBe('done');
        // Second should now be done (from patch)
        expect(value.values.second).toBe('done');
      }
    });
  });

  describe('clear_field patch', () => {
    it('clears string field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}
\`\`\`value
John
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'clear_field', fieldId: 'name' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.name?.state).toBe('unanswered');
    });
  });

  describe('transaction semantics', () => {
    it('rejects all patches if any is invalid', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% number-field id="age" label="Age" %}{% /number-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: 'set_string', fieldId: 'name', value: 'John' }, // valid
        { op: 'set_string', fieldId: 'age', value: '25' }, // invalid - wrong type
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('rejected');
      // Name should NOT be updated due to transaction rollback
      const nameResponse = form.responsesByFieldId.name;
      expect(nameResponse?.state === 'unanswered' || nameResponse === undefined).toBe(true);
    });

    it('rejects if field does not exist', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_string', fieldId: 'nonexistent', value: 'test' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('rejected');
    });
  });

  describe('skip_field patch', () => {
    it('applies skip_field to optional field with reason stored in response', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: 'skip_field', fieldId: 'notes', role: 'agent', reason: 'Not applicable' },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.notes?.state).toBe('skipped');
      // Per markform-254, reason is stored in FieldResponse.reason, not as a note
      expect(form.responsesByFieldId.notes?.reason).toBe('Not applicable');
      expect(form.notes).toHaveLength(0);
    });

    it('rejects skip_field on required field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: 'skip_field', fieldId: 'name', role: 'agent', reason: "Can't skip required" },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('rejected');
      expect(form.responsesByFieldId.name?.state).not.toBe('skipped');
    });

    it('clears existing value when skipping', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" %}
\`\`\`value
Some existing value
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      // Verify value exists initially
      expect(form.responsesByFieldId.notes?.state).toBe('answered');

      const patches: Patch[] = [{ op: 'skip_field', fieldId: 'notes', role: 'agent' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.notes?.state).toBe('skipped');
      expect(form.responsesByFieldId.notes?.value).toBeUndefined();
    });

    it('un-skips field when setting a value', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);

      // First skip the field
      applyPatches(form, [{ op: 'skip_field', fieldId: 'notes', role: 'agent' }]);
      expect(form.responsesByFieldId.notes?.state).toBe('skipped');

      // Then set a value
      const result = applyPatches(form, [
        { op: 'set_string', fieldId: 'notes', value: 'New value' },
      ]);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.notes?.state).toBe('answered');
      expect(form.responsesByFieldId.notes?.value).toEqual({
        kind: 'string',
        value: 'New value',
      });
    });
  });

  describe('result summaries', () => {
    it('returns updated summaries after applying patches', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_string', fieldId: 'name', value: 'John' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(result.structureSummary.fieldCount).toBe(1);
      expect(result.progressSummary.counts.answeredFields).toBe(1);
      expect(result.formState).toBe('complete');
      expect(result.isComplete).toBe(true);
    });
  });

  describe('unified response model - abort_field patch (markform-234)', () => {
    it('applies abort_field to optional field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'abort_field', fieldId: 'notes', role: 'agent' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.notes?.state).toBe('aborted');
      expect(form.responsesByFieldId.notes?.value).toBeUndefined();
    });

    it('applies abort_field to required field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'abort_field', fieldId: 'name', role: 'agent' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.name?.state).toBe('aborted');
    });

    it('applies abort_field with reason stored in response', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% number-field id="revenue" label="Revenue" %}{% /number-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        {
          op: 'abort_field',
          fieldId: 'revenue',
          role: 'agent',
          reason: 'Data not available in source document',
        },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.revenue?.state).toBe('aborted');

      // Per markform-254, reason is stored in FieldResponse.reason, not as a note
      expect(form.responsesByFieldId.revenue?.reason).toBe('Data not available in source document');
      expect(form.notes).toHaveLength(0);
    });

    it('clears existing value when aborting field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" %}
\`\`\`value
Some existing value
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      expect(form.responsesByFieldId.notes?.state).toBe('answered');

      const patches: Patch[] = [{ op: 'abort_field', fieldId: 'notes', role: 'agent' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.notes?.state).toBe('aborted');
      expect(form.responsesByFieldId.notes?.value).toBeUndefined();
    });
  });

  describe('unified response model - add_note patch (markform-234)', () => {
    it('adds note with valid ref', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        {
          op: 'add_note',
          ref: 'name',
          role: 'user',
          text: 'This is a general comment.',
        },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.notes).toHaveLength(1);
      expect(form.notes[0]?.ref).toBe('name');
      expect(form.notes[0]?.role).toBe('user');
      expect(form.notes[0]?.text).toContain('general comment');
    });

    it('adds note without state attribute (notes are general-purpose)', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" state="skipped" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        {
          op: 'add_note',
          ref: 'notes',
          role: 'agent',
          text: 'Skipped because not applicable.',
        },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.notes).toHaveLength(1);
      // Per markform-254, notes no longer have state attribute
      expect(form.notes[0]?.text).toContain('not applicable');
    });

    it('rejects add_note with invalid ref', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        {
          op: 'add_note',
          ref: 'nonexistent',
          role: 'agent',
          text: 'Note text',
        },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('rejected');
    });

    it('generates sequential note IDs', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);

      // Add first note
      applyPatches(form, [{ op: 'add_note', ref: 'name', role: 'agent', text: 'First note' }]);
      expect(form.notes[0]?.id).toBe('n1');

      // Add second note
      applyPatches(form, [{ op: 'add_note', ref: 'name', role: 'agent', text: 'Second note' }]);
      expect(form.notes[1]?.id).toBe('n2');

      // Add third note
      applyPatches(form, [{ op: 'add_note', ref: 'name', role: 'agent', text: 'Third note' }]);
      expect(form.notes[2]?.id).toBe('n3');
    });
  });

  describe('unified response model - remove_note patch (markform-234)', () => {
    it('removes specific note by ID', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

{% note id="n1" ref="name" role="agent" %}
Note 1.
{% /note %}

{% note id="n2" ref="name" role="agent" %}
Note 2.
{% /note %}

{% /form %}
`;
      const form = parseForm(markdown);
      expect(form.notes).toHaveLength(2);

      const patches: Patch[] = [{ op: 'remove_note', noteId: 'n1' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.notes).toHaveLength(1);
      expect(form.notes[0]?.id).toBe('n2');
    });

    it('rejects remove_note with invalid noteId', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'remove_note', noteId: 'n999' }];

      const result = applyPatches(form, patches);

      // Validation ensures note exists before applying
      expect(result.applyStatus).toBe('rejected');
    });
  });

  describe('unified response model - notes preserved on re-fill (markform-254)', () => {
    it('preserves all notes when setting value on skipped field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" state="skipped" %}{% /string-field %}
{% /field-group %}

{% note id="n1" ref="notes" role="agent" %}
Skip reason note.
{% /note %}

{% note id="n2" ref="notes" role="user" %}
General comment.
{% /note %}

{% /form %}
`;
      const form = parseForm(markdown);
      expect(form.notes).toHaveLength(2);
      expect(form.responsesByFieldId.notes?.state).toBe('skipped');

      // Set a value on the skipped field
      const patches: Patch[] = [{ op: 'set_string', fieldId: 'notes', value: 'New value' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.notes?.state).toBe('answered');

      // All notes preserved - notes are general-purpose per markform-254
      expect(form.notes).toHaveLength(2);
    });

    it('preserves all notes when setting value on aborted field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% number-field id="count" label="Count" state="aborted" %}{% /number-field %}
{% /field-group %}

{% note id="n1" ref="count" role="agent" %}
Abort reason note.
{% /note %}

{% /form %}
`;
      const form = parseForm(markdown);
      expect(form.notes).toHaveLength(1);

      // Set a value on the aborted field
      const patches: Patch[] = [{ op: 'set_number', fieldId: 'count', value: 42 }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.count?.state).toBe('answered');

      // Note preserved - notes are general-purpose per markform-254
      expect(form.notes).toHaveLength(1);
    });
  });
});
