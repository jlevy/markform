import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseForm, ParseError } from '../../../src/engine/parse.js';

describe('engine/parse', () => {
  describe('parseForm', () => {
    it('parses a minimal form', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test_form" title="Test Form" %}

{% group id="group1" title="Group 1" %}
{% field kind="string" id="name" label="Name" required=true %}{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.schema.id).toBe('test_form');
      expect(result.schema.title).toBe('Test Form');
      expect(result.schema.groups).toHaveLength(1);

      const group = result.schema.groups[0];
      expect(group?.id).toBe('group1');
      expect(group?.children).toHaveLength(1);

      const field = group?.children[0];
      expect(field?.kind).toBe('string');
      expect(field?.id).toBe('name');
      expect(field?.label).toBe('Name');
    });

    it('parses string field with value', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" title="G1" %}
{% field kind="string" id="company" label="Company" %}
\`\`\`value
ACME Corp
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const value = result.responsesByFieldId.company?.value;

      expect(value).toBeDefined();
      expect(value?.kind).toBe('string');
      if (value?.kind === 'string') {
        expect(value.value).toBe('ACME Corp');
      }
    });

    it('parses number field with value', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" title="G1" %}
{% field kind="number" id="revenue" label="Revenue" %}
\`\`\`value
1234.56
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const value = result.responsesByFieldId.revenue?.value;

      expect(value).toBeDefined();
      expect(value?.kind).toBe('number');
      if (value?.kind === 'number') {
        expect(value.value).toBe(1234.56);
      }
    });

    it('parses string-list field with values', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" title="G1" %}
{% field kind="string_list" id="tags" label="Tags" %}
\`\`\`value
Tag One
Tag Two
Tag Three
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const value = result.responsesByFieldId.tags?.value;

      expect(value).toBeDefined();
      expect(value?.kind).toBe('string_list');
      if (value?.kind === 'string_list') {
        expect(value.items).toEqual(['Tag One', 'Tag Two', 'Tag Three']);
      }
    });

    it('parses single-select field with selection', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" title="G1" %}
{% field kind="single_select" id="rating" label="Rating" %}
- [ ] Bullish {% #bullish %}
- [x] Neutral {% #neutral %}
- [ ] Bearish {% #bearish %}
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);

      // Check field schema
      const group = result.schema.groups[0];
      const field = group?.children[0];
      expect(field?.kind).toBe('single_select');
      if (field?.kind === 'single_select') {
        expect(field.options).toHaveLength(3);
        expect(field.options[0]?.id).toBe('bullish');
        expect(field.options[1]?.id).toBe('neutral');
        expect(field.options[2]?.id).toBe('bearish');
      }

      // Check value
      const value = result.responsesByFieldId.rating?.value;
      expect(value?.kind).toBe('single_select');
      if (value?.kind === 'single_select') {
        expect(value.selected).toBe('neutral');
      }
    });

    it('parses multi-select field with selections', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" title="G1" %}
{% field kind="multi_select" id="categories" label="Categories" %}
- [x] Tech {% #tech %}
- [ ] Health {% #health %}
- [x] Finance {% #finance %}
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const value = result.responsesByFieldId.categories?.value;

      expect(value?.kind).toBe('multi_select');
      if (value?.kind === 'multi_select') {
        expect(value.selected).toContain('tech');
        expect(value.selected).toContain('finance');
        expect(value.selected).not.toContain('health');
      }
    });

    it('parses checkboxes field with multi mode', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" title="G1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="multi" %}
- [x] Done task {% #done_task %}
- [/] In progress {% #in_progress %}
- [*] Active {% #active_task %}
- [-] Not applicable {% #na_task %}
- [ ] Todo {% #todo_task %}
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const value = result.responsesByFieldId.tasks?.value;

      expect(value?.kind).toBe('checkboxes');
      if (value?.kind === 'checkboxes') {
        expect(value.values.done_task).toBe('done');
        expect(value.values.in_progress).toBe('incomplete');
        expect(value.values.active_task).toBe('active');
        expect(value.values.na_task).toBe('na');
        expect(value.values.todo_task).toBe('todo');
      }
    });

    it('parses checkboxes field with explicit mode', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" title="G1" %}
{% field kind="checkboxes" id="confirms" label="Confirms" checkboxMode="explicit" %}
- [y] Yes answer {% #yes_item %}
- [n] No answer {% #no_item %}
- [ ] Unfilled {% #unfilled_item %}
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const value = result.responsesByFieldId.confirms?.value;

      expect(value?.kind).toBe('checkboxes');
      if (value?.kind === 'checkboxes') {
        expect(value.values.yes_item).toBe('yes');
        expect(value.values.no_item).toBe('no');
        expect(value.values.unfilled_item).toBe('unfilled');
      }
    });

    it('builds idIndex correctly', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test_form" %}

{% group id="group1" %}
{% field kind="string" id="field1" label="Field 1" %}{% /field %}
{% field kind="single_select" id="select1" label="Select 1" %}
- [ ] Option A {% #opt_a %}
- [ ] Option B {% #opt_b %}
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.idIndex.get('test_form')?.nodeType).toBe('form');
      expect(result.idIndex.get('group1')?.nodeType).toBe('group');
      expect(result.idIndex.get('field1')?.nodeType).toBe('field');
      expect(result.idIndex.get('select1')?.nodeType).toBe('field');
      expect(result.idIndex.get('select1.opt_a')?.nodeType).toBe('option');
      expect(result.idIndex.get('select1.opt_b')?.nodeType).toBe('option');
    });

    it('maintains order in orderIndex', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="first" label="First" %}{% /field %}
{% field kind="string" id="second" label="Second" %}{% /field %}
{% field kind="string" id="third" label="Third" %}{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.orderIndex).toEqual(['first', 'second', 'third']);
    });

    it('throws on duplicate IDs', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name 1" %}{% /field %}
{% field kind="string" id="name" label="Name 2" %}{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
    });

    it('throws on duplicate option IDs within field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="single_select" id="sel" label="Select" %}
- [ ] Option 1 {% #opt %}
- [ ] Option 2 {% #opt %}
{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
    });

    it('throws on missing option ID annotation', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="single_select" id="sel" label="Select" %}
- [ ] Option without ID
{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
    });

    it('throws on missing label attribute', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" %}{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
    });

    it('throws when no form tag present', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

No form here.
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
    });

    it('throws on unknown tag inside form', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% unknown-tag id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /unknown-tag %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/unknown.*tag.*unknown-tag/i);
    });

    it('throws on legacy field-group tag as unknown tag', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /field-group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/unknown.*tag.*field-group/i);
    });
  });

  describe('parseForm with simple.form.md', () => {
    it('parses the simple test form', async () => {
      const formPath = join(import.meta.dirname, '../../../examples/simple/simple.form.md');
      const content = await readFile(formPath, 'utf-8');
      const result = parseForm(content);

      // Basic structure checks
      expect(result.schema.id).toBe('simple_test');
      expect(result.schema.title).toBe('Simple Test Form');
      expect(result.schema.groups.length).toBeGreaterThan(0);

      // Check that we got expected fields
      const fieldIds = result.orderIndex;
      expect(fieldIds).toContain('name');
      expect(fieldIds).toContain('email');
      expect(fieldIds).toContain('age');
      expect(fieldIds).toContain('tags');
      expect(fieldIds).toContain('priority');
      expect(fieldIds).toContain('categories');
      expect(fieldIds).toContain('tasks_multi');
      expect(fieldIds).toContain('tasks_simple');
      expect(fieldIds).toContain('confirmations');

      // Check idIndex has form, groups, fields, and options
      expect(result.idIndex.get('simple_test')?.nodeType).toBe('form');
      expect(result.idIndex.get('basic_fields')?.nodeType).toBe('group');
      expect(result.idIndex.get('name')?.nodeType).toBe('field');
      expect(result.idIndex.get('priority.low')?.nodeType).toBe('option');
    });
  });

  describe('documentation tag edge cases', () => {
    it('allows multiple doc tags with same ref but different tags', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}

{% description ref="name" %}
This is a description.
{% /description %}

{% instructions ref="name" %}
Enter your full name.
{% /instructions %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      expect(result.docs).toHaveLength(2);
      expect(result.docs[0]?.tag).toBe('description');
      expect(result.docs[1]?.tag).toBe('instructions');
    });

    it('throws on duplicate description blocks for same ref', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}

{% description ref="name" %}
First description.
{% /description %}

{% description ref="name" %}
Second description.
{% /description %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/Duplicate description block/);
    });

    it('throws on duplicate instructions blocks for same ref', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}

{% instructions ref="name" %}
First instructions.
{% /instructions %}

{% instructions ref="name" %}
Second instructions.
{% /instructions %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/Duplicate instructions block/);
    });

    it('allows all three tag types for same ref', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}

{% description ref="name" %}
What this field is.
{% /description %}

{% instructions ref="name" %}
How to fill this field.
{% /instructions %}

{% documentation ref="name" %}
Additional context.
{% /documentation %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      expect(result.docs).toHaveLength(3);
      expect(result.docs[0]?.tag).toBe('description');
      expect(result.docs[1]?.tag).toBe('instructions');
      expect(result.docs[2]?.tag).toBe('documentation');
    });
  });

  describe('checkbox mode/required constraints', () => {
    it('rejects explicit mode with required=false', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test_form" %}

{% group id="g1" %}
{% field kind="checkboxes" id="confirms" label="Confirms" checkboxMode="explicit" required=false %}
- [ ] Option 1 {% #opt1 %}
{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/explicit.*inherently required/i);
    });

    it('accepts explicit mode without required attribute (defaults to true)', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="confirms" label="Confirms" checkboxMode="explicit" %}
- [ ] Option 1 {% #opt1 %}
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const field = result.schema.groups[0]?.children[0];
      expect(field?.kind).toBe('checkboxes');
      if (field?.kind === 'checkboxes') {
        expect(field.required).toBe(true);
      }
    });

    it('accepts explicit mode with required=true (redundant but valid)', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="confirms" label="Confirms" checkboxMode="explicit" required=true %}
- [ ] Option 1 {% #opt1 %}
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const field = result.schema.groups[0]?.children[0];
      expect(field?.kind).toBe('checkboxes');
      if (field?.kind === 'checkboxes') {
        expect(field.required).toBe(true);
      }
    });

    it('multi mode defaults to optional', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="multi" %}
- [ ] Option 1 {% #opt1 %}
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const field = result.schema.groups[0]?.children[0];
      expect(field?.kind).toBe('checkboxes');
      if (field?.kind === 'checkboxes') {
        expect(field.required).toBe(false);
      }
    });

    it('simple mode defaults to optional', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="items" label="Items" checkboxMode="simple" %}
- [ ] Option 1 {% #opt1 %}
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const field = result.schema.groups[0]?.children[0];
      expect(field?.kind).toBe('checkboxes');
      if (field?.kind === 'checkboxes') {
        expect(field.required).toBe(false);
      }
    });

    it('default checkboxMode (multi) defaults to optional', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" %}
- [ ] Option 1 {% #opt1 %}
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const field = result.schema.groups[0]?.children[0];
      expect(field?.kind).toBe('checkboxes');
      if (field?.kind === 'checkboxes') {
        expect(field.required).toBe(false);
        expect(field.checkboxMode).toBe('multi');
      }
    });
  });

  describe('unified response model - parse state attribute (markform-230)', () => {
    it('parses state="skipped" on unfilled optional string field', () => {
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
      const result = parseForm(markdown);
      const response = result.responsesByFieldId.notes;

      expect(response).toBeDefined();
      expect(response?.state).toBe('skipped');
      expect(response?.value).toBeUndefined();
    });

    it('parses state="aborted" on unfilled number field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="number" id="revenue" label="Revenue" state="aborted" %}{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const response = result.responsesByFieldId.revenue;

      expect(response).toBeDefined();
      expect(response?.state).toBe('aborted');
      expect(response?.value).toBeUndefined();
    });

    it('parses state="skipped" on unfilled checkboxes field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" state="skipped" %}
- [ ] Task 1 {% #t1 %}
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const response = result.responsesByFieldId.tasks;

      expect(response).toBeDefined();
      expect(response?.state).toBe('skipped');
      expect(response?.value).toBeUndefined();
    });

    it('throws error on state="skipped" for required field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true state="skipped" %}{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/cannot skip required field/i);
    });

    it('throws error on state="skipped" with filled field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" state="skipped" %}
\`\`\`value
John
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/state.*skipped.*cannot have values/i);
    });

    it('throws error on state="aborted" with filled field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="number" id="count" label="Count" state="aborted" %}
\`\`\`value
42
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/state.*aborted.*cannot have values/i);
    });

    it('infers state="empty" for unfilled field without state attribute', () => {
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
      const result = parseForm(markdown);
      const response = result.responsesByFieldId.notes;

      expect(response?.state).toBe('unanswered');
      expect(response?.value).toBeUndefined();
    });

    it('infers state="answered" for filled field without state attribute', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}
\`\`\`value
Alice
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const response = result.responsesByFieldId.name;

      expect(response?.state).toBe('answered');
      expect(response?.value).toBeDefined();
      expect(response?.value?.kind).toBe('string');
    });
  });

  describe('unified response model - parse sentinels (markform-231)', () => {
    it('parses %SKIP% sentinel in string field value fence', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" %}
\`\`\`value
%SKIP%
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const response = result.responsesByFieldId.notes;

      expect(response).toBeDefined();
      expect(response?.state).toBe('skipped');
      expect(response?.value).toBeUndefined();
    });

    it('parses %ABORT% sentinel in url field value fence', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url" id="website" label="Website" %}
\`\`\`value
%ABORT%
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const response = result.responsesByFieldId.website;

      expect(response).toBeDefined();
      expect(response?.state).toBe('aborted');
      expect(response?.value).toBeUndefined();
    });

    it('parses %SKIP% in number field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="number" id="revenue" label="Revenue" %}
\`\`\`value
%SKIP%
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const response = result.responsesByFieldId.revenue;

      expect(response?.state).toBe('skipped');
      expect(response?.value).toBeUndefined();
    });

    it('parses %ABORT% in string-list field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" %}
\`\`\`value
%ABORT%
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const response = result.responsesByFieldId.tags;

      expect(response?.state).toBe('aborted');
      expect(response?.value).toBeUndefined();
    });

    it('throws error on %SKIP% sentinel with state="aborted" attribute conflict', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" state="aborted" %}
\`\`\`value
%SKIP%
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/conflicting state/i);
    });

    it('parses %SKIP% in date-field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="date" id="deadline" label="Deadline" %}
\`\`\`value
%SKIP%
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const response = result.responsesByFieldId.deadline;

      expect(response?.state).toBe('skipped');
      expect(response?.value).toBeUndefined();
    });

    it('parses %ABORT% in date-field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="date" id="deadline" label="Deadline" %}
\`\`\`value
%ABORT%
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const response = result.responsesByFieldId.deadline;

      expect(response?.state).toBe('aborted');
      expect(response?.value).toBeUndefined();
    });

    it('parses %SKIP% in year-field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="year" id="founded" label="Founded Year" %}
\`\`\`value
%SKIP%
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const response = result.responsesByFieldId.founded;

      expect(response?.state).toBe('skipped');
      expect(response?.value).toBeUndefined();
    });

    it('parses %ABORT% in year-field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="year" id="founded" label="Founded Year" %}
\`\`\`value
%ABORT%
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const response = result.responsesByFieldId.founded;

      expect(response?.state).toBe('aborted');
      expect(response?.value).toBeUndefined();
    });

    it('throws error on %SKIP% in required date-field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="date" id="deadline" label="Deadline" required=true %}
\`\`\`value
%SKIP%
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/required.*%SKIP%/i);
    });

    it('throws error on %SKIP% in required year-field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="year" id="founded" label="Founded Year" required=true %}
\`\`\`value
%SKIP%
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/required.*%SKIP%/i);
    });

    it('parses %SKIP% with reason in date-field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="date" id="deadline" label="Deadline" %}
\`\`\`value
%SKIP% (No deadline set for this project)
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const response = result.responsesByFieldId.deadline;

      expect(response?.state).toBe('skipped');
      expect(response?.reason).toBe('No deadline set for this project');
      expect(response?.value).toBeUndefined();
    });

    it('parses %ABORT% with reason in year-field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="year" id="founded" label="Founded Year" %}
\`\`\`value
%ABORT% (Unable to determine founding year)
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const response = result.responsesByFieldId.founded;

      expect(response?.state).toBe('aborted');
      expect(response?.reason).toBe('Unable to determine founding year');
      expect(response?.value).toBeUndefined();
    });
  });

  describe('unified response model - parse notes (markform-232)', () => {
    it('parses note with all required attributes', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% /group %}

{% note id="n1" ref="notes" role="agent" %}
This field is not applicable for this analysis.
{% /note %}

{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.notes).toHaveLength(1);
      expect(result.notes[0]?.id).toBe('n1');
      expect(result.notes[0]?.ref).toBe('notes');
      expect(result.notes[0]?.role).toBe('agent');
      expect(result.notes[0]?.text).toContain('not applicable');
    });

    it('rejects note with state attribute', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="revenue" label="Revenue" state="skipped" %}{% /field %}
{% /group %}

{% note id="n1" ref="revenue" role="agent" state="skipped" %}
Company is private, revenue not disclosed.
{% /note %}

{% /form %}
`;
      // Per markform-254, notes no longer support state attribute
      expect(() => parseForm(markdown)).toThrow(/state.*attribute/i);
    });

    it('parses multiple notes', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% field kind="string" id="bio" label="Bio" %}{% /field %}
{% /group %}

{% note id="n1" ref="name" role="agent" %}
First note.
{% /note %}

{% note id="n2" ref="bio" role="user" %}
Second note.
{% /note %}

{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.notes).toHaveLength(2);
      expect(result.notes[0]?.id).toBe('n1');
      expect(result.notes[1]?.id).toBe('n2');
    });

    it('throws error on note with invalid ref', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% note id="n1" ref="nonexistent" role="agent" %}
