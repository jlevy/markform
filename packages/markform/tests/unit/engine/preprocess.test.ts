import { describe, expect, it } from 'vitest';

import { detectSyntaxStyle, preprocessCommentSyntax } from '../../../src/engine/preprocess.js';

describe('engine/preprocess', () => {
  describe('preprocessCommentSyntax', () => {
    describe('basic transformations', () => {
      it('transforms opening tag with f: prefix', () => {
        const input = '<!-- f:form id="test" -->';
        const expected = '{% form id="test" %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms closing tag with /f: prefix', () => {
        const input = '<!-- /f:form -->';
        const expected = '{% /form %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms self-closing tag', () => {
        const input = '<!-- f:field kind="string" id="name" /-->';
        const expected = '{% field kind="string" id="name" /%}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms #id annotation', () => {
        const input = '<!-- #good -->';
        const expected = '{% #good %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('transforms .class annotation', () => {
        const input = '<!-- .highlight -->';
        const expected = '{% .highlight %}';
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
    });

    describe('complex documents', () => {
      it('transforms a complete form', () => {
        const input = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="example" -->
<!-- f:group id="basics" -->

<!-- f:field kind="string" id="name" label="Name" required=true --><!-- /f:field -->

<!-- f:field kind="single_select" id="rating" label="Rating" -->
- [ ] Good <!-- #good -->
- [ ] Bad <!-- #bad -->
<!-- /f:field -->

<!-- /f:group -->
<!-- /f:form -->`;

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
<!-- f:form id="test" -->
<!-- Another regular comment about the form -->
<!-- f:field kind="string" id="name" --><!-- /f:field -->
<!-- /f:form -->`;

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
<!-- f:form id="example" -->
Content here
<!-- /f:form -->
\`\`\`
More text`;

        const result = preprocessCommentSyntax(input);

        // The comment syntax inside the code block should be unchanged
        expect(result).toContain('<!-- f:form id="example" -->');
        expect(result).toContain('<!-- /f:form -->');
        expect(result).not.toContain('{% form');
      });

      it('does not transform inside fenced code blocks with tildes', () => {
        const input = `Some text
~~~markdown
<!-- f:form id="example" -->
Content here
<!-- /f:form -->
~~~
More text`;

        const result = preprocessCommentSyntax(input);

        expect(result).toContain('<!-- f:form id="example" -->');
        expect(result).not.toContain('{% form');
      });

      it('does not transform inside inline code', () => {
        const input = 'Use `<!-- f:form -->` to start a form';
        const result = preprocessCommentSyntax(input);

        expect(result).toBe(input);
        expect(result).not.toContain('{% form');
      });

      it('does not transform inside multi-backtick inline code', () => {
        const input = 'Use ``` <!-- f:form --> ``` for forms';
        const result = preprocessCommentSyntax(input);

        expect(result).toBe(input);
      });

      it('handles nested code blocks correctly', () => {
        const input = `\`\`\`\`markdown
Here's a code example:
\`\`\`
<!-- f:form id="nested" -->
\`\`\`
\`\`\`\`
<!-- f:form id="outside" -->`;

        const result = preprocessCommentSyntax(input);

        // Inside the outer code block, nothing should be transformed
        expect(result).toContain('<!-- f:form id="nested" -->');
        // Outside should be transformed
        expect(result).toContain('{% form id="outside" %}');
      });

      it('handles code block with indented opening', () => {
        const input = `   \`\`\`
<!-- f:form id="inside" -->
   \`\`\`
<!-- f:form id="outside" -->`;

        const result = preprocessCommentSyntax(input);

        // Inside (with 3-space indent, valid code block)
        expect(result).toContain('<!-- f:form id="inside" -->');
        // Outside should be transformed
        expect(result).toContain('{% form id="outside" %}');
      });

      it('does not treat 4+ space indented backticks as code fence', () => {
        const input = `    \`\`\`
<!-- f:form id="should-transform" -->
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

      it('handles multiple annotations on same line', () => {
        const input = '- [ ] Option A <!-- #optA --> <!-- .primary -->';
        const expected = '- [ ] Option A {% #optA %} {% .primary %}';
        expect(preprocessCommentSyntax(input)).toBe(expected);
      });

      it('handles whitespace variations in comments', () => {
        // Extra whitespace
        expect(preprocessCommentSyntax('<!--   f:form id="test"   -->')).toBe(
          '{% form id="test" %}',
        );
        // Minimal whitespace
        expect(preprocessCommentSyntax('<!--f:form id="test"-->')).toBe('{% form id="test" %}');
      });

      it('handles self-closing with whitespace before slash', () => {
        const input = '<!-- f:field kind="string" /  -->';
        // The slash with trailing space should still be detected
        expect(preprocessCommentSyntax(input)).toContain('/%}');
      });

      it('handles unclosed HTML comments gracefully', () => {
        const input = '<!-- f:form id="test"';
        // Should pass through unchanged since no closing -->
        expect(preprocessCommentSyntax(input)).toBe(input);
      });

      it('handles unclosed code blocks gracefully', () => {
        const input = `\`\`\`
<!-- f:form id="inside" -->
No closing fence`;

        const result = preprocessCommentSyntax(input);

        // Inside unclosed code block, should not transform
        expect(result).toContain('<!-- f:form id="inside" -->');
      });

      it('preserves Windows line endings', () => {
        const input = '<!-- f:form id="test" -->\r\n<!-- /f:form -->\r\n';
        const result = preprocessCommentSyntax(input);

        expect(result).toBe('{% form id="test" %}\r\n{% /form %}\r\n');
      });
    });
  });

  describe('detectSyntaxStyle', () => {
    it('returns html-comment for comment syntax', () => {
      const input = '<!-- f:form id="test" --><!-- /f:form -->';
      expect(detectSyntaxStyle(input)).toBe('html-comment');
    });

    it('returns markdoc for Markdoc syntax', () => {
      const input = '{% form id="test" %}{% /form %}';
      expect(detectSyntaxStyle(input)).toBe('markdoc');
    });

    it('returns markdoc for empty input', () => {
      expect(detectSyntaxStyle('')).toBe('markdoc');
    });

    it('returns markdoc for plain text with no directives', () => {
      const input = 'Just plain text with no directives';
      expect(detectSyntaxStyle(input)).toBe('markdoc');
    });

    it('detects html-comment from #id annotation', () => {
      const input = '- [ ] Option <!-- #opt -->';
      expect(detectSyntaxStyle(input)).toBe('html-comment');
    });

    it('detects html-comment from .class annotation', () => {
      const input = '- [ ] Option <!-- .highlight -->';
      expect(detectSyntaxStyle(input)).toBe('html-comment');
    });

    it('detects html-comment from /f: closing tag', () => {
      const input = 'Some content\n<!-- /f:form -->';
      expect(detectSyntaxStyle(input)).toBe('html-comment');
    });

    it('returns style that appears first when mixed', () => {
      // Markdoc first
      const markdocFirst = '{% form %}<!-- f:field -->';
      expect(detectSyntaxStyle(markdocFirst)).toBe('markdoc');

      // Comment first
      const commentFirst = '<!-- f:form -->{% field %}';
      expect(detectSyntaxStyle(commentFirst)).toBe('html-comment');
    });

    it('ignores regular HTML comments when detecting', () => {
      // Regular comment before Markdoc tag
      const input = '<!-- regular comment -->{% form id="test" %}';
      expect(detectSyntaxStyle(input)).toBe('markdoc');
    });

    it('handles frontmatter correctly', () => {
      const input = `---
markform:
  spec: MF/0.1
---
<!-- f:form id="test" -->`;

      expect(detectSyntaxStyle(input)).toBe('html-comment');
    });

    describe('ignores code blocks', () => {
      it('ignores comment syntax in fenced code block', () => {
        const input = `\`\`\`md
<!-- f:form -->
\`\`\`
{% form %}`;

        expect(detectSyntaxStyle(input)).toBe('markdoc');
      });

      it('ignores markdoc syntax in fenced code block', () => {
        const input = `\`\`\`md
{% form %}
\`\`\`
<!-- f:form -->`;

        expect(detectSyntaxStyle(input)).toBe('html-comment');
      });

      it('ignores comment syntax in inline code span', () => {
        const input = 'Use the syntax `<!-- f:form -->` to create forms. {% form %}';
        expect(detectSyntaxStyle(input)).toBe('markdoc');
      });

      it('ignores markdoc syntax in inline code span', () => {
        const input = 'Use the syntax `{% form %}` to create forms. <!-- f:form -->';
        expect(detectSyntaxStyle(input)).toBe('html-comment');
      });

      it('handles double-backtick inline code', () => {
        const input = 'Example: `` `<!-- f:form -->` `` and then {% form %}';
        expect(detectSyntaxStyle(input)).toBe('markdoc');
      });

      it('returns markdoc when only code blocks contain syntax', () => {
        const input = `Here is an example:

\`\`\`md
<!-- f:form -->
{% form %}
\`\`\`

No real tags here.`;

        expect(detectSyntaxStyle(input)).toBe('markdoc');
      });
    });
  });
});
