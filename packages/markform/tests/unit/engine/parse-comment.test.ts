import { describe, expect, it } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';

describe('engine/parse - HTML comment syntax', () => {
  describe('basic parsing', () => {
    it('parses form with HTML comment syntax', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="test" -->
<!-- f:group id="basics" -->
<!-- f:field kind="string" id="name" label="Name" --><!-- /f:field -->
<!-- /f:group -->
<!-- /f:form -->`;

      const parsed = parseForm(markdown);

      expect(parsed.schema.id).toBe('test');
      expect(parsed.schema.groups).toHaveLength(1);
      const group = parsed.schema.groups[0]!;
      expect(group.id).toBe('basics');
      expect(group.children).toHaveLength(1);
      expect(group.children[0]!.id).toBe('name');
      expect(parsed.syntaxStyle).toBe('comments');
    });

    it('parses form with Markdoc syntax', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% group id="basics" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}`;

      const parsed = parseForm(markdown);

      expect(parsed.schema.id).toBe('test');
      expect(parsed.syntaxStyle).toBe('tags');
    });

    it('parses single_select with #id annotations', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="survey" -->
<!-- f:group id="ratings" -->
<!-- f:field kind="single_select" id="quality" label="Quality" -->
- [ ] Excellent <!-- #excellent -->
- [ ] Good <!-- #good -->
- [ ] Fair <!-- #fair -->
<!-- /f:field -->
<!-- /f:group -->
<!-- /f:form -->`;

      const parsed = parseForm(markdown);
      const group = parsed.schema.groups[0]!;
      const field = group.children[0]!;

      expect(field.id).toBe('quality');
      expect(field.kind).toBe('single_select');
      if (field.kind === 'single_select') {
        expect(field.options).toHaveLength(3);
        expect(field.options[0]!.id).toBe('excellent');
        expect(field.options[1]!.id).toBe('good');
        expect(field.options[2]!.id).toBe('fair');
      }
      expect(parsed.syntaxStyle).toBe('comments');
    });

    it('parses checkboxes with .class annotations', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="todo" -->
<!-- f:group id="tasks" -->
<!-- f:field kind="checkboxes" id="items" label="Tasks" -->
- [ ] Task A <!-- #taskA --> <!-- .priority -->
- [ ] Task B <!-- #taskB -->
<!-- /f:field -->
<!-- /f:group -->
<!-- /f:form -->`;

      const parsed = parseForm(markdown);
      const group = parsed.schema.groups[0]!;
      const field = group.children[0]!;

      expect(field.kind).toBe('checkboxes');
      if (field.kind === 'checkboxes') {
        expect(field.options).toHaveLength(2);
        expect(field.options[0]!.id).toBe('taskA');
        expect(field.options[1]!.id).toBe('taskB');
      }
    });
  });

  describe('AST equivalence', () => {
    it('produces identical AST for equivalent Markdoc and comment syntax', () => {
      const markdocForm = `---
markform:
  spec: MF/0.1
---
{% form id="equiv" %}
{% group id="g1" %}
{% field kind="string" id="f1" label="Field 1" required=true %}{% /field %}
{% field kind="single_select" id="f2" label="Field 2" %}
- [ ] Option A {% #optA %}
- [ ] Option B {% #optB %}
{% /field %}
{% /group %}
{% /form %}`;

      const commentForm = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="equiv" -->
<!-- f:group id="g1" -->
<!-- f:field kind="string" id="f1" label="Field 1" required=true --><!-- /f:field -->
<!-- f:field kind="single_select" id="f2" label="Field 2" -->
- [ ] Option A <!-- #optA -->
- [ ] Option B <!-- #optB -->
<!-- /f:field -->
<!-- /f:group -->
<!-- /f:form -->`;

      const markdocParsed = parseForm(markdocForm);
      const commentParsed = parseForm(commentForm);

      // Schema should be identical
      expect(commentParsed.schema).toEqual(markdocParsed.schema);

      // Response structure should be identical
      expect(Object.keys(commentParsed.responsesByFieldId)).toEqual(
        Object.keys(markdocParsed.responsesByFieldId),
      );

      // Order index should be identical
      expect(commentParsed.orderIndex).toEqual(markdocParsed.orderIndex);

      // Only syntaxStyle should differ
      expect(markdocParsed.syntaxStyle).toBe('tags');
      expect(commentParsed.syntaxStyle).toBe('comments');
    });
  });

  describe('complex forms', () => {
    it('parses form with all field types', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="complete" -->
<!-- f:group id="main" -->

<!-- f:field kind="string" id="name" label="Name" --><!-- /f:field -->
<!-- f:field kind="number" id="age" label="Age" --><!-- /f:field -->
<!-- f:field kind="url" id="website" label="Website" --><!-- /f:field -->
<!-- f:field kind="date" id="dob" label="Date of Birth" --><!-- /f:field -->
<!-- f:field kind="year" id="year" label="Year" --><!-- /f:field -->

<!-- f:field kind="single_select" id="status" label="Status" -->
- [ ] Active <!-- #active -->
- [ ] Inactive <!-- #inactive -->
<!-- /f:field -->

<!-- f:field kind="multi_select" id="tags" label="Tags" -->
- [ ] Tag A <!-- #tagA -->
- [ ] Tag B <!-- #tagB -->
<!-- /f:field -->

<!-- f:field kind="checkboxes" id="agree" label="Agreements" -->
- [ ] Terms <!-- #terms -->
- [ ] Privacy <!-- #privacy -->
<!-- /f:field -->

<!-- /f:group -->
<!-- /f:form -->`;

      const parsed = parseForm(markdown);
      const group = parsed.schema.groups[0]!;

      expect(parsed.schema.id).toBe('complete');
      expect(group.children).toHaveLength(8);
      expect(parsed.syntaxStyle).toBe('comments');

      // Verify field kinds
      const children = group.children;
      expect(children[0]!.kind).toBe('string');
      expect(children[1]!.kind).toBe('number');
      expect(children[2]!.kind).toBe('url');
      expect(children[3]!.kind).toBe('date');
      expect(children[4]!.kind).toBe('year');
      expect(children[5]!.kind).toBe('single_select');
      expect(children[6]!.kind).toBe('multi_select');
      expect(children[7]!.kind).toBe('checkboxes');
    });

    it('parses form with notes and documentation blocks', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="noted" -->
<!-- f:group id="g1" -->
<!-- f:field kind="string" id="f1" label="Field" --><!-- /f:field -->
<!-- /f:group -->
<!-- /f:form -->

<!-- f:note id="n1" ref="f1" role="analyst" -->
This is a note about the field.
<!-- /f:note -->

<!-- f:description ref="f1" -->
Field description here.
<!-- /f:description -->`;

      const parsed = parseForm(markdown);

      expect(parsed.notes).toHaveLength(1);
      expect(parsed.notes[0]!.id).toBe('n1');
      expect(parsed.notes[0]!.ref).toBe('f1');

      expect(parsed.docs).toHaveLength(1);
      expect(parsed.docs[0]!.tag).toBe('description');
      expect(parsed.docs[0]!.ref).toBe('f1');
    });

    it('parses form with values in fields', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="filled" -->
<!-- f:group id="g1" -->
<!-- f:field kind="string" id="name" label="Name" -->
\`\`\`value
John Doe
\`\`\`
<!-- /f:field -->
<!-- f:field kind="single_select" id="status" label="Status" -->
- [x] Active <!-- #active -->
- [ ] Inactive <!-- #inactive -->
<!-- /f:field -->
<!-- /f:group -->
<!-- /f:form -->`;

      const parsed = parseForm(markdown);

      expect(parsed.responsesByFieldId.name?.value?.kind).toBe('string');
      if (parsed.responsesByFieldId.name?.value?.kind === 'string') {
        expect(parsed.responsesByFieldId.name.value.value).toBe('John Doe');
      }

      expect(parsed.responsesByFieldId.status?.value?.kind).toBe('single_select');
      if (parsed.responsesByFieldId.status?.value?.kind === 'single_select') {
        expect(parsed.responsesByFieldId.status.value.selected).toBe('active');
      }
    });
  });

  describe('edge cases', () => {
    it('handles mixed regular comments and form directives', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- This is a regular comment that should be ignored -->
<!-- f:form id="mixed" -->
<!-- Another regular comment -->
<!-- f:group id="g1" -->
<!-- f:field kind="string" id="f1" label="Field" --><!-- /f:field -->
<!-- /f:group -->
<!-- /f:form -->`;

      const parsed = parseForm(markdown);

      expect(parsed.schema.id).toBe('mixed');
      expect(parsed.syntaxStyle).toBe('comments');
    });

    it('preserves code block content with comment-like text', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="code" -->
<!-- f:group id="g1" -->
<!-- f:field kind="string" id="example" label="Example" multiline=true -->
\`\`\`value
Here's how to use comments:
<!-- f:form id="nested" -->
This is NOT a form directive, just example text.
<!-- /f:form -->
\`\`\`
<!-- /f:field -->
<!-- /f:group -->
<!-- /f:form -->`;

      const parsed = parseForm(markdown);

      expect(parsed.schema.id).toBe('code');
      const value = parsed.responsesByFieldId.example?.value;
      expect(value?.kind).toBe('string');
      if (value?.kind === 'string') {
        expect(value.value).toContain('<!-- f:form id="nested" -->');
      }
    });
  });
});
