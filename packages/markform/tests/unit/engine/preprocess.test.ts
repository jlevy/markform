import { describe, expect, it } from 'vitest';

import {
  detectSyntaxStyle,
  preprocessCommentSyntax,
  validateSyntaxConsistency,
} from '../../../src/engine/preprocess.js';

describe('engine/preprocess', () => {
  describe('preprocessCommentSyntax', () => {
    describe('basic transformations', () => {
      it('transforms form opening tag with id=', () => {
        const input = '<!-- form id="test" -->';
        const expected = '{% form id="test" %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms closing tag after form opening', () => {
        const input = '<!-- form id="test" --><!-- /form -->';
        const expected = '{% form id="test" %}{% /form %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms self-closing tag inside form', () => {
        const input =
          '<!-- form id="test" --><!-- field kind="string" id="name" /--><!-- /form -->';
        const expected = '{% form id="test" %}{% field kind="string" id="name" /%}{% /form %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms #id annotation inside form', () => {
        const input = '<!-- form id="test" --><!-- #good --><!-- /form -->';
        const expected = '{% form id="test" %}{% #good %}{% /form %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms .class annotation inside form', () => {
        const input = '<!-- form id="test" --><!-- .highlight --><!-- /form -->';
        const expected = '{% form id="test" %}{% .highlight %}{% /form %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('passes through regular HTML comments unchanged', () => {
        const input = '<!-- This is a regular comment -->';
        expect(preprocessCommentSyntax(input)).toBe(input);
      });

      it('passes through Markdoc syntax unchanged', () => {
        const input = '{% form id="test" %}{% /form %}';
        expect(preprocessCommentSyntax(input)).toBe(input);
      });

      it('does not transform form tag without id=', () => {
        const input = '<!-- form -->';
        expect(preprocessCommentSyntax(input)).toBe(input);
      });

      it('does not transform tags outside form', () => {
        const input = '<!-- field id="x" --><!-- #id -->';
        // No form tag, so no transformation
        expect(preprocessCommentSyntax(input)).toBe(input);
      });
    });

    describe('Markdoc attribute syntax variations', () => {
      it('transforms form with double-quoted id', () => {
        const input = '<!-- form id="test" --><!-- /form -->';
        const expected = '{% form id="test" %}{% /form %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms form with single-quoted id', () => {
        const input = "<!-- form id='test' --><!-- /form -->";
        const expected = "{% form id='test' %}{% /form %}";
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms form with unquoted id', () => {
        const input = '<!-- form id=test --><!-- /form -->';
        const expected = '{% form id=test %}{% /form %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms form with expression id', () => {
        const input = '<!-- form id={variable} --><!-- /form -->';
        const expected = '{% form id={variable} %}{% /form %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms form with spaced id assignment', () => {
        const input = '<!-- form id = "test" --><!-- /form -->';
        const expected = '{% form id = "test" %}{% /form %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms form with id not as first attribute', () => {
        const input = '<!-- form spec="MF/0.1" id="test" title="Survey" --><!-- /form -->';
        const expected = '{% form spec="MF/0.1" id="test" title="Survey" %}{% /form %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('does not transform form with id-like substring in another attribute', () => {
        // "valid" contains "id" but is not the id attribute
        const input = '<!-- form valid="test" -->';
        expect(preprocessCommentSyntax(input)).toBe(input);
      });
    });

    describe('spacing tolerance', () => {
      it('transforms tag with space after <!--', () => {
        const input = '<!-- form id="test" -->';
        const expected = '{% form id="test" %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms tag without space after <!--', () => {
        const input = '<!--form id="test" -->';
        const expected = '{% form id="test" %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms tag with multiple spaces after <!--', () => {
        const input = '<!--  form id="test" -->';
        const expected = '{% form id="test" %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms closing tag without space', () => {
        // Closing tag still transformed since it follows form opening
        const input = '<!-- form id="test" --><!--/form -->';
        const expected = '{% form id="test" %}{% /form %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms #id annotation without space (inside form)', () => {
        const input = '<!-- form id="test" --><!--#good --><!-- /form -->';
        const expected = '{% form id="test" %}{% #good %}{% /form %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms .class annotation without space (inside form)', () => {
        const input = '<!-- form id="test" --><!--.highlight --><!-- /form -->';
        const expected = '{% form id="test" %}{% .highlight %}{% /form %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });
    });

    describe('complex documents', () => {
      it('transforms a complete form', () => {
        const input = `---
markform:
  spec: MF/0.1
---
<!-- form id="example" -->
<!-- group id="basics" -->

<!-- field kind="string" id="name" label="Name" required=true --><!-- /field -->

<!-- field kind="single_select" id="rating" label="Rating" -->
- [ ] Good <!-- #good -->
- [ ] Bad <!-- #bad -->
<!-- /field -->

<!-- /group -->
<!-- /form -->`;

        const expected = `---
markform:
  spec: MF/0.1
---
{% form id="example" %}
{% group id="basics" %}

{% field kind="string" id="name" label="Name" required=true %}{% /field %}

{% field kind="single_select" id="rating" label="Rating" %}
- [ ] Good {% #good %}
- [ ] Bad {% #bad %}
{% /field %}

{% /group %}
{% /form %}`;

        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('handles mixed content with regular HTML comments', () => {
        const input = `<!-- This is a regular comment -->
<!-- form id="test" -->
<!-- Another regular comment about the form -->
<!-- field kind="string" id="name" --><!-- /field -->
<!-- /form -->`;

        const result = preprocessCommentSyntax(input);

        expect(result).toContain('<!-- This is a regular comment -->');
        expect(result).toContain('{% form id="test" %}');
        expect(result).toContain('<!-- Another regular comment about the form -->');
        expect(result).toContain('{% field kind="string" id="name" %}');
      });
    });

    describe('code block handling', () => {
      it('does not transform inside fenced code blocks with backticks', () => {
        const input = `Some text
\`\`\`markdown
<!-- form id="example" -->
Content here
<!-- /form -->
\`\`\`
More text`;

        const result = preprocessCommentSyntax(input);

        // The comment syntax inside the code block should be unchanged
        expect(result).toContain('<!-- form id="example" -->');
        expect(result).toContain('<!-- /form -->');
        expect(result).not.toContain('{% form');
      });

      it('does not transform inside fenced code blocks with tildes', () => {
        const input = `Some text
~~~markdown
<!-- form id="example" -->
Content here
<!-- /form -->
~~~
More text`;

        const result = preprocessCommentSyntax(input);

        expect(result).toContain('<!-- form id="example" -->');
        expect(result).not.toContain('{% form');
      });

      it('does not transform inside inline code', () => {
        const input = 'Use `<!-- form -->` to start a form';
        const result = preprocessCommentSyntax(input);

        expect(result).toBe(input);
        expect(result).not.toContain('{% form');
      });

      it('does not transform inside multi-backtick inline code', () => {
        const input = 'Use ``` <!-- form --> ``` for forms';
        const result = preprocessCommentSyntax(input);

        expect(result).toBe(input);
      });

      it('does not transform inside inline code at start of line (PR #103 fix)', () => {
        // This tests the fix for the bug where inline code at line start
        // was not being preserved during preprocessing
        const input = '`<!-- form -->`';
        const result = preprocessCommentSyntax(input);

        expect(result).toBe(input);
        expect(result).not.toContain('{% form');
      });

      it('does not transform inside inline code with only leading whitespace', () => {
        const input = '  `<!-- field id="test" -->`';
        const result = preprocessCommentSyntax(input);

        expect(result).toBe(input);
      });

      it('handles nested code blocks correctly', () => {
        const input = `\`\`\`\`markdown
Here's a code example:
\`\`\`
<!-- form id="nested" -->
\`\`\`
\`\`\`\`
<!-- form id="outside" -->`;

        const result = preprocessCommentSyntax(input);

        // Inside the outer code block, nothing should be transformed
        expect(result).toContain('<!-- form id="nested" -->');
        // Outside should be transformed
        expect(result).toContain('{% form id="outside" %}');
      });

      it('handles code block with indented opening', () => {
        const input = `   \`\`\`
<!-- form id="inside" -->
   \`\`\`
<!-- form id="outside" -->`;

        const result = preprocessCommentSyntax(input);

        // Inside (with 3-space indent, valid code block)
        expect(result).toContain('<!-- form id="inside" -->');
        // Outside should be transformed
        expect(result).toContain('{% form id="outside" %}');
      });

      it('does not treat 4+ space indented backticks as code fence', () => {
        const input = `    \`\`\`
<!-- form id="should-transform" -->
    \`\`\``;

        const result = preprocessCommentSyntax(input);

        // 4 spaces = not a code fence per CommonMark, so it should transform
        expect(result).toContain('{% form id="should-transform" %}');
      });
    });

    describe('edge cases', () => {
      it('handles empty input', () => {
        expect(preprocessCommentSyntax('')).toBe('');
      });

      it('handles input with no directives', () => {
        const input = 'Just plain text with no directives';
        expect(preprocessCommentSyntax(input)).toBe(input);
      });

      it('handles multiple annotations on same line (inside form)', () => {
        const input =
          '<!-- form id="test" -->- [ ] Option A <!-- #optA --> <!-- .primary --><!-- /form -->';
        const expected = '{% form id="test" %}- [ ] Option A {% #optA %} {% .primary %}{% /form %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('handles whitespace variations in comments', () => {
        // Extra whitespace
        expect(preprocessCommentSyntax('<!--   form id="test"   -->')).toBe('{% form id="test" %}');
        // Minimal whitespace
        expect(preprocessCommentSyntax('<!-- form id="test"-->')).toBe('{% form id="test" %}');
      });

      it('handles self-closing with whitespace before slash (inside form)', () => {
        const input = '<!-- form id="test" --><!-- field kind="string" /  --><!-- /form -->';
        // The slash with trailing space should still be detected
        expect(preprocessCommentSyntax(input)).toContain('/%}');
      });

      it('handles unclosed HTML comments gracefully', () => {
        const input = '<!-- form id="test"';
        // Should pass through unchanged since no closing -->
        expect(preprocessCommentSyntax(input)).toBe(input);
      });

      it('handles unclosed code blocks gracefully', () => {
        const input = `\`\`\`
<!-- form id="inside" -->
No closing fence`;

        const result = preprocessCommentSyntax(input);

        // Inside unclosed code block, should not transform
        expect(result).toContain('<!-- form id="inside" -->');
      });

      it('preserves Windows line endings', () => {
        const input = '<!-- form id="test" -->\r\n<!-- /form -->\r\n';
        const result = preprocessCommentSyntax(input);

        expect(result).toBe('{% form id="test" %}\r\n{% /form %}\r\n');
      });
    });
  });

  describe('detectSyntaxStyle', () => {
    it('returns html-comment for comment syntax', () => {
      const input = '<!-- form id="test" --><!-- /form -->';
      expect(detectSyntaxStyle(input)).toBe('comments');
    });

    it('returns markdoc for Markdoc syntax', () => {
      const input = '{% form id="test" %}{% /form %}';
      expect(detectSyntaxStyle(input)).toBe('tags');
    });

    it('returns markdoc for empty input', () => {
      expect(detectSyntaxStyle('')).toBe('tags');
    });

    it('returns markdoc for plain text with no directives', () => {
      const input = 'Just plain text with no directives';
      expect(detectSyntaxStyle(input)).toBe('tags');
    });

    it('does not detect from #id annotation alone (requires form tag)', () => {
      const input = '- [ ] Option <!-- #opt -->';
      expect(detectSyntaxStyle(input)).toBe('tags'); // No form tag with id=
    });

    it('does not detect from .class annotation alone (requires form tag)', () => {
      const input = '- [ ] Option <!-- .highlight -->';
      expect(detectSyntaxStyle(input)).toBe('tags'); // No form tag with id=
    });

    it('does not detect from closing tag alone (requires form tag)', () => {
      const input = 'Some content\n<!-- /form -->';
      expect(detectSyntaxStyle(input)).toBe('tags'); // No opening form tag with id=
    });

    it('returns style based on form tag with id=', () => {
      // Markdoc form tag with id=
      const markdocFirst = '{% form id="x" %}<!-- field -->{% /form %}';
      expect(detectSyntaxStyle(markdocFirst)).toBe('tags');

      // Comment form tag with id=
      const commentFirst = '<!-- form id="x" -->{% field %}<!-- /form -->';
      expect(detectSyntaxStyle(commentFirst)).toBe('comments');
    });

    it('ignores regular HTML comments when detecting', () => {
      // Regular comment before Markdoc tag
      const input = '<!-- regular comment -->{% form id="test" %}';
      expect(detectSyntaxStyle(input)).toBe('tags');
    });

    it('ignores form tag without id= attribute', () => {
      // Form tag without id= should not trigger detection
      const input = '<!-- form -->some content<!-- /form -->';
      expect(detectSyntaxStyle(input)).toBe('tags');
    });

    it('ignores form tag with text but no attributes', () => {
      // "form follows" is not a valid form tag
      const input = '<!-- form follows for the meeting -->';
      expect(detectSyntaxStyle(input)).toBe('tags');
    });

    describe('Markdoc attribute syntax variations', () => {
      it('detects form with double-quoted id', () => {
        const input = '<!-- form id="test" -->';
        expect(detectSyntaxStyle(input)).toBe('comments');
      });

      it('detects form with single-quoted id', () => {
        const input = "<!-- form id='test' -->";
        expect(detectSyntaxStyle(input)).toBe('comments');
      });

      it('detects form with unquoted id', () => {
        const input = '<!-- form id=test -->';
        expect(detectSyntaxStyle(input)).toBe('comments');
      });

      it('detects form with expression id', () => {
        const input = '<!-- form id={variable} -->';
        expect(detectSyntaxStyle(input)).toBe('comments');
      });

      it('detects form with spaced id assignment', () => {
        const input = '<!-- form id = "test" -->';
        expect(detectSyntaxStyle(input)).toBe('comments');
      });

      it('detects form with id not as first attribute', () => {
        const input = '<!-- form spec="MF/0.1" id="test" title="My Form" -->';
        expect(detectSyntaxStyle(input)).toBe('comments');
      });

      it('does not match id inside another word', () => {
        // "valid" contains "id" but should not match
        const input = '<!-- form valid="test" -->';
        expect(detectSyntaxStyle(input)).toBe('tags');
      });

      it('detects Markdoc tag syntax with various id formats', () => {
        expect(detectSyntaxStyle('{% form id="x" %}')).toBe('tags');
        expect(detectSyntaxStyle("{% form id='x' %}")).toBe('tags');
        expect(detectSyntaxStyle('{% form id=x %}')).toBe('tags');
        expect(detectSyntaxStyle('{% form id={var} %}')).toBe('tags');
      });
    });

    it('handles frontmatter correctly', () => {
      const input = `---
markform:
  spec: MF/0.1
---
<!-- form id="test" -->`;

      expect(detectSyntaxStyle(input)).toBe('comments');
    });

    describe('ignores code blocks', () => {
      it('ignores comment syntax in fenced code block', () => {
        const input = `\`\`\`md
<!-- form id="x" -->
\`\`\`
{% form id="y" %}`;

        expect(detectSyntaxStyle(input)).toBe('tags');
      });

      it('ignores markdoc syntax in fenced code block', () => {
        const input = `\`\`\`md
{% form id="x" %}
\`\`\`
<!-- form id="y" -->`;

        expect(detectSyntaxStyle(input)).toBe('comments');
      });

      it('ignores comment syntax in inline code span', () => {
        const input = 'Use the syntax `<!-- form id="x" -->` to create forms. {% form id="y" %}';
        expect(detectSyntaxStyle(input)).toBe('tags');
      });

      it('ignores markdoc syntax in inline code span', () => {
        const input = 'Use the syntax `{% form id="x" %}` to create forms. <!-- form id="y" -->';
        expect(detectSyntaxStyle(input)).toBe('comments');
      });

      it('handles double-backtick inline code', () => {
        const input = 'Example: `` `<!-- form id="x" -->` `` and then {% form id="y" %}';
        expect(detectSyntaxStyle(input)).toBe('tags');
      });

      it('returns markdoc when only code blocks contain syntax', () => {
        const input = `Here is an example:

\`\`\`md
<!-- form id="x" -->
{% form id="y" %}
\`\`\`

No real tags here.`;

        expect(detectSyntaxStyle(input)).toBe('tags');
      });
    });

    describe('spacing tolerance', () => {
      it('detects comment syntax with space after <!--', () => {
        const input = '<!-- form id="test" --><!-- /form -->';
        expect(detectSyntaxStyle(input)).toBe('comments');
      });

      it('detects comment syntax without space after <!--', () => {
        const input = '<!--form id="test" --><!-- /form -->';
        expect(detectSyntaxStyle(input)).toBe('comments');
      });

      it('detects comment syntax with multiple spaces after <!--', () => {
        const input = '<!--  form id="test" --><!-- /form -->';
        expect(detectSyntaxStyle(input)).toBe('comments');
      });

      it('does not detect #id annotation alone (requires form tag)', () => {
        const input = '- [ ] Option <!--#opt -->';
        expect(detectSyntaxStyle(input)).toBe('tags'); // No form tag with id=
      });

      it('does not detect closing tag alone (requires form tag)', () => {
        const input = 'Some content\n<!--/form -->';
        expect(detectSyntaxStyle(input)).toBe('tags'); // No opening form tag with id=
      });
    });
  });

  describe('validateSyntaxConsistency', () => {
    describe('when expecting html-comment syntax', () => {
      it('returns empty array for pure comment syntax', () => {
        const input = `<!-- form id="test" -->
<!-- field kind="string" id="name" --><!-- /field -->
<!-- /form -->`;

        const violations = validateSyntaxConsistency(input, 'comments');
        expect(violations).toEqual([]);
      });

      it('returns violations for Markdoc tags', () => {
        const input = `<!-- form id="test" -->
{% field kind="string" id="name" %}{% /field %}
<!-- /form -->`;

        const violations = validateSyntaxConsistency(input, 'comments');
        expect(violations).toHaveLength(2);
        expect(violations[0]).toMatchObject({
          line: 2,
          foundSyntax: 'tags',
        });
        expect(violations[0]!.pattern).toContain('{% field');
      });

      it('returns violation with correct line number', () => {
        const input = `<!-- form id="test" -->
Line 2
{% field id="x" %}
Line 4
<!-- /form -->`;

        const violations = validateSyntaxConsistency(input, 'comments');
        expect(violations).toHaveLength(1);
        expect(violations[0]!.line).toBe(3);
      });

      it('ignores Markdoc syntax inside code blocks', () => {
        const input = `<!-- form id="test" -->
\`\`\`
{% field %}
\`\`\`
<!-- /form -->`;

        const violations = validateSyntaxConsistency(input, 'comments');
        expect(violations).toEqual([]);
      });

      it('ignores Markdoc syntax inside inline code', () => {
        const input = `<!-- form id="test" -->
Use \`{% field %}\` to create fields.
<!-- /form -->`;

        const violations = validateSyntaxConsistency(input, 'comments');
        expect(violations).toEqual([]);
      });
    });

    describe('when expecting markdoc syntax', () => {
      it('returns empty array for pure Markdoc syntax', () => {
        const input = `{% form id="test" %}
{% field kind="string" id="name" %}{% /field %}
{% /form %}`;

        const violations = validateSyntaxConsistency(input, 'tags');
        expect(violations).toEqual([]);
      });

      it('returns violations for comment tags', () => {
        const input = `{% form id="test" %}
<!-- field kind="string" id="name" --><!-- /field -->
{% /form %}`;

        const violations = validateSyntaxConsistency(input, 'tags');
        expect(violations).toHaveLength(2);
        expect(violations[0]).toMatchObject({
          line: 2,
          foundSyntax: 'comments',
        });
        expect(violations[0]!.pattern).toContain('<!-- field');
      });

      it('returns violations for #id annotations', () => {
        const input = `{% form id="test" %}
- [ ] Option <!-- #opt -->
{% /form %}`;

        const violations = validateSyntaxConsistency(input, 'tags');
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({
          line: 2,
          pattern: '<!-- #opt -->',
          foundSyntax: 'comments',
        });
      });

      it('returns violations for .class annotations', () => {
        const input = `{% form id="test" %}
- [ ] Option <!-- .highlight -->
{% /form %}`;

        const violations = validateSyntaxConsistency(input, 'tags');
        expect(violations).toHaveLength(1);
        expect(violations[0]!.pattern).toBe('<!-- .highlight -->');
      });

      it('does not flag regular HTML comments', () => {
        const input = `{% form id="test" %}
<!-- This is a regular comment -->
{% /form %}`;

        const violations = validateSyntaxConsistency(input, 'tags');
        expect(violations).toEqual([]);
      });

      it('ignores comment syntax inside code blocks', () => {
        const input = `{% form id="test" %}
\`\`\`
<!-- field -->
<!-- #id -->
\`\`\`
{% /form %}`;

        const violations = validateSyntaxConsistency(input, 'tags');
        expect(violations).toEqual([]);
      });
    });

    describe('edge cases', () => {
      it('handles empty input', () => {
        expect(validateSyntaxConsistency('', 'comments')).toEqual([]);
        expect(validateSyntaxConsistency('', 'tags')).toEqual([]);
      });

      it('handles multiple violations on same line', () => {
        const input =
          '<!-- form id="test" -->{% field id="a" %}{% /field %}{% field id="b" %}{% /field %}<!-- /form -->';
        const violations = validateSyntaxConsistency(input, 'comments');

        expect(violations.length).toBeGreaterThanOrEqual(4);
        // All should be on line 1
        for (const v of violations) {
          expect(v.line).toBe(1);
        }
      });

      it('handles mixed syntax document', () => {
        const input = `<!-- form id="test" -->
{% field id="x" %}
<!-- #id -->
{% /field %}
<!-- /form -->`;

        // When expecting comments, find markdoc violations
        const commentViolations = validateSyntaxConsistency(input, 'comments');
        expect(commentViolations.length).toBe(2);
        expect(commentViolations.every((v) => v.foundSyntax === 'tags')).toBe(true);

        // When expecting markdoc, find comment violations
        const markdocViolations = validateSyntaxConsistency(input, 'tags');
        expect(markdocViolations.length).toBe(2); // form and #id
        expect(markdocViolations.every((v) => v.foundSyntax === 'comments')).toBe(true);
      });

      it('truncates long patterns in violation', () => {
        const longTag =
          '{% field kind="string" id="very-long-identifier" label="A very long label" %}';
        const input = `<!-- form id="test" -->\n${longTag}\n<!-- /form -->`;

        const violations = validateSyntaxConsistency(input, 'comments');
        expect(violations).toHaveLength(1);
        // Pattern should be captured (may be long)
        expect(violations[0]!.pattern).toBe(longTag);
      });

      it('ignores comments outside form boundaries', () => {
        // Comments before and after form should pass through
        const input = `<!-- field notes for this section -->
{% form id="test" %}
{% field id="name" %}{% /field %}
{% /form %}
<!-- form follows later -->`;

        // No violations - the comment-like patterns are outside form
        const violations = validateSyntaxConsistency(input, 'tags');
        expect(violations).toEqual([]);
      });
    });
  });
});
