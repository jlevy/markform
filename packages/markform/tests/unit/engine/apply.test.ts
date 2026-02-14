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

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="number" id="age" label="Age" %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="number" id="age" label="Age" %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_string_list', fieldId: 'tags', value: ['a', 'b', 'c'] }];

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

{% group id="g1" %}
{% field kind="single_select" id="priority" label="Priority" %}
- [ ] High {% #high %}
- [ ] Low {% #low %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_single_select', fieldId: 'priority', value: 'high' }];

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

{% group id="g1" %}
{% field kind="single_select" id="priority" label="Priority" %}
- [ ] High {% #high %}
- [ ] Low {% #low %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_single_select', fieldId: 'priority', value: 'invalid' }];

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

{% group id="g1" %}
{% field kind="multi_select" id="categories" label="Categories" %}
- [ ] Tech {% #tech %}
- [ ] Finance {% #finance %}
- [ ] Health {% #health %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: 'set_multi_select', fieldId: 'categories', value: ['tech', 'health'] },
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

{% group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="multi" %}
- [x] First {% #first %}
- [ ] Second {% #second %}
- [ ] Third {% #third %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      // Apply patch for second only - should merge with existing
      const patches: Patch[] = [
        {
          op: 'set_checkboxes',
          fieldId: 'tasks',
          value: { second: 'done' },
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

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}
\`\`\`value
John
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'clear_field', fieldId: 'name' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.name?.state).toBe('unanswered');
    });
  });

  describe('best-effort semantics', () => {
    it('applies valid patches even when some are invalid', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% field kind="number" id="age" label="Age" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: 'set_string', fieldId: 'name', value: 'John' }, // valid
        { op: 'set_string', fieldId: 'age', value: '25' }, // invalid - wrong type
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('partial');
      // Name SHOULD be updated (valid patch applied)
      const nameResponse = form.responsesByFieldId.name;
      expect(nameResponse?.state).toBe('answered');
      expect((nameResponse?.value as { value: string })?.value).toBe('John');
      // Age should NOT be updated (invalid patch rejected)
      const ageResponse = form.responsesByFieldId.age;
      expect(ageResponse?.state === 'unanswered' || ageResponse === undefined).toBe(true);
      // Check applied/rejected patch counts
      expect(result.appliedPatches.length).toBe(1);
      expect(result.rejectedPatches.length).toBe(1);
    });

    it('rejects if field does not exist', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_string', fieldId: 'nonexistent', value: 'test' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('rejected');
    });
  });

  describe('rejection details', () => {
    it('returns empty rejectedPatches on success', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_string', fieldId: 'name', value: 'John' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(result.rejectedPatches).toEqual([]);
    });

    it('returns rejection details with patchIndex and message', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="number" id="age" label="Age" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_string', fieldId: 'age', value: '25' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('rejected');
      expect(result.rejectedPatches).toHaveLength(1);
      expect(result.rejectedPatches[0]).toMatchObject({
        patchIndex: 0,
        message: expect.stringContaining('Cannot apply set_string to number field'),
      });
    });

    it('returns multiple rejection details for multiple invalid patches', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% field kind="number" id="age" label="Age" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: 'set_string', fieldId: 'nonexistent', value: 'test' },
        { op: 'set_string', fieldId: 'age', value: '25' },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('rejected');
      expect(result.rejectedPatches).toHaveLength(2);
      expect(result.rejectedPatches[0]?.patchIndex).toBe(0);
      expect(result.rejectedPatches[1]?.patchIndex).toBe(1);
    });
  });

  describe('skip_field patch', () => {
    it('applies skip_field to optional field with reason stored in response', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" %}
\`\`\`value
Some existing value
\`\`\`
{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="number" id="revenue" label="Revenue" %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" %}
\`\`\`value
Some existing value
\`\`\`
{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" state="skipped" %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" state="skipped" %}{% /field %}
{% /group %}

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

{% group id="g1" %}
{% field kind="number" id="count" label="Count" state="aborted" %}{% /field %}
{% /group %}

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

  describe('set_date patch', () => {
    it('applies set_date to date field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="date" id="birthday" label="Birthday" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_date', fieldId: 'birthday', value: '1990-05-15' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.birthday?.value).toEqual({
        kind: 'date',
        value: '1990-05-15',
      });
    });

    it('rejects set_date on non-date field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_date', fieldId: 'name', value: '1990-05-15' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('rejected');
    });
  });

  describe('set_year patch', () => {
    it('applies set_year to year field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="year" id="grad_year" label="Graduation Year" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_year', fieldId: 'grad_year', value: 2020 }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.grad_year?.value).toEqual({
        kind: 'year',
        value: 2020,
      });
    });

    it('rejects set_year on non-year field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="number" id="count" label="Count" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_year', fieldId: 'count', value: 2020 }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('rejected');
    });
  });

  describe('set_url patch', () => {
    it('applies set_url to url field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url" id="website" label="Website" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: 'set_url', fieldId: 'website', value: 'https://example.com' },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.website?.value).toEqual({
        kind: 'url',
        value: 'https://example.com',
      });
    });
  });

  describe('set_url_list patch', () => {
    it('applies set_url_list to url_list field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: 'set_url_list', fieldId: 'sources', value: ['https://a.com', 'https://b.com'] },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.sources?.value).toEqual({
        kind: 'url_list',
        items: ['https://a.com', 'https://b.com'],
      });
    });
  });

  describe('set_table patch', () => {
    it('applies set_table to table field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="contacts" label="Contacts" columnIds=["name", "email"] %}
| Name | Email |
|------|-------|
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        {
          op: 'set_table',
          fieldId: 'contacts',
          value: [
            { name: 'John', email: 'john@test.com' },
            { name: 'Jane', email: 'jane@test.com' },
          ],
        },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.contacts?.value;
      expect(value?.kind).toBe('table');
      if (value?.kind === 'table') {
        expect(value.rows).toHaveLength(2);
        expect(value.rows[0]?.name).toEqual({ state: 'answered', value: 'John' });
        expect(value.rows[0]?.email).toEqual({ state: 'answered', value: 'john@test.com' });
      }
    });

    it('handles null cell values as skipped', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="data" label="Data" columnIds=["a", "b"] %}
| A | B |
|---|---|
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        {
          op: 'set_table',
          fieldId: 'data',
          value: [{ a: 'value', b: null }],
        },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.data?.value;
      if (value?.kind === 'table') {
        expect(value.rows[0]?.b).toEqual({ state: 'skipped' });
      }
    });

    it('handles %SKIP% sentinel in cell values', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="data" label="Data" columnIds=["a", "b"] %}
| A | B |
|---|---|
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        {
          op: 'set_table',
          fieldId: 'data',
          value: [{ a: 'value', b: '%SKIP%' }],
        },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.data?.value;
      if (value?.kind === 'table') {
        expect(value.rows[0]?.b?.state).toBe('skipped');
      }
    });

    it('handles %SKIP:reason% sentinel with reason', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="data" label="Data" columnIds=["a", "b"] %}
| A | B |
|---|---|
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        {
          op: 'set_table',
          fieldId: 'data',
          value: [{ a: 'value', b: '%SKIP:not available%' }],
        },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.data?.value;
      if (value?.kind === 'table') {
        expect(value.rows[0]?.b?.state).toBe('skipped');
        expect(value.rows[0]?.b?.reason).toBe('not available');
      }
    });

    it('handles %ABORT% sentinel in cell values', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="data" label="Data" columnIds=["a", "b"] %}
| A | B |
|---|---|
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        {
          op: 'set_table',
          fieldId: 'data',
          value: [{ a: 'value', b: '%ABORT%' }],
        },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.data?.value;
      if (value?.kind === 'table') {
        expect(value.rows[0]?.b?.state).toBe('aborted');
      }
    });

    it('handles %ABORT:reason% sentinel with reason', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="data" label="Data" columnIds=["a", "b"] %}
| A | B |
|---|---|
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        {
          op: 'set_table',
          fieldId: 'data',
          value: [{ a: 'value', b: '%ABORT:data error%' }],
        },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.data?.value;
      if (value?.kind === 'table') {
        expect(value.rows[0]?.b?.state).toBe('aborted');
        expect(value.rows[0]?.b?.reason).toBe('data error');
      }
    });

    it('handles number cell values', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="data" label="Data" columnIds=["name", "count"] %}
| Name | Count |
|------|-------|
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        {
          op: 'set_table',
          fieldId: 'data',
          value: [{ name: 'item', count: 42 }],
        },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.data?.value;
      if (value?.kind === 'table') {
        expect(value.rows[0]?.count).toEqual({ state: 'answered', value: 42 });
      }
    });

    it('rejects set_table on non-table field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        {
          op: 'set_table',
          fieldId: 'name',
          value: [{ a: 'test' }],
        },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('rejected');
    });
  });

  describe('patch type mismatch errors', () => {
    // Shared form for type mismatch tests
    const STRING_FIELD_FORM = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}
`;

    // Type mismatch cases: [patchOp, patch, expectedError]
    const TYPE_MISMATCH_CASES: [string, Patch, string][] = [
      ['set_date', { op: 'set_date', fieldId: 'name', value: '2024-01-15' }, 'set_date to string'],
      [
        'set_url_list',
        { op: 'set_url_list', fieldId: 'name', value: ['https://example.com'] },
        'set_url_list to string',
      ],
      ['set_year', { op: 'set_year', fieldId: 'name', value: 2024 }, 'set_year to string'],
    ];

    it.each(TYPE_MISMATCH_CASES)('rejects %s on string field', (_, patch, expectedError) => {
      const form = parseForm(STRING_FIELD_FORM);
      const result = applyPatches(form, [patch]);
      expect(result.applyStatus).toBe('rejected');
      expect(result.rejectedPatches[0]?.message).toContain(expectedError);
    });

    it('rejects set_table with invalid column', () => {
      const form = parseForm(`---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% group id="g1" %}
{% field kind="table" id="data" label="Data" columnIds=["name"] %}
{% column id="name" label="Name" type="string" required=true %}{% /column %}
{% /field %}
{% /group %}
{% /form %}
`);
      const result = applyPatches(form, [
        { op: 'set_table', fieldId: 'data', value: [{ name: 'valid', invalid_column: 'test' }] },
      ]);
      expect(result.applyStatus).toBe('rejected');
      expect(result.rejectedPatches[0]?.message).toContain('Invalid column');
    });
  });

  // =============================================================================
  // Patch Validation Coverage Matrix
  // =============================================================================
  //
  // This section tests runtime validation for all 15 patch types. Validation layers:
  //
  // Layer 1: Field Existence - All patches validate field/ref exists (tested above)
  // Layer 2: Field Kind Match - set_* patches match expected field kind (tested above)
  // Layer 3: Container Type Validation - Arrays/objects validated at runtime (below)
  // Layer 4: Value Domain Validation - Option IDs, column IDs checked (tested above)
  //
  // Container Type Validation Matrix:
  // ┌─────────────────────┬────────────┬─────────────────────────────────────────┐
  // │ Patch Op            │ Property   │ Runtime Validation                      │
  // ├─────────────────────┼────────────┼─────────────────────────────────────────┤
  // │ set_string          │ value      │ None (scalar, TypeScript-only)          │
  // │ set_number          │ value      │ None (scalar, TypeScript-only)          │
  // │ set_url             │ value      │ None (scalar, TypeScript-only)          │
  // │ set_date            │ value      │ None (scalar, TypeScript-only)          │
  // │ set_year            │ value      │ None (scalar, TypeScript-only)          │
  // │ set_single_select   │ selected   │ None (nullable scalar)                  │
  // │ set_string_list     │ items      │ Array.isArray() ✓                       │
  // │ set_url_list        │ items      │ Array.isArray() ✓                       │
  // │ set_multi_select    │ selected   │ Array.isArray() ✓                       │
  // │ set_checkboxes      │ values     │ != null && typeof 'object' && !Array ✓  │
  // │ set_table           │ rows       │ Array.isArray() + null-safe iteration ✓ │
  // └─────────────────────┴────────────┴─────────────────────────────────────────┘
  //
  // Tests below use `as any` to simulate malformed LLM outputs that bypass TypeScript.

  /* eslint-disable @typescript-eslint/no-unsafe-argument */
  describe('patch value validation', () => {
    // Form with all field types for testing
    const ALL_FIELDS_FORM = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="str" label="String" %}{% /field %}
{% field kind="number" id="num" label="Number" %}{% /field %}
{% field kind="checkboxes" id="checks" label="Checkboxes" checkboxMode="simple" %}
- [ ] Option A {% #a %}
- [ ] Option B {% #b %}
{% /field %}
{% field kind="table" id="tbl" label="Table" columnIds=["col1"] %}
{% column id="col1" label="Col1" type="string" %}{% /column %}
{% /field %}
{% field kind="url" id="url_field" label="URL" %}{% /field %}
{% field kind="url_list" id="urls" label="URLs" %}{% /field %}
{% field kind="string_list" id="strs" label="Strings" %}{% /field %}
{% field kind="single_select" id="sel" label="Select" %}
- Option 1 {% #opt1 %}
- Option 2 {% #opt2 %}
{% /field %}
{% field kind="multi_select" id="multi" label="Multi" %}
- Option 1 {% #opt1 %}
- Option 2 {% #opt2 %}
{% /field %}
{% field kind="date" id="date_field" label="Date" %}{% /field %}
{% field kind="year" id="year_field" label="Year" %}{% /field %}
{% /group %}
{% /form %}
`;

    describe('set_checkboxes with invalid values', () => {
      it('rejects undefined values', () => {
        const form = parseForm(ALL_FIELDS_FORM);
        const patch = { op: 'set_checkboxes', fieldId: 'checks', values: undefined } as any;
        const result = applyPatches(form, [patch]);
        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('set_checkboxes');
        expect(result.rejectedPatches[0]?.message).toContain('checks');
      });

      it('rejects null values', () => {
        const form = parseForm(ALL_FIELDS_FORM);
        const patch = { op: 'set_checkboxes', fieldId: 'checks', values: null } as any;
        const result = applyPatches(form, [patch]);
        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('set_checkboxes');
      });

      it('coerces array of option IDs to checkboxes object with warning', () => {
        const form = parseForm(ALL_FIELDS_FORM);
        const patch = { op: 'set_checkboxes', fieldId: 'checks', value: ['a', 'b'] } as any;
        const result = applyPatches(form, [patch]);
        expect(result.applyStatus).toBe('applied');
        // Check that the coerced patch was applied
        expect(result.appliedPatches.length).toBe(1);
        expect(result.appliedPatches[0]).toEqual({
          op: 'set_checkboxes',
          fieldId: 'checks',
          value: { a: 'done', b: 'done' },
        });
        // Check that a warning was generated
        expect(result.warnings.length).toBe(1);
        expect(result.warnings[0]?.coercion).toBe('array_to_checkboxes');
      });

      it('rejects array with invalid option IDs', () => {
        const form = parseForm(ALL_FIELDS_FORM);
        const patch = { op: 'set_checkboxes', fieldId: 'checks', value: ['invalid'] } as any;
        const result = applyPatches(form, [patch]);
        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('Invalid option');
      });

      it('rejects string instead of object', () => {
        const form = parseForm(ALL_FIELDS_FORM);
        const patch = { op: 'set_checkboxes', fieldId: 'checks', values: 'done' } as any;
        const result = applyPatches(form, [patch]);
        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('set_checkboxes');
      });
    });

    describe('set_table with invalid values', () => {
      it('rejects undefined rows', () => {
        const form = parseForm(ALL_FIELDS_FORM);
        const patch = { op: 'set_table', fieldId: 'tbl', rows: undefined } as any;
        const result = applyPatches(form, [patch]);
        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('set_table');
      });

      it('rejects null rows', () => {
        const form = parseForm(ALL_FIELDS_FORM);
        const patch = { op: 'set_table', fieldId: 'tbl', rows: null } as any;
        const result = applyPatches(form, [patch]);
        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('set_table');
      });

      it('rejects object instead of array', () => {
        const form = parseForm(ALL_FIELDS_FORM);
        const patch = { op: 'set_table', fieldId: 'tbl', rows: { col1: 'value' } } as any;
        const result = applyPatches(form, [patch]);
        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('set_table');
      });
    });

    describe('set_url_list with invalid values', () => {
      it('rejects undefined items', () => {
        const form = parseForm(ALL_FIELDS_FORM);
        const patch = { op: 'set_url_list', fieldId: 'urls', items: undefined } as any;
        const result = applyPatches(form, [patch]);
        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('set_url_list');
      });

      it('rejects null items', () => {
        const form = parseForm(ALL_FIELDS_FORM);
        const patch = { op: 'set_url_list', fieldId: 'urls', items: null } as any;
        const result = applyPatches(form, [patch]);
        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('set_url_list');
      });
    });

    describe('set_string_list with invalid values', () => {
      it('rejects undefined items', () => {
        const form = parseForm(ALL_FIELDS_FORM);
        const patch = { op: 'set_string_list', fieldId: 'strs', items: undefined } as any;
        const result = applyPatches(form, [patch]);
        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('set_string_list');
      });

      it('rejects null items', () => {
        const form = parseForm(ALL_FIELDS_FORM);
        const patch = { op: 'set_string_list', fieldId: 'strs', items: null } as any;
        const result = applyPatches(form, [patch]);
        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('set_string_list');
      });
    });

    describe('set_multi_select with invalid values', () => {
      it('rejects undefined selected', () => {
        const form = parseForm(ALL_FIELDS_FORM);
        const patch = { op: 'set_multi_select', fieldId: 'multi', selected: undefined } as any;
        const result = applyPatches(form, [patch]);
        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('set_multi_select');
      });

      it('rejects null selected', () => {
        const form = parseForm(ALL_FIELDS_FORM);
        const patch = { op: 'set_multi_select', fieldId: 'multi', selected: null } as any;
        const result = applyPatches(form, [patch]);
        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('set_multi_select');
      });
    });
  });
  /* eslint-enable @typescript-eslint/no-unsafe-argument */

  /* eslint-disable @typescript-eslint/no-unsafe-argument */
  describe('value coercion', () => {
    const COERCION_TEST_FORM = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string_list" id="items" label="Items" %}{% /field %}
{% field kind="url_list" id="urls" label="URLs" %}{% /field %}
{% field kind="multi_select" id="tags" label="Tags" %}
- [ ] Option 1 {% #opt1 %}
- [ ] Option 2 {% #opt2 %}
{% /field %}
{% field kind="checkboxes" id="checks" label="Checks" %}
- [ ] Check A {% #a %}
- [ ] Check B {% #b %}
{% /field %}
{% /group %}

{% /form %}
`;

    it('coerces single string to string_list with warning', () => {
      const form = parseForm(COERCION_TEST_FORM);
      // Use 'as any' to send intentionally wrong type for coercion
      const patch = { op: 'set_string_list', fieldId: 'items', value: 'single item' } as any;
      const result = applyPatches(form, [patch]);

      expect(result.applyStatus).toBe('applied');
      expect(result.appliedPatches.length).toBe(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]?.coercion).toBe('string_to_list');
      expect(result.warnings[0]?.fieldId).toBe('items');

      // Verify the value was coerced to an array
      const value = form.responsesByFieldId.items?.value as { items: string[] };
      expect(value.items).toEqual(['single item']);
    });

    it('coerces single URL to url_list with warning', () => {
      const form = parseForm(COERCION_TEST_FORM);
      const patch = { op: 'set_url_list', fieldId: 'urls', value: 'https://example.com' } as any;
      const result = applyPatches(form, [patch]);

      expect(result.applyStatus).toBe('applied');
      expect(result.appliedPatches.length).toBe(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]?.coercion).toBe('url_to_list');
      expect(result.warnings[0]?.fieldId).toBe('urls');

      const value = form.responsesByFieldId.urls?.value as { items: string[] };
      expect(value.items).toEqual(['https://example.com']);
    });

    it('coerces single option to multi_select array with warning', () => {
      const form = parseForm(COERCION_TEST_FORM);
      const patch = { op: 'set_multi_select', fieldId: 'tags', value: 'opt1' } as any;
      const result = applyPatches(form, [patch]);

      expect(result.applyStatus).toBe('applied');
      expect(result.appliedPatches.length).toBe(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]?.coercion).toBe('option_to_array');
      expect(result.warnings[0]?.fieldId).toBe('tags');

      const value = form.responsesByFieldId.tags?.value as { selected: string[] };
      expect(value.selected).toEqual(['opt1']);
    });

    it('coerces boolean to checkbox string with warning', () => {
      const form = parseForm(COERCION_TEST_FORM);
      const patch = {
        op: 'set_checkboxes',
        fieldId: 'checks',
        value: { a: true, b: false },
      } as any;
      const result = applyPatches(form, [patch]);

      expect(result.applyStatus).toBe('applied');
      expect(result.appliedPatches.length).toBe(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]?.coercion).toBe('boolean_to_checkbox');
      expect(result.warnings[0]?.fieldId).toBe('checks');

      const value = form.responsesByFieldId.checks?.value as { values: Record<string, string> };
      expect(value.values.a).toBe('done');
      expect(value.values.b).toBe('todo');
    });

    it('does not produce warning when value is already correct type', () => {
      const form = parseForm(COERCION_TEST_FORM);
      const patch: Patch = { op: 'set_string_list', fieldId: 'items', value: ['item1', 'item2'] };
      const result = applyPatches(form, [patch]);

      expect(result.applyStatus).toBe('applied');
      expect(result.appliedPatches.length).toBe(1);
      expect(result.warnings.length).toBe(0);

      const value = form.responsesByFieldId.items?.value as { items: string[] };
      expect(value.items).toEqual(['item1', 'item2']);
    });

    it('coerced values are in appliedPatches (not original)', () => {
      const form = parseForm(COERCION_TEST_FORM);
      const patch = { op: 'set_string_list', fieldId: 'items', value: 'coerced' } as any;
      const result = applyPatches(form, [patch]);

      expect(result.applyStatus).toBe('applied');
      // The applied patch should have the coerced array value
      const appliedPatch = result.appliedPatches[0] as { value: string[] };
      expect(appliedPatch.value).toEqual(['coerced']);
    });

    it('coerces boolean to checkbox string with explicit mode (yes/no)', () => {
      const explicitForm = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="confirms" label="Confirmations" checkboxMode="explicit" %}
- [ ] Confirmed {% #confirmed %}
- [ ] Verified {% #verified %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(explicitForm);
      const patch = {
        op: 'set_checkboxes',
        fieldId: 'confirms',
        value: { confirmed: true, verified: false },
      } as any;
      const result = applyPatches(form, [patch]);

      expect(result.applyStatus).toBe('applied');
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]?.coercion).toBe('boolean_to_checkbox');

      const value = form.responsesByFieldId.confirms?.value as { values: Record<string, string> };
      expect(value.values.confirmed).toBe('yes');
      expect(value.values.verified).toBe('no');
    });

    it('coerces empty array to checkboxes object without warning', () => {
      const form = parseForm(COERCION_TEST_FORM);
      const patch = {
        op: 'set_checkboxes',
        fieldId: 'checks',
        value: [],
      } as any;
      const result = applyPatches(form, [patch]);

      expect(result.applyStatus).toBe('applied');
      // Empty array should not produce a warning
      expect(result.warnings.length).toBe(0);

      const value = form.responsesByFieldId.checks?.value as { values: Record<string, string> };
      expect(value.values).toEqual({});
    });

    it('rejects invalid option ID in multi_select', () => {
      const form = parseForm(COERCION_TEST_FORM);
      const patch: Patch = {
        op: 'set_multi_select',
        fieldId: 'tags',
        value: ['opt1', 'invalid_option'],
      };
      const result = applyPatches(form, [patch]);

      expect(result.applyStatus).toBe('rejected');
      expect(result.rejectedPatches.length).toBe(1);
      expect(result.rejectedPatches[0]?.message).toContain('Invalid option');
      expect(result.rejectedPatches[0]?.message).toContain('invalid_option');
    });
  });
  /* eslint-enable @typescript-eslint/no-unsafe-argument */

  describe('all patches rejected', () => {
    it('returns rejected status when all patches fail', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: 'set_string', fieldId: 'nonexistent', value: 'value' }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('rejected');
      expect(result.appliedPatches.length).toBe(0);
      expect(result.rejectedPatches.length).toBe(1);
      expect(result.warnings.length).toBe(0);
    });
  });

  describe('all patches succeed', () => {
    it('returns applied status when all patches succeed', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% field kind="number" id="age" label="Age" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: 'set_string', fieldId: 'name', value: 'Alice' },
        { op: 'set_number', fieldId: 'age', value: 30 },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe('applied');
      expect(result.appliedPatches.length).toBe(2);
      expect(result.rejectedPatches.length).toBe(0);
    });
  });

  // =============================================================================
  // Issue #119: Reject embedded sentinels in string values
  // =============================================================================
  //
  // Bug: fill_form accepts patches that embed %SKIP% as part of a string value
  // (e.g., "%SKIP% (reason)") even on required fields. This causes markform serve
  // to later fail validation because the final value contains the skip sentinel.
  //
  // Fix: Values containing %SKIP% or %ABORT% sentinels should be rejected during
  // patch application, not just during final validation.
  describe('embedded sentinel rejection (issue #119)', () => {
    describe('set_string with embedded sentinels', () => {
      it('rejects %SKIP% embedded in string value on required field', () => {
        const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}{% /field %}
{% /group %}

{% /form %}
`;
        const form = parseForm(markdown);
        const patches: Patch[] = [
          { op: 'set_string', fieldId: 'name', value: '%SKIP% (Not available)' },
        ];

        const result = applyPatches(form, patches);

        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('%SKIP%');
        expect(result.rejectedPatches[0]?.message).toContain('skip_field');
      });

      it('rejects %SKIP% embedded in string value on optional field', () => {
        const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% /group %}

{% /form %}
`;
        const form = parseForm(markdown);
        const patches: Patch[] = [
          { op: 'set_string', fieldId: 'notes', value: '%SKIP% (reason text here)' },
        ];

        const result = applyPatches(form, patches);

        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('%SKIP%');
      });

      it('rejects exact %SKIP% value (should use skip_field instead)', () => {
        const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% /group %}

{% /form %}
`;
        const form = parseForm(markdown);
        const patches: Patch[] = [{ op: 'set_string', fieldId: 'notes', value: '%SKIP%' }];

        const result = applyPatches(form, patches);

        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('skip_field');
      });

      it('rejects %ABORT% embedded in string value', () => {
        const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}{% /field %}
{% /group %}

{% /form %}
`;
        const form = parseForm(markdown);
        const patches: Patch[] = [
          { op: 'set_string', fieldId: 'name', value: '%ABORT% (Data unavailable)' },
        ];

        const result = applyPatches(form, patches);

        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('%ABORT%');
        expect(result.rejectedPatches[0]?.message).toContain('abort_field');
      });

      it('rejects case-insensitive %skip% sentinel', () => {
        const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% /group %}

{% /form %}
`;
        const form = parseForm(markdown);
        const patches: Patch[] = [
          { op: 'set_string', fieldId: 'notes', value: '%skip% (lowercase)' },
        ];

        const result = applyPatches(form, patches);

        expect(result.applyStatus).toBe('rejected');
      });

      it('allows normal strings containing "SKIP" as substring', () => {
        const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% /group %}

{% /form %}
`;
        const form = parseForm(markdown);
        // "Skip this step" should be allowed - it's not using the sentinel format
        const patches: Patch[] = [{ op: 'set_string', fieldId: 'notes', value: 'Skip this step' }];

        const result = applyPatches(form, patches);

        expect(result.applyStatus).toBe('applied');
      });
    });

    describe('set_url with embedded sentinels', () => {
      it('rejects %SKIP% in URL value', () => {
        const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url" id="website" label="Website" %}{% /field %}
{% /group %}

{% /form %}
`;
        const form = parseForm(markdown);
        const patches: Patch[] = [
          { op: 'set_url', fieldId: 'website', value: '%SKIP% (no website)' },
        ];

        const result = applyPatches(form, patches);

        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('%SKIP%');
      });
    });

    describe('set_date with embedded sentinels', () => {
      it('rejects %SKIP% in date value', () => {
        const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="date" id="birthday" label="Birthday" %}{% /field %}
{% /group %}

{% /form %}
`;
        const form = parseForm(markdown);
        const patches: Patch[] = [
          { op: 'set_date', fieldId: 'birthday', value: '%SKIP% (unknown)' },
        ];

        const result = applyPatches(form, patches);

        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('%SKIP%');
      });
    });

    describe('set_string_list with embedded sentinels', () => {
      it('rejects %SKIP% in any list item', () => {
        const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" %}{% /field %}
{% /group %}

{% /form %}
`;
        const form = parseForm(markdown);
        const patches: Patch[] = [
          {
            op: 'set_string_list',
            fieldId: 'tags',
            value: ['valid', '%SKIP% (reason)', 'also valid'],
          },
        ];

        const result = applyPatches(form, patches);

        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('%SKIP%');
      });
    });

    describe('set_url_list with embedded sentinels', () => {
      it('rejects %SKIP% in any URL item', () => {
        const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" %}{% /field %}
{% /group %}

{% /form %}
`;
        const form = parseForm(markdown);
        const patches: Patch[] = [
          {
            op: 'set_url_list',
            fieldId: 'sources',
            value: ['https://example.com', '%SKIP%', 'https://other.com'],
          },
        ];

        const result = applyPatches(form, patches);

        expect(result.applyStatus).toBe('rejected');
        expect(result.rejectedPatches[0]?.message).toContain('%SKIP%');
      });
    });
  });

  // ===========================================================================
  // Append/Delete Operations
  // ===========================================================================

  describe('append_table patch', () => {
    const tableForm = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="data" label="Data" columnIds=["name", "role"] %}
| Name | Role |
|------|------|
{% /field %}
{% /group %}

{% /form %}
`;

    it('appends row to empty table', () => {
      const form = parseForm(tableForm);
      const patches: Patch[] = [
        { op: 'append_table', fieldId: 'data', value: [{ name: 'Alice', role: 'Eng' }] },
      ];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.data?.value;
      expect(value?.kind).toBe('table');
      if (value?.kind === 'table') {
        expect(value.rows).toHaveLength(1);
        expect(value.rows[0]?.name).toEqual({ state: 'answered', value: 'Alice' });
      }
    });

    it('appends row to table with existing rows', () => {
      const form = parseForm(tableForm);
      applyPatches(form, [
        { op: 'set_table', fieldId: 'data', value: [{ name: 'Alice', role: 'Eng' }] },
      ]);
      const patches: Patch[] = [
        { op: 'append_table', fieldId: 'data', value: [{ name: 'Bob', role: 'PM' }] },
      ];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.data?.value;
      if (value?.kind === 'table') {
        expect(value.rows).toHaveLength(2);
        expect(value.rows[0]?.name).toEqual({ state: 'answered', value: 'Alice' });
        expect(value.rows[1]?.name).toEqual({ state: 'answered', value: 'Bob' });
      }
    });

    it('appends multiple rows at once', () => {
      const form = parseForm(tableForm);
      const patches: Patch[] = [
        {
          op: 'append_table',
          fieldId: 'data',
          value: [
            { name: 'Alice', role: 'Eng' },
            { name: 'Bob', role: 'PM' },
          ],
        },
      ];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.data?.value;
      if (value?.kind === 'table') {
        expect(value.rows).toHaveLength(2);
      }
    });

    it('rejects append_table with invalid column', () => {
      const form = parseForm(tableForm);
      const patches: Patch[] = [
        { op: 'append_table', fieldId: 'data', value: [{ name: 'Alice', bad_col: 'x' }] },
      ];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('rejected');
      expect(result.rejectedPatches[0]?.message).toContain('bad_col');
    });
  });

  describe('delete_table patch', () => {
    const tableForm = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="data" label="Data" columnIds=["name", "role"] %}
| Name | Role |
|------|------|
{% /field %}
{% /group %}

{% /form %}
`;

    it('deletes row by index', () => {
      const form = parseForm(tableForm);
      applyPatches(form, [
        {
          op: 'set_table',
          fieldId: 'data',
          value: [
            { name: 'Alice', role: 'Eng' },
            { name: 'Bob', role: 'PM' },
            { name: 'Carol', role: 'Design' },
          ],
        },
      ]);
      const patches: Patch[] = [{ op: 'delete_table', fieldId: 'data', value: 1 }];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.data?.value;
      if (value?.kind === 'table') {
        expect(value.rows).toHaveLength(2);
        expect(value.rows[0]?.name).toEqual({ state: 'answered', value: 'Alice' });
        expect(value.rows[1]?.name).toEqual({ state: 'answered', value: 'Carol' });
      }
    });

    it('rejects out-of-bounds index', () => {
      const form = parseForm(tableForm);
      applyPatches(form, [
        { op: 'set_table', fieldId: 'data', value: [{ name: 'Alice', role: 'Eng' }] },
      ]);
      const patches: Patch[] = [{ op: 'delete_table', fieldId: 'data', value: 5 }];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('rejected');
      expect(result.rejectedPatches[0]?.message).toContain('out of bounds');
    });

    it('produces empty table on last row delete', () => {
      const form = parseForm(tableForm);
      applyPatches(form, [
        { op: 'set_table', fieldId: 'data', value: [{ name: 'Alice', role: 'Eng' }] },
      ]);
      const patches: Patch[] = [{ op: 'delete_table', fieldId: 'data', value: 0 }];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.data?.state).toBe('unanswered');
    });
  });

  describe('append_string_list patch', () => {
    const listForm = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" %}{% /field %}
{% /group %}

{% /form %}
`;

    it('appends item to empty list', () => {
      const form = parseForm(listForm);
      const patches: Patch[] = [{ op: 'append_string_list', fieldId: 'tags', value: ['rust'] }];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.tags?.value;
      if (value?.kind === 'string_list') {
        expect(value.items).toEqual(['rust']);
      }
    });

    it('appends items to existing list', () => {
      const form = parseForm(listForm);
      applyPatches(form, [{ op: 'set_string_list', fieldId: 'tags', value: ['rust', 'wasm'] }]);
      const patches: Patch[] = [{ op: 'append_string_list', fieldId: 'tags', value: ['perf'] }];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.tags?.value;
      if (value?.kind === 'string_list') {
        expect(value.items).toEqual(['rust', 'wasm', 'perf']);
      }
    });

    it('appends multiple items at once', () => {
      const form = parseForm(listForm);
      const patches: Patch[] = [
        { op: 'append_string_list', fieldId: 'tags', value: ['a', 'b', 'c'] },
      ];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.tags?.value;
      if (value?.kind === 'string_list') {
        expect(value.items).toEqual(['a', 'b', 'c']);
      }
    });
  });

  describe('delete_string_list patch', () => {
    const listForm = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" %}{% /field %}
{% /group %}

{% /form %}
`;

    it('deletes item at index', () => {
      const form = parseForm(listForm);
      applyPatches(form, [
        { op: 'set_string_list', fieldId: 'tags', value: ['rust', 'wasm', 'perf'] },
      ]);
      const patches: Patch[] = [{ op: 'delete_string_list', fieldId: 'tags', value: 1 }];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.tags?.value;
      if (value?.kind === 'string_list') {
        expect(value.items).toEqual(['rust', 'perf']);
      }
    });

    it('rejects out-of-bounds index', () => {
      const form = parseForm(listForm);
      applyPatches(form, [{ op: 'set_string_list', fieldId: 'tags', value: ['rust'] }]);
      const patches: Patch[] = [{ op: 'delete_string_list', fieldId: 'tags', value: 5 }];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('rejected');
      expect(result.rejectedPatches[0]?.message).toContain('out of bounds');
    });

    it('produces empty list on last item delete', () => {
      const form = parseForm(listForm);
      applyPatches(form, [{ op: 'set_string_list', fieldId: 'tags', value: ['only'] }]);
      const patches: Patch[] = [{ op: 'delete_string_list', fieldId: 'tags', value: 0 }];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('applied');
      expect(form.responsesByFieldId.tags?.state).toBe('unanswered');
    });
  });

  describe('append_url_list patch', () => {
    const urlListForm = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url_list" id="refs" label="References" %}{% /field %}
{% /group %}

{% /form %}
`;

    it('appends URL to empty list', () => {
      const form = parseForm(urlListForm);
      const patches: Patch[] = [
        { op: 'append_url_list', fieldId: 'refs', value: ['https://a.com'] },
      ];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.refs?.value;
      if (value?.kind === 'url_list') {
        expect(value.items).toEqual(['https://a.com']);
      }
    });

    it('appends URL to existing list', () => {
      const form = parseForm(urlListForm);
      applyPatches(form, [{ op: 'set_url_list', fieldId: 'refs', value: ['https://a.com'] }]);
      const patches: Patch[] = [
        { op: 'append_url_list', fieldId: 'refs', value: ['https://b.com'] },
      ];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.refs?.value;
      if (value?.kind === 'url_list') {
        expect(value.items).toEqual(['https://a.com', 'https://b.com']);
      }
    });
  });

  describe('delete_url_list patch', () => {
    const urlListForm = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url_list" id="refs" label="References" %}{% /field %}
{% /group %}

{% /form %}
`;

    it('deletes URL at index', () => {
      const form = parseForm(urlListForm);
      applyPatches(form, [
        { op: 'set_url_list', fieldId: 'refs', value: ['https://a.com', 'https://b.com'] },
      ]);
      const patches: Patch[] = [{ op: 'delete_url_list', fieldId: 'refs', value: 0 }];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('applied');
      const value = form.responsesByFieldId.refs?.value;
      if (value?.kind === 'url_list') {
        expect(value.items).toEqual(['https://b.com']);
      }
    });

    it('rejects out-of-bounds index', () => {
      const form = parseForm(urlListForm);
      applyPatches(form, [{ op: 'set_url_list', fieldId: 'refs', value: ['https://a.com'] }]);
      const patches: Patch[] = [{ op: 'delete_url_list', fieldId: 'refs', value: 3 }];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('rejected');
      expect(result.rejectedPatches[0]?.message).toContain('out of bounds');
    });
  });

  describe('append/delete with best-effort semantics', () => {
    it('applies valid append alongside invalid delete', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" %}{% /field %}
{% field kind="string_list" id="notes" label="Notes" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      applyPatches(form, [{ op: 'set_string_list', fieldId: 'tags', value: ['existing'] }]);
      const patches: Patch[] = [
        { op: 'append_string_list', fieldId: 'tags', value: ['new'] },
        { op: 'delete_string_list', fieldId: 'notes', value: 99 }, // out of bounds
      ];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('partial');
      const value = form.responsesByFieldId.tags?.value;
      if (value?.kind === 'string_list') {
        expect(value.items).toEqual(['existing', 'new']);
      }
    });
  });

  // ===========================================================================
  // Error branch coverage: append non-array values
  // ===========================================================================

  describe('append with non-array values', () => {
    const tableForm = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="table" id="data" label="Data"
   columnIds=["name", "role"]
   columnLabels=["Name", "Role"]
   columnTypes=["string", "string"] %}
| Name | Role |
|------|------|
{% /field %}
{% /group %}
{% /form %}
`;

    const stringListForm = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" %}{% /field %}
{% /group %}
{% /form %}
`;

    const urlListForm = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="url_list" id="refs" label="References" %}{% /field %}
{% /group %}
{% /form %}
`;

    it('rejects append_table with non-array value', () => {
      const form = parseForm(tableForm);
      const patches = [
        { op: 'append_table', fieldId: 'data', value: { name: 'Alice' } },
      ] as unknown as Patch[];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('rejected');
      expect(result.rejectedPatches).toHaveLength(1);
    });

    it('rejects append_string_list with non-array value', () => {
      const form = parseForm(stringListForm);
      const patches = [
        { op: 'append_string_list', fieldId: 'tags', value: 'single-string' },
      ] as unknown as Patch[];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('rejected');
      expect(result.rejectedPatches).toHaveLength(1);
    });

    it('rejects append_url_list with non-array value', () => {
      const form = parseForm(urlListForm);
      const patches = [
        { op: 'append_url_list', fieldId: 'refs', value: 'https://single.com' },
      ] as unknown as Patch[];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('rejected');
      expect(result.rejectedPatches).toHaveLength(1);
    });
  });

  // ===========================================================================
  // Error branch coverage: delete from empty/unset collections
  // ===========================================================================

  describe('delete from empty collections', () => {
    const tableForm = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="table" id="data" label="Data"
   columnIds=["name"]
   columnLabels=["Name"]
   columnTypes=["string"] %}
| Name |
|------|
{% /field %}
{% /group %}
{% /form %}
`;

    const stringListForm = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" %}{% /field %}
{% /group %}
{% /form %}
`;

    const urlListForm = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="url_list" id="refs" label="References" %}{% /field %}
{% /group %}
{% /form %}
`;

    it('rejects delete_table on field with no existing rows', () => {
      const form = parseForm(tableForm);
      const patches: Patch[] = [{ op: 'delete_table', fieldId: 'data', value: 0 }];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('rejected');
      expect(result.rejectedPatches[0]?.message).toContain('out of bounds');
    });

    it('rejects delete_string_list on field with no existing items', () => {
      const form = parseForm(stringListForm);
      const patches: Patch[] = [{ op: 'delete_string_list', fieldId: 'tags', value: 0 }];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('rejected');
      expect(result.rejectedPatches[0]?.message).toContain('out of bounds');
    });

    it('rejects delete_url_list on field with no existing items', () => {
      const form = parseForm(urlListForm);
      const patches: Patch[] = [{ op: 'delete_url_list', fieldId: 'refs', value: 0 }];
      const result = applyPatches(form, patches);
      expect(result.applyStatus).toBe('rejected');
      expect(result.rejectedPatches[0]?.message).toContain('out of bounds');
    });
  });
});
