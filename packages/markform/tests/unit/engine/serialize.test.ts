import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';
import { serialize, serializeRawMarkdown } from '../../../src/engine/serialize.js';

describe('engine/serialize', () => {
  describe('serialize', () => {
    it('serializes a minimal form', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      // Parse the output to verify it's valid
      const reparsed = parseForm(output);
      expect(reparsed.schema.id).toBe('test_form');
      expect(reparsed.schema.title).toBe('Test Form');
      expect(reparsed.schema.groups).toHaveLength(1);
    });

    it('serializes string field with value', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.responsesByFieldId.company?.value;
      expect(value?.kind).toBe('string');
      if (value?.kind === 'string') {
        expect(value.value).toBe('ACME Corp');
      }
    });

    it('serializes number field with value', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.responsesByFieldId.revenue?.value;
      expect(value?.kind).toBe('number');
      if (value?.kind === 'number') {
        expect(value.value).toBe(1234.56);
      }
    });

    it('serializes string-list field with values', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.responsesByFieldId.tags?.value;
      expect(value?.kind).toBe('string_list');
      if (value?.kind === 'string_list') {
        expect(value.items).toEqual(['Tag One', 'Tag Two', 'Tag Three']);
      }
    });

    it('serializes single-select field with selection', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      // Check field schema
      const group = reparsed.schema.groups[0];
      const field = group?.children[0];
      expect(field?.kind).toBe('single_select');
      if (field?.kind === 'single_select') {
        expect(field.options).toHaveLength(3);
      }

      // Check value preserved
      const value = reparsed.responsesByFieldId.rating?.value;
      expect(value?.kind).toBe('single_select');
      if (value?.kind === 'single_select') {
        expect(value.selected).toBe('neutral');
      }
    });

    it('serializes multi-select field with selections', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.responsesByFieldId.categories?.value;
      expect(value?.kind).toBe('multi_select');
      if (value?.kind === 'multi_select') {
        expect(value.selected).toContain('tech');
        expect(value.selected).toContain('finance');
        expect(value.selected).not.toContain('health');
      }
    });

    it('serializes checkboxes field with multi mode', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.responsesByFieldId.tasks?.value;
      expect(value?.kind).toBe('checkboxes');
      if (value?.kind === 'checkboxes') {
        expect(value.values.done_task).toBe('done');
        expect(value.values.in_progress).toBe('incomplete');
        expect(value.values.active_task).toBe('active');
        expect(value.values.na_task).toBe('na');
        expect(value.values.todo_task).toBe('todo');
      }
    });

    it('serializes checkboxes field with explicit mode', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.responsesByFieldId.confirms?.value;
      expect(value?.kind).toBe('checkboxes');
      if (value?.kind === 'checkboxes') {
        expect(value.values.yes_item).toBe('yes');
        expect(value.values.no_item).toBe('no');
        expect(value.values.unfilled_item).toBe('unfilled');
      }
    });

    it('preserves field attributes through round-trip', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" title="Group Title" %}
{% field kind="string" id="email" label="Email" required=true minLength=5 maxLength=100 pattern="^[^@]+@[^@]+$" %}{% /field %}
{% field kind="number" id="count" label="Count" required=true min=0 max=1000 integer=true %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const group = reparsed.schema.groups[0];
      expect(group?.title).toBe('Group Title');

      const emailField = group?.children[0];
      expect(emailField?.kind).toBe('string');
      if (emailField?.kind === 'string') {
        expect(emailField.required).toBe(true);
        expect(emailField.minLength).toBe(5);
        expect(emailField.maxLength).toBe(100);
        expect(emailField.pattern).toBe('^[^@]+@[^@]+$');
      }

      const countField = group?.children[1];
      expect(countField?.kind).toBe('number');
      if (countField?.kind === 'number') {
        expect(countField.required).toBe(true);
        expect(countField.min).toBe(0);
        expect(countField.max).toBe(1000);
        expect(countField.integer).toBe(true);
      }
    });

    it('outputs deterministic format', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" title="G1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output1 = serialize(parsed);
      const output2 = serialize(parsed);
      expect(output1).toBe(output2);
    });

    it('serializes validate attribute with object arrays correctly', () => {
      // This test ensures we don't regress on the [object Object] bug
      // where validate=[{id: "min_words", min: 50}] was serialized as [[object Object]]
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" title="G1" %}
{% field kind="string" id="summary" label="Summary" required=true validate=[{id: "min_words", min: 50}] %}{% /field %}
{% field kind="string" id="description" label="Description" validate=[{id: "min_words", min: 25}, {id: "max_words", max: 100}] %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      // Must not contain [object Object] - this was the bug
      expect(output).not.toContain('[object Object]');

      // Should contain properly serialized validate attributes
      expect(output).toContain('validate=[{id: "min_words", min: 50}]');
      expect(output).toContain(
        'validate=[{id: "min_words", min: 25}, {id: "max_words", max: 100}]',
      );

      // Round-trip: parse the output and verify validate is preserved
      const reparsed = parseForm(output);
      const group = reparsed.schema.groups[0];

      const summaryField = group?.children[0];
      expect(summaryField?.kind).toBe('string');
      if (summaryField?.kind === 'string') {
        expect(summaryField.validate).toHaveLength(1);
        expect(summaryField.validate?.[0]).toEqual({ id: 'min_words', min: 50 });
      }

      const descField = group?.children[1];
      expect(descField?.kind).toBe('string');
      if (descField?.kind === 'string') {
        expect(descField.validate).toHaveLength(2);
        expect(descField.validate?.[0]).toEqual({ id: 'min_words', min: 25 });
        expect(descField.validate?.[1]).toEqual({ id: 'max_words', max: 100 });
      }
    });

    it('serializes nested objects in attributes', () => {
      // Test that deeply nested objects are also serialized correctly
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" title="G1" %}
{% field kind="string" id="item" label="Item" validate=[{id: "custom", config: {threshold: 10, enabled: true}}] %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      expect(output).not.toContain('[object Object]');
      expect(output).toContain('config: {threshold: 10, enabled: true}');

      // Verify round-trip
      const reparsed = parseForm(output);
      const field = reparsed.schema.groups[0]?.children[0];
      if (field?.kind === 'string') {
        expect(field.validate?.[0]).toEqual({
          id: 'custom',
          config: { threshold: 10, enabled: true },
        });
      }
    });

    it('serializes doc blocks with proper spacing between tag name and attributes', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string_list" id="notable_awards" label="Notable Awards" %}{% /field %}

{% instructions ref="notable_awards" %}
Major awards won. One per line.
Format: Award | Category | Year
Example: "Oscar | Best Picture | 1995"
{% /instructions %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      // Bug: serialization was missing space between tag name and ref attribute
      // Output was: {% instructionsref="notable_awards" %} instead of {% instructions ref="notable_awards" %}
      expect(output).toContain('{% instructions ref="notable_awards" %}');
      expect(output).not.toContain('{% instructionsref=');

      // Also verify the body content preserves newlines
      expect(output).toContain('One per line.\nFormat:');
    });
  });

  describe('serialize with simple.form.md', () => {
    it('round-trips the simple test form', async () => {
      const formPath = join(import.meta.dirname, '../../../examples/simple/simple.form.md');
      const content = await readFile(formPath, 'utf-8');
      const parsed = parseForm(content);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      // Compare structure
      expect(reparsed.schema.id).toBe(parsed.schema.id);
      expect(reparsed.schema.title).toBe(parsed.schema.title);
      expect(reparsed.schema.groups.length).toBe(parsed.schema.groups.length);

      // Compare field IDs
      expect(reparsed.orderIndex).toEqual(parsed.orderIndex);

      // Verify key fields exist
      expect(reparsed.orderIndex).toContain('name');
      expect(reparsed.orderIndex).toContain('email');
      expect(reparsed.orderIndex).toContain('age');
      expect(reparsed.orderIndex).toContain('tags');
      expect(reparsed.orderIndex).toContain('priority');
      expect(reparsed.orderIndex).toContain('categories');

      // Check idIndex has correct nodeType values
      expect(reparsed.idIndex.get('simple_test')?.nodeType).toBe('form');
      expect(reparsed.idIndex.get('basic_fields')?.nodeType).toBe('group');
      expect(reparsed.idIndex.get('name')?.nodeType).toBe('field');
      expect(reparsed.idIndex.get('priority.low')?.nodeType).toBe('option');
    });
  });

  describe('serialize implicit groups (markform-371)', () => {
    it('serializes implicit group without group wrapper', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field kind="string" id="movie" label="Favorite Movie" %}{% /field %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      // Should not have group wrapper for implicit group
      expect(output).not.toContain('{% group');
      expect(output).not.toContain('{% /group %}');

      // Should still have the field
      expect(output).toContain('{% field kind="string" id="movie"');
    });

    it('round-trips form with ungrouped fields and instructions', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      // Verify structure
      expect(reparsed.schema.id).toBe('test');
      expect(reparsed.orderIndex).toContain('movie');
      expect(reparsed.docs).toHaveLength(1);
      expect(reparsed.docs[0]?.ref).toBe('movie');
      expect(reparsed.docs[0]?.tag).toBe('instructions');
    });

    it('serializes mix of grouped and ungrouped fields correctly', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field kind="string" id="ungrouped" label="Ungrouped" %}{% /field %}

