import { describe, expect, it } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';
import { postprocessToCommentSyntax, serializeForm } from '../../../src/engine/serialize.js';

describe('engine/serialize - HTML comment syntax', () => {
  describe('postprocessToCommentSyntax', () => {
    it('transforms opening tags', () => {
      const input = '{% form id="test" %}';
      const output = postprocessToCommentSyntax(input);
      expect(output).toBe('<!-- f:form id="test" -->');
    });

    it('transforms closing tags', () => {
      const input = '{% /form %}';
      const output = postprocessToCommentSyntax(input);
      expect(output).toBe('<!-- /f:form -->');
    });

    it('transforms self-closing tags', () => {
      const input = '{% field kind="string" /%}';
      const output = postprocessToCommentSyntax(input);
      expect(output).toBe('<!-- f:field kind="string" /-->');
    });

    it('transforms #id annotations', () => {
      const input = '{% #optionA %}';
      const output = postprocessToCommentSyntax(input);
      expect(output).toBe('<!-- #optionA -->');
    });

    it('transforms .class annotations', () => {
      const input = '{% .priority %}';
      const output = postprocessToCommentSyntax(input);
      expect(output).toBe('<!-- .priority -->');
    });

    it('preserves content in fenced code blocks', () => {
      const input = `\`\`\`value
{% form id="inside-code" %}
\`\`\``;
      const output = postprocessToCommentSyntax(input);
      expect(output).toBe(input);
    });

    it('preserves content in tilde fenced code blocks', () => {
      const input = `~~~value
{% form id="inside-code" %}
~~~`;
      const output = postprocessToCommentSyntax(input);
      expect(output).toBe(input);
    });

    it('transforms multiple tags in a document', () => {
      const input = `{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="f1" label="Field" %}{% /field %}
{% /group %}
{% /form %}`;

      const expected = `<!-- f:form id="test" -->
<!-- f:group id="g1" -->
<!-- f:field kind="string" id="f1" label="Field" --><!-- /f:field -->
<!-- /f:group -->
<!-- /f:form -->`;

      const output = postprocessToCommentSyntax(input);
      expect(output).toBe(expected);
    });

    it('transforms single_select with annotations', () => {
      const input = `{% field kind="single_select" id="status" label="Status" %}
- [ ] Active {% #active %}
- [ ] Inactive {% #inactive %}
{% /field %}`;

      const expected = `<!-- f:field kind="single_select" id="status" label="Status" -->
- [ ] Active <!-- #active -->
- [ ] Inactive <!-- #inactive -->
<!-- /f:field -->`;

      const output = postprocessToCommentSyntax(input);
      expect(output).toBe(expected);
    });

    it('handles mixed content and tags', () => {
      const input = `Some text before
{% form id="test" %}
Regular markdown content
{% /form %}
Some text after`;

      const expected = `Some text before
<!-- f:form id="test" -->
Regular markdown content
<!-- /f:form -->
Some text after`;

      const output = postprocessToCommentSyntax(input);
      expect(output).toBe(expected);
    });

    it('handles indented fenced code blocks (up to 3 spaces)', () => {
      const input = `   \`\`\`value
{% form id="inside" %}
   \`\`\`
{% form id="outside" %}`;

      // The indented fence is still recognized
      const output = postprocessToCommentSyntax(input);
      expect(output).toContain('{% form id="inside" %}'); // Preserved
      expect(output).toContain('<!-- f:form id="outside" -->'); // Transformed
    });

    it('skips 4-space indented content (not a fence)', () => {
      const input = `    \`\`\`value
{% form id="should-transform" %}
    \`\`\``;

      // 4-space indent = indented code block, not a fence
      // So the {% form %} tag should be transformed
      const output = postprocessToCommentSyntax(input);
      expect(output).toContain('<!-- f:form id="should-transform" -->');
    });
  });

  describe('serializeForm - syntax style preservation', () => {
    it('outputs HTML comment syntax when form.syntaxStyle is html-comment', () => {
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
      expect(parsed.syntaxStyle).toBe('comments');

      const serialized = serializeForm(parsed);

      // Should contain HTML comment syntax
      expect(serialized).toContain('<!-- f:form');
      expect(serialized).toContain('<!-- f:group');
      expect(serialized).toContain('<!-- f:field');
      expect(serialized).toContain('<!-- /f:form -->');

      // Should NOT contain Markdoc syntax
      expect(serialized).not.toContain('{% form');
      expect(serialized).not.toContain('{% group');
      expect(serialized).not.toContain('{% field');
    });

    it('outputs Markdoc syntax when form.syntaxStyle is markdoc', () => {
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
      expect(parsed.syntaxStyle).toBe('tags');

      const serialized = serializeForm(parsed);

      // Should contain Markdoc syntax
      expect(serialized).toContain('{% form');
      expect(serialized).toContain('{% group');
      expect(serialized).toContain('{% field');

      // Should NOT contain HTML comment syntax
      expect(serialized).not.toContain('<!-- f:form');
      expect(serialized).not.toContain('<!-- f:group');
    });
  });

  describe('serializeForm - syntax style override', () => {
    it('forces HTML comment syntax via options', () => {
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
      expect(parsed.syntaxStyle).toBe('tags');

      const serialized = serializeForm(parsed, { syntaxStyle: 'comments' });

      // Should contain HTML comment syntax (overridden)
      expect(serialized).toContain('<!-- f:form');
      expect(serialized).toContain('<!-- /f:form -->');
      expect(serialized).not.toContain('{% form');
    });

    it('forces Markdoc syntax via options', () => {
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
      expect(parsed.syntaxStyle).toBe('comments');

      const serialized = serializeForm(parsed, { syntaxStyle: 'tags' });

      // Should contain Markdoc syntax (overridden)
      expect(serialized).toContain('{% form');
      expect(serialized).toContain('{% /form %}');
      expect(serialized).not.toContain('<!-- f:form');
    });
  });

  describe('round-trip preservation', () => {
    it('preserves HTML comment syntax through parse -> serialize cycle', () => {
      const original = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="roundtrip" -->
<!-- f:group id="g1" -->

<!-- f:field kind="string" id="name" label="Name" --><!-- /f:field -->

<!-- f:field kind="single_select" id="status" label="Status" -->
- [ ] Active <!-- #active -->
- [ ] Inactive <!-- #inactive -->
<!-- /f:field -->

<!-- /f:group -->
<!-- /f:form -->
`;

      const parsed = parseForm(original);
      const serialized = serializeForm(parsed);

      // Should preserve HTML comment syntax
      expect(serialized).toContain('<!-- f:form');
      expect(serialized).toContain('<!-- #active -->');
      expect(serialized).toContain('<!-- /f:form -->');

      // Round-trip should produce parseable form
      const reparsed = parseForm(serialized);
      expect(reparsed.schema.id).toBe('roundtrip');
      expect(reparsed.syntaxStyle).toBe('comments');
    });

    it('preserves Markdoc syntax through parse -> serialize cycle', () => {
      const original = `---
markform:
  spec: MF/0.1
---
{% form id="roundtrip" %}
{% group id="g1" %}

{% field kind="string" id="name" label="Name" %}{% /field %}

{% field kind="single_select" id="status" label="Status" %}
- [ ] Active {% #active %}
- [ ] Inactive {% #inactive %}
{% /field %}

{% /group %}
{% /form %}
`;

      const parsed = parseForm(original);
      const serialized = serializeForm(parsed);

      // Should preserve Markdoc syntax
      expect(serialized).toContain('{% form');
      expect(serialized).toContain('{% #active %}');
      expect(serialized).toContain('{% /form %}');

      // Round-trip should produce parseable form
      const reparsed = parseForm(serialized);
      expect(reparsed.schema.id).toBe('roundtrip');
      expect(reparsed.syntaxStyle).toBe('tags');
    });

    it('round-trip produces equivalent schemas', () => {
      const commentForm = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="equiv" -->
<!-- f:group id="g1" -->
<!-- f:field kind="string" id="f1" label="Field 1" required=true --><!-- /f:field -->
<!-- f:field kind="number" id="f2" label="Field 2" min=0 max=100 --><!-- /f:field -->
<!-- /f:group -->
<!-- /f:form -->`;

      const parsed1 = parseForm(commentForm);
      const serialized = serializeForm(parsed1);
      const parsed2 = parseForm(serialized);

      // Schemas should be identical
      expect(parsed2.schema).toEqual(parsed1.schema);
    });
  });

  describe('complex forms', () => {
    it('handles form with all field types in comment syntax', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="complete" -->
<!-- f:group id="main" -->

<!-- f:field kind="string" id="name" label="Name" required=true --><!-- /f:field -->
<!-- f:field kind="number" id="age" label="Age" min=0 max=150 --><!-- /f:field -->
<!-- f:field kind="url" id="website" label="Website" --><!-- /f:field -->
<!-- f:field kind="date" id="dob" label="Date of Birth" --><!-- /f:field -->

<!-- f:field kind="single_select" id="status" label="Status" -->
- [ ] Active <!-- #active -->
- [ ] Inactive <!-- #inactive -->
<!-- /f:field -->

<!-- f:field kind="multi_select" id="tags" label="Tags" -->
- [ ] Important <!-- #important -->
- [ ] Urgent <!-- #urgent -->
<!-- /f:field -->

<!-- f:field kind="checkboxes" id="agree" label="Agreements" checkboxMode="explicit" -->
- [ ] Terms of Service <!-- #terms -->
- [ ] Privacy Policy <!-- #privacy -->
<!-- /f:field -->

<!-- /f:group -->
<!-- /f:form -->`;

      const parsed = parseForm(markdown);
      const serialized = serializeForm(parsed);

      // Verify round-trip preserves structure
      const reparsed = parseForm(serialized);
      expect(reparsed.schema.groups[0]!.children).toHaveLength(7);
      expect(reparsed.syntaxStyle).toBe('comments');

      // Verify comment syntax preserved
      expect(serialized).toContain('<!-- f:field kind="string"');
      expect(serialized).toContain('<!-- #active -->');
      expect(serialized).toContain('<!-- #terms -->');
    });

    it('handles form with filled values in comment syntax', () => {
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
      const serialized = serializeForm(parsed);
      const reparsed = parseForm(serialized);

      // Values should be preserved
      expect(reparsed.responsesByFieldId.name?.value?.kind).toBe('string');
      if (reparsed.responsesByFieldId.name?.value?.kind === 'string') {
        expect(reparsed.responsesByFieldId.name.value.value).toBe('John Doe');
      }

      expect(reparsed.responsesByFieldId.status?.value?.kind).toBe('single_select');
      if (reparsed.responsesByFieldId.status?.value?.kind === 'single_select') {
        expect(reparsed.responsesByFieldId.status.value.selected).toBe('active');
      }

      // Syntax should be preserved
      expect(serialized).toContain('<!-- f:form');
    });

    it('handles notes and documentation blocks in comment syntax', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="documented" -->
<!-- f:group id="g1" -->
<!-- f:field kind="string" id="f1" label="Field" --><!-- /f:field -->
<!-- /f:group -->

<!-- f:note id="n1" ref="f1" role="analyst" -->
This is a note.
<!-- /f:note -->

<!-- /f:form -->`;

      const parsed = parseForm(markdown);
      expect(parsed.notes).toHaveLength(1);

      const serialized = serializeForm(parsed);

      // Verify notes are serialized with comment syntax
      expect(serialized).toContain('<!-- f:note');
      expect(serialized).toContain('<!-- /f:note -->');

      // Verify round-trip
      const reparsed = parseForm(serialized);
      expect(reparsed.notes).toHaveLength(1);
      expect(reparsed.notes[0]!.id).toBe('n1');
    });
  });

  describe('edge cases', () => {
    it('handles empty form', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="empty" -->
<!-- f:group id="g1" -->
<!-- /f:group -->
<!-- /f:form -->`;

      const parsed = parseForm(markdown);
      const serialized = serializeForm(parsed);

      expect(serialized).toContain('<!-- f:form');
      expect(serialized).toContain('<!-- /f:form -->');
    });

    it('preserves code blocks containing comment-like text', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="code" -->
<!-- f:group id="g1" -->
<!-- f:field kind="string" id="example" label="Example" multiline=true -->
\`\`\`value
Example with <!-- f:form id="fake" --> in code
\`\`\`
<!-- /f:field -->
<!-- /f:group -->
<!-- /f:form -->`;

      const parsed = parseForm(markdown);
      const serialized = serializeForm(parsed);

      // The content inside value fence should be preserved
      expect(serialized).toContain('<!-- f:form id="fake" -->');

      // But the outer form should use comment syntax
      const reparsed = parseForm(serialized);
      expect(reparsed.schema.id).toBe('code');
    });

    it('handles process=false in value fences correctly', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="process" -->
<!-- f:group id="g1" -->
<!-- f:field kind="string" id="code" label="Code Example" -->
\`\`\`value {% process=false %}
{% form id="example" %}
This is example Markdoc code
{% /form %}
\`\`\`
<!-- /f:field -->
<!-- /f:group -->
<!-- /f:form -->`;

      const parsed = parseForm(markdown);
      const serialized = serializeForm(parsed);
      const reparsed = parseForm(serialized);

      // Value should contain the raw Markdoc syntax
      if (reparsed.responsesByFieldId.code?.value?.kind === 'string') {
        expect(reparsed.responsesByFieldId.code.value.value).toContain('{% form id="example" %}');
      }
    });
  });

  describe('inline code preservation', () => {
    it('postprocessToCommentSyntax preserves inline code with Markdoc syntax', () => {
      const input = 'Use `{% field %}` to define a field.';
      const result = postprocessToCommentSyntax(input);

      // Inline code should not be transformed
      expect(result).toBe('Use `{% field %}` to define a field.');
      expect(result).not.toContain('<!-- f:field');
    });

    it('postprocessToCommentSyntax preserves double-backtick inline code', () => {
      const input = 'Example: `` {% form %} `` is a tag.';
      const result = postprocessToCommentSyntax(input);

      // Inline code should not be transformed
      expect(result).toBe('Example: `` {% form %} `` is a tag.');
      expect(result).not.toContain('<!-- f:form');
    });

    it('postprocessToCommentSyntax transforms tags outside inline code', () => {
      const input = 'Use `{% field %}` to create {% field %}';
      const result = postprocessToCommentSyntax(input);

      // First one (in inline code) should be preserved
      expect(result).toContain('`{% field %}`');
      // Second one (outside) should be transformed
      expect(result).toContain('<!-- f:field -->');
    });

    it('postprocessToCommentSyntax handles mixed inline code and fenced blocks', () => {
      const input = `Use \`{% form %}\` inline.

\`\`\`md
{% form %}
\`\`\`

And {% form %} here.`;

      const result = postprocessToCommentSyntax(input);

      // Inline code preserved
      expect(result).toContain('`{% form %}`');
      // Fenced code preserved
      expect(result).toContain('```md\n{% form %}\n```');
      // Outside code transformed
      expect(result).toContain('<!-- f:form -->');
    });

    it('round-trip preserves documentation with inline code examples', () => {
      // Note: Value fences with Markdoc-like content need {% process=false %} to prevent
      // Markdoc from interpreting the content as tags
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="doc-example" -->
<!-- f:group id="g1" -->
<!-- f:field kind="string" id="help" label="Help Text" multiline=true -->
\`\`\`value {% process=false %}
Use \`{% field %}\` to create fields.
\`\`\`
<!-- /f:field -->
<!-- /f:group -->
<!-- /f:form -->`;

      const parsed = parseForm(markdown);
      const serialized = serializeForm(parsed);

      // Value fence should be present
      expect(serialized).toContain('```value');

      // The inline code in the value should be preserved (Markdoc syntax in value is OK)
      // Note: The value fence content is raw text, not transformed
      expect(serialized).toContain('Use `{% field %}` to create fields.');

      // Round-trip should work
      const reparsed = parseForm(serialized);
      if (reparsed.responsesByFieldId.help?.value?.kind === 'string') {
        expect(reparsed.responsesByFieldId.help.value.value).toContain('`{% field %}`');
      }
    });
  });
});
