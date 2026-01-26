import { describe, expect, it } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';
import { postprocessToCommentSyntax, serializeForm } from '../../../src/engine/serialize.js';

describe('engine/serialize - HTML comment syntax', () => {
  describe('postprocessToCommentSyntax', () => {
    it('transforms opening tags', () => {
      const input = '{% form id="test" %}';
      const output = postprocessToCommentSyntax(input);
      expect(output).toBe('<!-- form id="test" -->');
    });

    it('transforms closing tags', () => {
      const input = '{% /form %}';
      const output = postprocessToCommentSyntax(input);
      expect(output).toBe('<!-- /form -->');
    });

    it('transforms self-closing tags', () => {
      const input = '{% field kind="string" /%}';
      const output = postprocessToCommentSyntax(input);
      expect(output).toBe('<!-- field kind="string" /-->');
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

    it('preserves inline code at start of line (PR #103 fix)', () => {
      // This tests the fix for the bug where inline code at line start
      // was not being preserved during comment syntax conversion
      const input = '`{% field %}`';
      const output = postprocessToCommentSyntax(input);
      expect(output).toBe(input);
    });

    it('preserves inline code with only leading whitespace', () => {
      const input = '  `{% form id="test" %}`';
      const output = postprocessToCommentSyntax(input);
      expect(output).toBe(input);
    });

    it('transforms multiple tags in a document', () => {
      const input = `{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="f1" label="Field" %}{% /field %}
{% /group %}
{% /form %}`;

      const expected = `<!-- form id="test" -->
<!-- group id="g1" -->
<!-- field kind="string" id="f1" label="Field" --><!-- /field -->
<!-- /group -->
<!-- /form -->`;

      const output = postprocessToCommentSyntax(input);
      expect(output).toBe(expected);
    });

    it('transforms single_select with annotations', () => {
      const input = `{% field kind="single_select" id="status" label="Status" %}
- [ ] Active {% #active %}
- [ ] Inactive {% #inactive %}
{% /field %}`;

      const expected = `<!-- field kind="single_select" id="status" label="Status" -->
- [ ] Active <!-- #active -->
- [ ] Inactive <!-- #inactive -->
<!-- /field -->`;

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
<!-- form id="test" -->
Regular markdown content
<!-- /form -->
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
      expect(output).toContain('<!-- form id="outside" -->'); // Transformed
    });

    it('skips 4-space indented content (not a fence)', () => {
      const input = `    \`\`\`value
{% form id="should-transform" %}
    \`\`\``;

      // 4-space indent = indented code block, not a fence
      // So the {% form %} tag should be transformed
      const output = postprocessToCommentSyntax(input);
      expect(output).toContain('<!-- form id="should-transform" -->');
    });
  });

  describe('serializeForm - syntax style preservation', () => {
    it('outputs HTML comment syntax when form.syntaxStyle is html-comment', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- form id="test" -->
<!-- group id="basics" -->
<!-- field kind="string" id="name" label="Name" --><!-- /field -->
<!-- /group -->
<!-- /form -->`;

      const parsed = parseForm(markdown);
      expect(parsed.syntaxStyle).toBe('comments');

      const serialized = serializeForm(parsed);

      // Should contain HTML comment syntax
      expect(serialized).toContain('<!-- form');
      expect(serialized).toContain('<!-- group');
      expect(serialized).toContain('<!-- field');
      expect(serialized).toContain('<!-- /form -->');

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
      expect(serialized).not.toContain('<!-- form');
      expect(serialized).not.toContain('<!-- group');
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
      expect(serialized).toContain('<!-- form');
      expect(serialized).toContain('<!-- /form -->');
      expect(serialized).not.toContain('{% form');
    });

    it('forces Markdoc syntax via options', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- form id="test" -->
<!-- group id="basics" -->
<!-- field kind="string" id="name" label="Name" --><!-- /field -->
<!-- /group -->
<!-- /form -->`;

      const parsed = parseForm(markdown);
      expect(parsed.syntaxStyle).toBe('comments');

      const serialized = serializeForm(parsed, { syntaxStyle: 'tags' });

      // Should contain Markdoc syntax (overridden)
      expect(serialized).toContain('{% form');
      expect(serialized).toContain('{% /form %}');
      expect(serialized).not.toContain('<!-- form');
    });
  });

  describe('round-trip preservation', () => {
    it('preserves HTML comment syntax through parse -> serialize cycle', () => {
      const original = `---
markform:
  spec: MF/0.1
---
<!-- form id="roundtrip" -->
<!-- group id="g1" -->

<!-- field kind="string" id="name" label="Name" --><!-- /field -->

<!-- field kind="single_select" id="status" label="Status" -->
- [ ] Active <!-- #active -->
- [ ] Inactive <!-- #inactive -->
<!-- /field -->

<!-- /group -->
<!-- /form -->
`;

      const parsed = parseForm(original);
      const serialized = serializeForm(parsed);

      // Should preserve HTML comment syntax
      expect(serialized).toContain('<!-- form');
      expect(serialized).toContain('<!-- #active -->');
      expect(serialized).toContain('<!-- /form -->');

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
<!-- form id="equiv" -->
<!-- group id="g1" -->
<!-- field kind="string" id="f1" label="Field 1" required=true --><!-- /field -->
<!-- field kind="number" id="f2" label="Field 2" min=0 max=100 --><!-- /field -->
<!-- /group -->
<!-- /form -->`;

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
<!-- form id="complete" -->
<!-- group id="main" -->

<!-- field kind="string" id="name" label="Name" required=true --><!-- /field -->
<!-- field kind="number" id="age" label="Age" min=0 max=150 --><!-- /field -->
<!-- field kind="url" id="website" label="Website" --><!-- /field -->
<!-- field kind="date" id="dob" label="Date of Birth" --><!-- /field -->

<!-- field kind="single_select" id="status" label="Status" -->
- [ ] Active <!-- #active -->
- [ ] Inactive <!-- #inactive -->
<!-- /field -->

<!-- field kind="multi_select" id="tags" label="Tags" -->
- [ ] Important <!-- #important -->
- [ ] Urgent <!-- #urgent -->
<!-- /field -->

<!-- field kind="checkboxes" id="agree" label="Agreements" checkboxMode="explicit" -->
- [ ] Terms of Service <!-- #terms -->
- [ ] Privacy Policy <!-- #privacy -->
<!-- /field -->

<!-- /group -->
<!-- /form -->`;

      const parsed = parseForm(markdown);
      const serialized = serializeForm(parsed);

      // Verify round-trip preserves structure
      const reparsed = parseForm(serialized);
      expect(reparsed.schema.groups[0]!.children).toHaveLength(7);
      expect(reparsed.syntaxStyle).toBe('comments');

      // Verify comment syntax preserved
      expect(serialized).toContain('<!-- field kind="string"');
      expect(serialized).toContain('<!-- #active -->');
      expect(serialized).toContain('<!-- #terms -->');
    });

    it('handles form with filled values in comment syntax', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- form id="filled" -->
<!-- group id="g1" -->
<!-- field kind="string" id="name" label="Name" -->
\`\`\`value
John Doe
\`\`\`
<!-- /field -->
<!-- field kind="single_select" id="status" label="Status" -->
- [x] Active <!-- #active -->
- [ ] Inactive <!-- #inactive -->
<!-- /field -->
<!-- /group -->
<!-- /form -->`;

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
      expect(serialized).toContain('<!-- form');
    });

    it('handles notes and documentation blocks in comment syntax', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- form id="documented" -->
<!-- group id="g1" -->
<!-- field kind="string" id="f1" label="Field" --><!-- /field -->
<!-- /group -->

<!-- note id="n1" ref="f1" role="analyst" -->
This is a note.
<!-- /note -->

<!-- /form -->`;

      const parsed = parseForm(markdown);
      expect(parsed.notes).toHaveLength(1);

      const serialized = serializeForm(parsed);

      // Verify notes are serialized with comment syntax
      expect(serialized).toContain('<!-- note');
      expect(serialized).toContain('<!-- /note -->');

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
<!-- form id="empty" -->
<!-- group id="g1" -->
<!-- /group -->
<!-- /form -->`;

      const parsed = parseForm(markdown);
      const serialized = serializeForm(parsed);

      expect(serialized).toContain('<!-- form');
      expect(serialized).toContain('<!-- /form -->');
    });

    it('preserves code blocks containing comment-like text', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- form id="code" -->
<!-- group id="g1" -->
<!-- field kind="string" id="example" label="Example" multiline=true -->
\`\`\`value
Example with <!--form id="fake" --> in code
\`\`\`
<!-- /field -->
<!-- /group -->
<!-- /form -->`;

      const parsed = parseForm(markdown);
      const serialized = serializeForm(parsed);

      // The content inside value fence should be preserved
      expect(serialized).toContain('<!--form id="fake" -->');

      // But the outer form should use comment syntax
      const reparsed = parseForm(serialized);
      expect(reparsed.schema.id).toBe('code');
    });

    it('handles process=false in value fences correctly', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- form id="process" -->
<!-- group id="g1" -->
<!-- field kind="string" id="code" label="Code Example" -->
\`\`\`value {% process=false %}
{% form id="example" %}
This is example Markdoc code
{% /form %}
\`\`\`
<!-- /field -->
<!-- /group -->
<!-- /form -->`;

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
      expect(result).not.toContain('<!-- field');
    });

    it('postprocessToCommentSyntax preserves double-backtick inline code', () => {
      const input = 'Example: `` {% form %} `` is a tag.';
      const result = postprocessToCommentSyntax(input);

      // Inline code should not be transformed
      expect(result).toBe('Example: `` {% form %} `` is a tag.');
      expect(result).not.toContain('<!-- form');
    });

    it('postprocessToCommentSyntax transforms tags outside inline code', () => {
      const input = 'Use `{% field %}` to create {% field %}';
      const result = postprocessToCommentSyntax(input);

      // First one (in inline code) should be preserved
      expect(result).toContain('`{% field %}`');
      // Second one (outside) should be transformed
      expect(result).toContain('<!-- field -->');
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
      expect(result).toContain('<!-- form -->');
    });

    it('round-trip preserves documentation with inline code examples', () => {
      // Note: Value fences with Markdoc-like content need {% process=false %} to prevent
      // Markdoc from interpreting the content as tags
      const markdown = `---
markform:
  spec: MF/0.1
---
<!-- form id="doc-example" -->
<!-- group id="g1" -->
<!-- field kind="string" id="help" label="Help Text" multiline=true -->
\`\`\`value {% process=false %}
Use \`{% field %}\` to create fields.
\`\`\`
<!-- /field -->
<!-- /group -->
<!-- /form -->`;

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
