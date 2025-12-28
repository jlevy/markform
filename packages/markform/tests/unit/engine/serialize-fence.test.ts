import { describe, expect, it } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';
import { maxRunAtLineStart, pickFence, serialize } from '../../../src/engine/serialize.js';

describe('engine/serialize - smart fence selection', () => {
  describe('maxRunAtLineStart', () => {
    it('returns 0 for no fence chars', () => {
      expect(maxRunAtLineStart('plain text', '`')).toBe(0);
      expect(maxRunAtLineStart('plain text', '~')).toBe(0);
    });

    it('returns 3 for triple backticks at line start', () => {
      const value = '```python\nprint("hi")\n```';
      expect(maxRunAtLineStart(value, '`')).toBe(3);
    });

    it('returns 4 for four backticks at line start', () => {
      const value = '````markdown\nsome code\n````';
      expect(maxRunAtLineStart(value, '`')).toBe(4);
    });

    it('returns 4 for four tildes at line start', () => {
      const value = '~~~~sh\necho hi\n~~~~';
      expect(maxRunAtLineStart(value, '~')).toBe(4);
    });

    it('returns 0 for fence chars with 4+ space indent (safe inside code block)', () => {
      const value = '    ```python\n    code\n    ```';
      expect(maxRunAtLineStart(value, '`')).toBe(0);
    });

    it('returns correct max for fence chars with 1-3 space indent', () => {
      // 1 space indent
      expect(maxRunAtLineStart(' ```', '`')).toBe(3);
      // 2 space indent
      expect(maxRunAtLineStart('  ```', '`')).toBe(3);
      // 3 space indent
      expect(maxRunAtLineStart('   ```', '`')).toBe(3);
    });

    it('finds max run across multiple lines', () => {
      const value = '```\nsome code\n`````\nmore\n```';
      expect(maxRunAtLineStart(value, '`')).toBe(5);
    });

    it('correctly handles mixed backticks and tildes', () => {
      const value = '```python\ncode\n~~~shell\nshell\n~~~';
      expect(maxRunAtLineStart(value, '`')).toBe(3);
      expect(maxRunAtLineStart(value, '~')).toBe(3);
    });

    it('correctly counts very long runs', () => {
      const value = '``````````\ncode\n``````````'; // 10 backticks
      expect(maxRunAtLineStart(value, '`')).toBe(10);
    });
  });

  describe('pickFence', () => {
    it('returns backticks length 3 for plain text', () => {
      const result = pickFence('plain text');
      expect(result.char).toBe('`');
      expect(result.len).toBe(3);
      expect(result.processFalse).toBe(false);
    });

    it('returns tildes when content has backticks but no tildes', () => {
      // Content with backticks but no tildes - tildes have smaller max-run (0 < 3)
      const value = '```python\nprint("hi")\n```';
      const result = pickFence(value);
      expect(result.char).toBe('~');
      expect(result.len).toBe(3);
    });

    it('returns tildes for content with many backticks', () => {
      const value = '`````\ncode\n`````'; // 5 backticks
      const result = pickFence(value);
      expect(result.char).toBe('~');
      expect(result.len).toBe(3);
    });

    it('prefers backticks on tie', () => {
      const value = '```\ncode\n~~~';
      const result = pickFence(value);
      // Both have max 3, should prefer backticks
      expect(result.char).toBe('`');
      expect(result.len).toBe(4);
    });

    it('detects Markdoc tags and sets processFalse', () => {
      const value = 'Use {% callout %} for emphasis.';
      const result = pickFence(value);
      expect(result.processFalse).toBe(true);
    });

    it('does not set processFalse for non-Markdoc content', () => {
      const value = 'Just plain text with no tags';
      const result = pickFence(value);
      expect(result.processFalse).toBe(false);
    });

    it('handles content with both code blocks and Markdoc tags', () => {
      // Content has backticks but no tildes, so tildes win (0 < 3)
      const value = '```js\nconsole.log("hi")\n```\n\nUse {% callout %} here.';
      const result = pickFence(value);
      expect(result.char).toBe('~');
      expect(result.len).toBe(3);
      expect(result.processFalse).toBe(true);
    });

    it('uses tildes when backtick runs are longer', () => {
      const value = '``````\ncode\n``````\n\n~~~\nshell\n~~~';
      const result = pickFence(value);
      // backticks: 6, tildes: 3 -> pick tildes
      expect(result.char).toBe('~');
      expect(result.len).toBe(4);
    });
  });

  describe('formatValueFence via serialize', () => {
    it('uses triple backticks for plain content', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="desc" label="Description" %}
\`\`\`value
Plain text content
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      expect(output).toContain('```value');
      expect(output).toContain('Plain text content');
    });

    it('uses tildes for content with triple-backtick code block', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="code" label="Code" multiline=true %}
\`\`\`\`value
Here is some code:

\`\`\`python
print("hello")
\`\`\`
\`\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      // Content has backticks but no tildes, so tildes win (shorter max-run)
      expect(output).toContain('~~~value');
      expect(output).toContain('```python');
    });

    it('adds process=false for content with Markdoc tags', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="docs" label="Documentation" multiline=true %}
