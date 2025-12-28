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

{% field-group id="group1" title="Group 1" %}
{% string-field id="name" label="Name" required=true %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" title="G1" %}
{% string-field id="company" label="Company" %}
\`\`\`value
ACME Corp
\`\`\`
{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" title="G1" %}
{% number-field id="revenue" label="Revenue" %}
\`\`\`value
1234.56
\`\`\`
{% /number-field %}
{% /field-group %}

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

{% field-group id="g1" title="G1" %}
{% string-list id="tags" label="Tags" %}
\`\`\`value
Tag One
Tag Two
Tag Three
\`\`\`
{% /string-list %}
{% /field-group %}

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

{% field-group id="g1" title="G1" %}
{% single-select id="rating" label="Rating" %}
- [ ] Bullish {% #bullish %}
- [x] Neutral {% #neutral %}
- [ ] Bearish {% #bearish %}
{% /single-select %}
{% /field-group %}

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

{% field-group id="g1" title="G1" %}
{% multi-select id="categories" label="Categories" %}
- [x] Tech {% #tech %}
- [ ] Health {% #health %}
- [x] Finance {% #finance %}
{% /multi-select %}
{% /field-group %}

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

{% field-group id="g1" title="G1" %}
{% checkboxes id="tasks" label="Tasks" checkboxMode="multi" %}
- [x] Done task {% #done_task %}
- [/] In progress {% #in_progress %}
- [*] Active {% #active_task %}
- [-] Not applicable {% #na_task %}
- [ ] Todo {% #todo_task %}
{% /checkboxes %}
{% /field-group %}

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

{% field-group id="g1" title="G1" %}
{% checkboxes id="confirms" label="Confirms" checkboxMode="explicit" %}
- [y] Yes answer {% #yes_item %}
- [n] No answer {% #no_item %}
- [ ] Unfilled {% #unfilled_item %}
{% /checkboxes %}
{% /field-group %}

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

{% field-group id="group1" %}
{% string-field id="field1" label="Field 1" %}{% /string-field %}
{% single-select id="select1" label="Select 1" %}
- [ ] Option A {% #opt_a %}
- [ ] Option B {% #opt_b %}
{% /single-select %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="first" label="First" %}{% /string-field %}
{% string-field id="second" label="Second" %}{% /string-field %}
{% string-field id="third" label="Third" %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name 1" %}{% /string-field %}
{% string-field id="name" label="Name 2" %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% single-select id="sel" label="Select" %}
- [ ] Option 1 {% #opt %}
- [ ] Option 2 {% #opt %}
{% /single-select %}
{% /field-group %}

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

{% field-group id="g1" %}
{% single-select id="sel" label="Select" %}
- [ ] Option without ID
{% /single-select %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}

{% description ref="name" %}
This is a description.
{% /description %}

{% instructions ref="name" %}
Enter your full name.
{% /instructions %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}

{% description ref="name" %}
First description.
{% /description %}

{% description ref="name" %}
Second description.
{% /description %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}

{% instructions ref="name" %}
First instructions.
{% /instructions %}

{% instructions ref="name" %}
Second instructions.
{% /instructions %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}

{% description ref="name" %}
What this field is.
{% /description %}

{% instructions ref="name" %}
How to fill this field.
{% /instructions %}

{% documentation ref="name" %}
Additional context.
{% /documentation %}
{% /field-group %}

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

{% field-group id="g1" %}
{% checkboxes id="confirms" label="Confirms" checkboxMode="explicit" required=false %}
- [ ] Option 1 {% #opt1 %}
{% /checkboxes %}
{% /field-group %}

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

{% field-group id="g1" %}
{% checkboxes id="confirms" label="Confirms" checkboxMode="explicit" %}
- [ ] Option 1 {% #opt1 %}
{% /checkboxes %}
{% /field-group %}

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

{% field-group id="g1" %}
{% checkboxes id="confirms" label="Confirms" checkboxMode="explicit" required=true %}
- [ ] Option 1 {% #opt1 %}
{% /checkboxes %}
{% /field-group %}

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

{% field-group id="g1" %}
{% checkboxes id="tasks" label="Tasks" checkboxMode="multi" %}
- [ ] Option 1 {% #opt1 %}
{% /checkboxes %}
{% /field-group %}

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

{% field-group id="g1" %}
{% checkboxes id="items" label="Items" checkboxMode="simple" %}
- [ ] Option 1 {% #opt1 %}
{% /checkboxes %}
{% /field-group %}

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

{% field-group id="g1" %}
{% checkboxes id="tasks" label="Tasks" %}
- [ ] Option 1 {% #opt1 %}
{% /checkboxes %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" state="skipped" %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% number-field id="revenue" label="Revenue" state="aborted" %}{% /number-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% checkboxes id="tasks" label="Tasks" state="skipped" %}
- [ ] Task 1 {% #t1 %}
{% /checkboxes %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true state="skipped" %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name" state="skipped" %}
\`\`\`value
John
\`\`\`
{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% number-field id="count" label="Count" state="aborted" %}
\`\`\`value
42
\`\`\`
{% /number-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}
\`\`\`value
Alice
\`\`\`
{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" %}
\`\`\`value
%SKIP%
\`\`\`
{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% url-field id="website" label="Website" %}
\`\`\`value
%ABORT%
\`\`\`
{% /url-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% number-field id="revenue" label="Revenue" %}
\`\`\`value
%SKIP%
\`\`\`
{% /number-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-list id="tags" label="Tags" %}
\`\`\`value
%ABORT%
\`\`\`
{% /string-list %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" state="aborted" %}
\`\`\`value
%SKIP%
\`\`\`
{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% date-field id="deadline" label="Deadline" %}
\`\`\`value
%SKIP%
\`\`\`
{% /date-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% date-field id="deadline" label="Deadline" %}
\`\`\`value
%ABORT%
\`\`\`
{% /date-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% year-field id="founded" label="Founded Year" %}
\`\`\`value
%SKIP%
\`\`\`
{% /year-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% year-field id="founded" label="Founded Year" %}
\`\`\`value
%ABORT%
\`\`\`
{% /year-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% date-field id="deadline" label="Deadline" required=true %}
\`\`\`value
%SKIP%
\`\`\`
{% /date-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% year-field id="founded" label="Founded Year" required=true %}
\`\`\`value
%SKIP%
\`\`\`
{% /year-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% date-field id="deadline" label="Deadline" %}
\`\`\`value
%SKIP% (No deadline set for this project)
\`\`\`
{% /date-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% year-field id="founded" label="Founded Year" %}
\`\`\`value
%ABORT% (Unable to determine founding year)
\`\`\`
{% /year-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="revenue" label="Revenue" state="skipped" %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% string-field id="bio" label="Bio" %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name" placeholder="Enter your name" %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name" examples="John Doe" %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-field id="name" label="Name" examples=["John Doe", "Jane Smith", "Alice Johnson"] %}{% /string-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% number-field id="age" label="Age" placeholder="25" examples=["18", "25", "65"] %}{% /number-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% url-field id="website" label="Website" placeholder="https://example.com" examples=["https://example.com", "https://github.com"] %}{% /url-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% string-list id="tags" label="Tags" placeholder="technology" examples=["tech", "science", "business"] %}{% /string-list %}
{% /field-group %}

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

{% field-group id="g1" %}
{% url-list id="sources" label="Sources" placeholder="https://example.com" examples=["https://example.com/1", "https://example.com/2"] %}{% /url-list %}
{% /field-group %}

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

{% field-group id="g1" %}
{% single-select id="priority" label="Priority" placeholder="Select one" %}
- [ ] Low {% #low %}
- [ ] High {% #high %}
{% /single-select %}
{% /field-group %}

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

{% field-group id="g1" %}
{% multi-select id="categories" label="Categories" examples=["cat1", "cat2"] %}
- [ ] Option 1 {% #opt1 %}
- [ ] Option 2 {% #opt2 %}
{% /multi-select %}
{% /field-group %}

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

{% field-group id="g1" %}
{% checkboxes id="tasks" label="Tasks" placeholder="Check all that apply" %}
- [ ] Task 1 {% #t1 %}
- [ ] Task 2 {% #t2 %}
{% /checkboxes %}
{% /field-group %}

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

{% field-group id="g1" %}
{% number-field id="age" label="Age" examples=["25", "not-a-number", "30"] %}{% /number-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% url-field id="website" label="Website" examples=["https://example.com", "not-a-url"] %}{% /url-field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% url-list id="sources" label="Sources" examples=["not-a-url", "https://example.com"] %}{% /url-list %}
{% /field-group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/invalid example.*not-a-url.*must be a valid URL/i);
    });
  });

  describe('table-field with attribute-based columns', () => {
    it('validates header row matches attribute-defined columns', () => {
      // With attribute-based columns, the parser should validate that the header row
      // matches the defined column IDs/labels. If headers are reordered or mismatched,
      // it should still map values correctly by header name, not position.
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" title="G1" %}
{% table-field id="people" label="People" columnIds=["name", "age"] columnLabels=["Name", "Age"] columnTypes=["string", "number"] %}

| Age | Name |
| --- | --- |
| 25 | Alice |
| 30 | Bob |

{% /table-field %}
{% /field-group %}

{% /form %}
`;
      const result = parseForm(markdown);
      const value = result.responsesByFieldId.people?.value;

      expect(value).toBeDefined();
      expect(value?.kind).toBe('table');
      if (value?.kind === 'table') {
        // With proper header validation, values should be mapped by header name
        // Age column contains 25, 30 and Name column contains Alice, Bob
        // If parsed correctly by header matching:
        // Cells are CellResponse objects with { state, value }
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

{% field-group id="g1" title="G1" %}
{% table-field id="items" label="Items" columnIds=["id", "name"] columnLabels=["ID", "Name"] columnTypes=["number", "string"] %}

| ID | Name |
| not-valid-separator |
| 1 | Item1 |

{% /table-field %}
{% /field-group %}

{% /form %}
`;
      // Should throw because separator row is malformed
      expect(() => parseForm(markdown)).toThrow(ParseError);
    });
  });
});