{% group id="g1" title="Group 1" %}
{% field kind="string" id="grouped" label="Grouped" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      // Should have explicit group wrapper
      expect(output).toContain('{% group id="g1"');
      expect(output).toContain('{% /group %}');

      // Both fields should be present
      expect(output).toContain('{% field kind="string" id="ungrouped"');
      expect(output).toContain('{% field kind="string" id="grouped"');

      // Round-trip should work
      const reparsed = parseForm(output);
      expect(reparsed.orderIndex).toContain('ungrouped');
      expect(reparsed.orderIndex).toContain('grouped');
    });
  });

  describe('serializeRawMarkdown', () => {
    it('outputs plain markdown without markdoc directives for string field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" title="Test Form" %}

{% group id="g1" title="Basic Info" %}
{% field kind="string" id="company" label="Company Name" %}
\`\`\`value
ACME Corp
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      // Should not contain markdoc directives
      expect(output).not.toContain('{%');
      expect(output).not.toContain('%}');
      expect(output).not.toContain('```value');

      // Should contain the form title and group header
      expect(output).toContain('# Test Form');
      expect(output).toContain('## Basic Info');

      // Should contain field label and value
      expect(output).toContain('**Company Name:**');
      expect(output).toContain('ACME Corp');
    });

    it('outputs plain markdown for number field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="number" id="revenue" label="Revenue" %}
\`\`\`value
1234567
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      expect(output).not.toContain('{%');
      expect(output).toContain('**Revenue:**');
      expect(output).toContain('1234567');
    });

    it('outputs plain markdown for string-list field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" %}
\`\`\`value
Technology
Finance
Healthcare
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      expect(output).not.toContain('{%');
      expect(output).toContain('**Tags:**');
      expect(output).toContain('Technology');
      expect(output).toContain('Finance');
      expect(output).toContain('Healthcare');
    });

    it('outputs plain markdown for single-select field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="single_select" id="rating" label="Rating" %}
- [ ] Bullish {% #bullish %}
- [x] Neutral {% #neutral %}
- [ ] Bearish {% #bearish %}
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      expect(output).not.toContain('{%');
      expect(output).toContain('**Rating:**');
      expect(output).toContain('Neutral');
    });

    it('outputs plain markdown for multi-select field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="multi_select" id="sectors" label="Sectors" %}
- [x] Technology {% #tech %}
- [ ] Finance {% #finance %}
- [x] Healthcare {% #health %}
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      expect(output).not.toContain('{%');
      expect(output).toContain('**Sectors:**');
      expect(output).toContain('Technology');
      expect(output).toContain('Healthcare');
    });

    it('outputs plain markdown for checkboxes field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" %}
- [x] Task 1 {% #task1 %}
- [ ] Task 2 {% #task2 %}
- [/] Task 3 {% #task3 %}
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      expect(output).not.toContain('{%');
      expect(output).toContain('**Tasks:**');
      // Should show checkboxes in GFM format
      expect(output).toContain('- [x] Task 1');
      expect(output).toContain('- [ ] Task 2');
      expect(output).toContain('- [/] Task 3');
    });

    it('shows empty placeholder for unfilled fields', () => {
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
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      expect(output).not.toContain('{%');
      expect(output).toContain('**Name:**');
      expect(output).toContain('_(empty)_');
    });

    it('includes doc blocks as regular markdown', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" title="Test Form" %}

{% instructions ref="test" %}
Please fill out this form carefully.
{% /instructions %}

{% group id="g1" title="Group 1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}

{% description ref="name" %}
Enter your full legal name.
{% /description %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      expect(output).not.toContain('{%');
      expect(output).toContain('Please fill out this form carefully.');
      expect(output).toContain('Enter your full legal name.');
    });
  });

  describe('unified response model - serialize state (markform-233)', () => {
    it('serializes state="skipped" attribute for skipped field', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      expect(output).toContain('state="skipped"');
      expect(output).not.toContain('```value');
    });

    it('serializes state="aborted" attribute for aborted field', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      expect(output).toContain('state="aborted"');
      expect(output).not.toContain('```value');
    });

    it('does not serialize state attribute for answered field', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      expect(output).not.toContain('state=');
      expect(output).toContain('```value');
      expect(output).toContain('Alice');
    });

    it('does not serialize state attribute for empty field', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      expect(output).not.toContain('state=');
      expect(output).not.toContain('```value');
    });

    it('round-trips state="skipped" correctly', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      expect(reparsed.responsesByFieldId.notes?.state).toBe('skipped');
      expect(reparsed.responsesByFieldId.notes?.value).toBeUndefined();
    });

    it('round-trips state="aborted" correctly', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="number" id="count" label="Count" state="aborted" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      expect(reparsed.responsesByFieldId.count?.state).toBe('aborted');
      expect(reparsed.responsesByFieldId.count?.value).toBeUndefined();
    });
  });

  describe('unified response model - serialize notes (markform-233)', () => {
    it('serializes notes at end of form', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" state="skipped" %}{% /field %}
{% /group %}

{% note id="n1" ref="notes" role="agent" %}
Not applicable for this analysis.
{% /note %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      expect(output).toContain('{% note id="n1"');
      expect(output).toContain('ref="notes"');
      expect(output).toContain('role="agent"');
      // Notes no longer have state attribute per markform-254
      expect(output).toContain('Not applicable');
    });

    it('serializes notes in sorted order by ID', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="field1" label="Field 1" %}{% /field %}
{% field kind="string" id="field2" label="Field 2" %}{% /field %}
{% /group %}

{% note id="n10" ref="field1" role="agent" %}
Note 10.
{% /note %}

{% note id="n2" ref="field2" role="agent" %}
Note 2.
{% /note %}

{% note id="n1" ref="field1" role="agent" %}
Note 1.
{% /note %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      // Check that notes appear in numerical order n1, n2, n10
      const n1Pos = output.indexOf('id="n1"');
      const n2Pos = output.indexOf('id="n2"');
      const n10Pos = output.indexOf('id="n10"');

      expect(n1Pos).toBeGreaterThan(0);
      expect(n2Pos).toBeGreaterThan(n1Pos);
      expect(n10Pos).toBeGreaterThan(n2Pos);
    });

    it('serializes note without state attribute when state is undefined', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% note id="n1" ref="name" role="user" %}
General comment.
{% /note %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      expect(output).toContain('{% note id="n1"');
      expect(output).toContain('ref="name"');
      expect(output).toContain('role="user"');
      expect(output).not.toContain('state=');
      expect(output).toContain('General comment');
    });

    it('round-trips notes correctly', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="notes" label="Notes" state="skipped" %}{% /field %}
{% /group %}