\`\`\`value {% process=false %}
Use the {% callout %} tag for emphasis.
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      expect(output).toContain('{% process=false %}');
      expect(output).toContain('{% callout %}');
    });

    it('uses tildes when content has many backticks', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="meta" label="Meta" multiline=true %}
~~~value
This content has lots of backticks at line start:
\`\`\`\`\`\`
nested
\`\`\`\`\`\`
~~~
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      // Should use tildes since backticks have a longer run
      expect(output).toMatch(/~~~+value/);
    });
  });

  describe('round-trip tests for fence escaping', () => {
    it('round-trips value containing triple-backtick code block', () => {
      const codeContent = `Here is a code example:

\`\`\`javascript
function greet() {
  console.log("Hello!");
}
\`\`\`

That was the code.`;

      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="example" label="Example" multiline=true %}
\`\`\`\`value
${codeContent}
\`\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.responsesByFieldId.example?.value;
      expect(value?.kind).toBe('string');
      if (value?.kind === 'string') {
        expect(value.value).toBe(codeContent);
      }
    });

    it('round-trips value containing tilde code block', () => {
      const codeContent = `Shell example:

~~~bash
echo "hello world"
~~~

Done.`;

      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="shell" label="Shell" multiline=true %}
\`\`\`value
${codeContent}
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.responsesByFieldId.shell?.value;
      expect(value?.kind).toBe('string');
      if (value?.kind === 'string') {
        expect(value.value).toBe(codeContent);
      }
    });

    it('round-trips value containing Markdoc tags', () => {
      const docContent = `Use {% callout type="warning" %} for warnings.

And {% partial file="footer" /%} for partials.`;

      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="docs" label="Docs" multiline=true %}
\`\`\`value {% process=false %}
${docContent}
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.responsesByFieldId.docs?.value;
      expect(value?.kind).toBe('string');
      if (value?.kind === 'string') {
        expect(value.value).toBe(docContent);
      }
    });

    it('round-trips value with both backticks and tildes', () => {
      const mixedContent = `Multiple code blocks:

\`\`\`javascript
const x = 1;
\`\`\`

~~~python
print("hi")
~~~

Both work!`;

      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="mixed" label="Mixed" multiline=true %}
\`\`\`\`value
${mixedContent}
\`\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.responsesByFieldId.mixed?.value;
      expect(value?.kind).toBe('string');
      if (value?.kind === 'string') {
        expect(value.value).toBe(mixedContent);
      }
    });

    it('round-trips pathological case with many fence chars', () => {
      const pathologicalContent = `Extreme nesting:

\`\`\`\`\`\`\`\`\`\`
nested 10 backticks
\`\`\`\`\`\`\`\`\`\`

~~~~~~~~~
nested 9 tildes
~~~~~~~~~

Done.`;

      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="extreme" label="Extreme" multiline=true %}
~~~~~~~~~~~value
${pathologicalContent}
~~~~~~~~~~~
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.responsesByFieldId.extreme?.value;
      expect(value?.kind).toBe('string');
      if (value?.kind === 'string') {
        expect(value.value).toBe(pathologicalContent);
      }
    });

    it('round-trips empty content correctly', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="empty" label="Empty" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      expect(reparsed.responsesByFieldId.empty?.state).toBe('unanswered');
    });

    it('round-trips sentinel values with new fence format', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" state="skipped" %}
\`\`\`value
|SKIP| (Not applicable for this analysis)
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      expect(reparsed.responsesByFieldId.notes?.state).toBe('skipped');
      expect(reparsed.responsesByFieldId.notes?.reason).toBe('Not applicable for this analysis');
    });
  });
});