Note text.
{% /note %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/unknown.*nonexistent/i);
    });

    it('throws error on note missing required id attribute', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% note ref="name" role="agent" %}
Note text.
{% /note %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/missing.*id/i);
    });

    it('throws error on note missing required ref attribute', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% note id="n1" role="agent" %}
Note text.
{% /note %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/missing.*ref/i);
    });

    it('throws error on note missing required role attribute', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% note id="n1" ref="name" %}
Note text.
{% /note %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/missing.*role/i);
    });
  });

  describe('placeholder and examples attributes (markform-345)', () => {
    it('parses placeholder on string field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" placeholder="Enter your name" %}{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const field = result.schema.groups[0]?.children[0];

      expect(field?.placeholder).toBe('Enter your name');
    });

    it('parses examples as single string on string field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" examples="John Doe" %}{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const field = result.schema.groups[0]?.children[0];

      expect(field?.examples).toEqual(['John Doe']);
    });

    it('parses examples as array on string field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" examples=["John Doe", "Jane Smith", "Alice Johnson"] %}{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const field = result.schema.groups[0]?.children[0];

      expect(field?.examples).toEqual(['John Doe', 'Jane Smith', 'Alice Johnson']);
    });

    it('parses placeholder and examples on number field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="number" id="age" label="Age" placeholder="25" examples=["18", "25", "65"] %}{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const field = result.schema.groups[0]?.children[0];

      expect(field?.placeholder).toBe('25');
      expect(field?.examples).toEqual(['18', '25', '65']);
    });

    it('parses placeholder and examples on url field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url" id="website" label="Website" placeholder="https://example.com" examples=["https://example.com", "https://github.com"] %}{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const field = result.schema.groups[0]?.children[0];

      expect(field?.placeholder).toBe('https://example.com');
      expect(field?.examples).toEqual(['https://example.com', 'https://github.com']);
    });

    it('parses placeholder on string-list field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" placeholder="technology" examples=["tech", "science", "business"] %}{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const field = result.schema.groups[0]?.children[0];

      expect(field?.placeholder).toBe('technology');
      expect(field?.examples).toEqual(['tech', 'science', 'business']);
    });

    it('parses placeholder on url-list field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" placeholder="https://example.com" examples=["https://example.com/1", "https://example.com/2"] %}{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const field = result.schema.groups[0]?.children[0];

      expect(field?.placeholder).toBe('https://example.com');
      expect(field?.examples).toEqual(['https://example.com/1', 'https://example.com/2']);
    });

    it('throws error on placeholder for single-select field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="single_select" id="priority" label="Priority" placeholder="Select one" %}
- [ ] Low {% #low %}
- [ ] High {% #high %}
{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/placeholder.*only valid on text-entry fields/i);
    });

    it('throws error on examples for multi-select field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="multi_select" id="categories" label="Categories" examples=["cat1", "cat2"] %}
- [ ] Option 1 {% #opt1 %}
- [ ] Option 2 {% #opt2 %}
{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/examples.*only valid on text-entry fields/i);
    });

    it('throws error on placeholder for checkboxes field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" placeholder="Check all that apply" %}
- [ ] Task 1 {% #t1 %}
- [ ] Task 2 {% #t2 %}
{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/placeholder.*only valid on text-entry fields/i);
    });

    it('throws error on invalid number example', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="number" id="age" label="Age" examples=["25", "not-a-number", "30"] %}{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(
        /invalid example.*not-a-number.*must be a valid number/i,
      );
    });

    it('throws error on invalid URL example', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url" id="website" label="Website" examples=["https://example.com", "not-a-url"] %}{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/invalid example.*not-a-url.*must be a valid URL/i);
    });

    it('throws error on invalid URL example in url-list', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" examples=["not-a-url", "https://example.com"] %}{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/invalid example.*not-a-url.*must be a valid URL/i);
    });
  });

  describe('table-field with attribute-based columns', () => {
    it('parses table data positionally based on columnIds order', () => {
      // With attribute-based columns, data is parsed positionally based on columnIds order
      // Header row is used for display labels (backfilled to columnLabels if not provided)
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" title="G1" %}
{% field kind="table" id="people" label="People" columnIds=["name", "age"] columnTypes=["string", "number"] %}

| Name | Age |
| --- | --- |
| Alice | 25 |
| Bob | 30 |

{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const value = result.responsesByFieldId.people?.value;

      expect(value).toBeDefined();
      expect(value?.kind).toBe('table');
      if (value?.kind === 'table') {
        // Data is parsed positionally: first cell goes to first columnId, etc.
        expect(value.rows[0]?.name?.value).toBe('Alice');
        expect(value.rows[0]?.age?.value).toBe(25);
        expect(value.rows[1]?.name?.value).toBe('Bob');
        expect(value.rows[1]?.age?.value).toBe(30);
      }
    });

    it('rejects table with invalid separator when using attribute columns', () => {
      // With attribute-based columns, header/separator validation should still apply
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" title="G1" %}
{% field kind="table" id="items" label="Items" columnIds=["id", "name"] columnLabels=["ID", "Name"] columnTypes=["number", "string"] %}

| ID | Name |
| not-valid-separator |
| 1 | Item1 |

{% /field %}
{% /group %}

{% /form %}
`;
      // Should throw because separator row is malformed
      expect(() => parseForm(markdown)).toThrow(ParseError);
    });
  });

  describe('fields outside groups (markform-371)', () => {
    it('parses field directly under form (outside group)', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field kind="string" id="movie" label="Favorite Movie" %}{% /field %}

{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.schema.groups).toHaveLength(1);
      expect(result.schema.groups[0]?.implicit).toBe(true);
      expect(result.schema.groups[0]?.children).toHaveLength(1);
      expect(result.schema.groups[0]?.children[0]?.id).toBe('movie');
      expect(result.idIndex.get('movie')?.nodeType).toBe('field');
    });

    it('allows instructions to reference ungrouped field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field kind="string" id="movie" label="Favorite Movie" %}{% /field %}

{% instructions ref="movie" %}
Please enter your favorite movie.
{% /instructions %}

{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.docs).toHaveLength(1);
      expect(result.docs[0]?.ref).toBe('movie');
      expect(result.docs[0]?.tag).toBe('instructions');
    });

    it('allows instructions before ungrouped field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% instructions ref="movie" %}
Please enter your favorite movie.
{% /instructions %}

{% field kind="string" id="movie" label="Favorite Movie" %}{% /field %}

{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.docs).toHaveLength(1);
      expect(result.docs[0]?.ref).toBe('movie');
      expect(result.schema.groups[0]?.children[0]?.id).toBe('movie');
    });

    it('parses multiple ungrouped fields', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field kind="string" id="name" label="Name" %}{% /field %}
{% field kind="number" id="age" label="Age" %}{% /field %}

{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.schema.groups).toHaveLength(1);
      expect(result.schema.groups[0]?.implicit).toBe(true);
      expect(result.schema.groups[0]?.children).toHaveLength(2);
      expect(result.orderIndex).toContain('name');
      expect(result.orderIndex).toContain('age');
    });

    it('handles mix of grouped and ungrouped fields', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field kind="string" id="ungrouped1" label="Ungrouped 1" %}{% /field %}

{% group id="g1" title="Group 1" %}
{% field kind="string" id="grouped" label="Grouped" %}{% /field %}
{% /group %}

{% field kind="string" id="ungrouped2" label="Ungrouped 2" %}{% /field %}

{% /form %}
`;
      const result = parseForm(markdown);

      // Should have the explicit group and an implicit group for ungrouped fields
      expect(result.schema.groups.length).toBeGreaterThanOrEqual(2);

      // Check explicit group
      const explicitGroup = result.schema.groups.find((g) => g.id === 'g1');
      expect(explicitGroup).toBeDefined();
      expect(explicitGroup?.implicit).toBeUndefined();

      // Check implicit group
      const implicitGroup = result.schema.groups.find((g) => g.implicit === true);
      expect(implicitGroup).toBeDefined();
      expect(implicitGroup?.children.length).toBe(2);

      // All fields should be in idIndex
      expect(result.idIndex.get('ungrouped1')?.nodeType).toBe('field');
      expect(result.idIndex.get('grouped')?.nodeType).toBe('field');
      expect(result.idIndex.get('ungrouped2')?.nodeType).toBe('field');
    });

    it('allows description and documentation blocks for ungrouped fields', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field kind="string" id="movie" label="Favorite Movie" %}{% /field %}

{% description ref="movie" %}
Your all-time favorite film.
{% /description %}

{% documentation ref="movie" %}
This field is used for analytics.
{% /documentation %}

{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.docs).toHaveLength(2);
      expect(result.docs.find((d) => d.tag === 'description')?.ref).toBe('movie');
      expect(result.docs.find((d) => d.tag === 'documentation')?.ref).toBe('movie');
    });

    it('parses ungrouped select field with options', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field kind="single_select" id="rating" label="Rating" %}
- [ ] Good {% #good %}
- [ ] Bad {% #bad %}
{% /field %}

{% instructions ref="rating" %}
Rate your experience.
{% /instructions %}

{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.schema.groups[0]?.implicit).toBe(true);
      expect(result.idIndex.get('rating')?.nodeType).toBe('field');
      expect(result.idIndex.get('rating.good')?.nodeType).toBe('option');
      expect(result.idIndex.get('rating.bad')?.nodeType).toBe('option');
      expect(result.docs[0]?.ref).toBe('rating');
    });

    it('rejects _default as user-defined ID when ungrouped fields exist', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="_default" title="My Group" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% field kind="string" id="ungrouped" label="Ungrouped" %}{% /field %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(
        /ID '_default' is reserved for implicit field groups/,
      );
    });

    it('allows _default as user-defined ID when no ungrouped fields', () => {
      // _default is only reserved when there are ungrouped fields
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="_default" title="My Group" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);
      expect(result.schema.groups[0]?.id).toBe('_default');
      expect(result.schema.groups[0]?.implicit).toBeUndefined();
    });
  });

  describe('unified field syntax error cases', () => {
    it('throws error for field tag without kind attribute', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field id="name" label="Name" %}{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/field tag missing required 'kind' attribute/);
    });

    it('throws error for field tag with invalid kind', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="invalid" id="name" label="Name" %}{% /field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/field tag has invalid kind 'invalid'/);
      expect(() => parseForm(markdown)).toThrow(/Valid kinds:/);
    });

    it('throws error for legacy string-field tag', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(
        /Legacy field tag 'string-field' is no longer supported/,
      );
      expect(() => parseForm(markdown)).toThrow(/Use {% field kind="string" %} instead/);
    });

    it('throws error for legacy number-field tag', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% number-field id="age" label="Age" %}{% /number-field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(
        /Legacy field tag 'number-field' is no longer supported/,
      );
      expect(() => parseForm(markdown)).toThrow(/Use {% field kind="number" %} instead/);
    });

    it('throws error for legacy single-select tag', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% single-select id="priority" label="Priority" %}
- [ ] Low {% #low %}
- [ ] High {% #high %}
{% /single-select %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(
        /Legacy field tag 'single-select' is no longer supported/,
      );
      expect(() => parseForm(markdown)).toThrow(/Use {% field kind="single_select" %} instead/);
    });

    it('throws error for legacy table-field tag', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% table-field id="data" label="Data" columnIds=["col1"] %}
| Col1 |
|------|
{% /table-field %}
{% /group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(
        /Legacy field tag 'table-field' is no longer supported/,
      );
      expect(() => parseForm(markdown)).toThrow(/Use {% field kind="table" %} instead/);
    });
  });
});