{% note id="n1" ref="notes" role="agent" %}
Not applicable.
{% /note %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      expect(reparsed.notes).toHaveLength(1);
      expect(reparsed.notes[0]?.id).toBe('n1');
      expect(reparsed.notes[0]?.ref).toBe('notes');
      expect(reparsed.notes[0]?.role).toBe('agent');
      // Note: state field is no longer present on notes per markform-254
      expect(reparsed.notes[0]?.text).toContain('Not applicable');
    });
  });

  describe('unified response model - round-trip with sentinels (markform-253)', () => {
    it('round-trips %SKIP% sentinel in string field', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      // After serialization, %SKIP% becomes state="skipped" attribute
      expect(reparsed.responsesByFieldId.notes?.state).toBe('skipped');
      expect(output).toContain('state="skipped"');
      expect(output).not.toContain('%SKIP%');
    });

    it('round-trips %ABORT% sentinel in url field', () => {
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
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      // After serialization, %ABORT% becomes state="aborted" attribute
      expect(reparsed.responsesByFieldId.website?.state).toBe('aborted');
      expect(output).toContain('state="aborted"');
      expect(output).not.toContain('%ABORT%');
    });

    it('round-trips form with mixed states and notes', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
Alice
\`\`\`
{% /field %}
{% field kind="string" id="bio" label="Bio" state="skipped" %}{% /field %}
{% field kind="number" id="age" label="Age" state="aborted" %}{% /field %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% /group %}

{% note id="n1" ref="bio" role="agent" %}
Bio not available.
{% /note %}

{% note id="n2" ref="age" role="agent" %}
Age cannot be determined.
{% /note %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      // Check responses
      expect(reparsed.responsesByFieldId.name?.state).toBe('answered');
      expect(reparsed.responsesByFieldId.bio?.state).toBe('skipped');
      expect(reparsed.responsesByFieldId.age?.state).toBe('aborted');
      expect(reparsed.responsesByFieldId.notes?.state).toBe('unanswered');

      // Check notes - state is no longer present on notes per markform-254
      expect(reparsed.notes).toHaveLength(2);
      expect(reparsed.notes[0]?.id).toBe('n1');
      expect(reparsed.notes[1]?.id).toBe('n2');
    });
  });

  describe('report attribute round-trip', () => {
    it('preserves report=false on field through serialize/parse cycle', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="visible" label="Visible Field" /%}
{% field kind="string" id="hidden" label="Hidden Field" report=false /%}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      expect(parsed.schema.groups[0]?.children[1]?.report).toBe(false);

      const output = serialize(parsed);
      expect(output).toContain('report=false');

      const reparsed = parseForm(output);
      expect(reparsed.schema.groups[0]?.children[1]?.report).toBe(false);
    });

    it('preserves report=false on group through serialize/parse cycle', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="visible_group" title="Visible" %}
{% field kind="string" id="f1" label="Field 1" /%}
{% /group %}

{% group id="hidden_group" title="Hidden" report=false %}
{% field kind="string" id="f2" label="Field 2" /%}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      expect(parsed.schema.groups[1]?.report).toBe(false);

      const output = serialize(parsed);
      expect(output).toContain('report=false');

      const reparsed = parseForm(output);
      expect(reparsed.schema.groups[1]?.report).toBe(false);
    });

    it('preserves report attribute on documentation blocks through serialize/parse cycle', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" /%}
{% /group %}

{% instructions ref="name" report=true %}
These instructions should appear in report.
{% /instructions %}

{% description ref="name" report=false %}
This description should NOT appear in report.
{% /description %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const instructionsDoc = parsed.docs.find((d) => d.tag === 'instructions');
      const descriptionDoc = parsed.docs.find((d) => d.tag === 'description');
      expect(instructionsDoc?.report).toBe(true);
      expect(descriptionDoc?.report).toBe(false);

      const output = serialize(parsed);
      // Check that report attributes are preserved in output
      expect(output).toMatch(/instructions.*report=true/s);
      expect(output).toMatch(/description.*report=false/s);

      const reparsed = parseForm(output);
      const reparsedInstructions = reparsed.docs.find((d) => d.tag === 'instructions');
      const reparsedDescription = reparsed.docs.find((d) => d.tag === 'description');
      expect(reparsedInstructions?.report).toBe(true);
      expect(reparsedDescription?.report).toBe(false);
    });
  });
});
