# Markdoc Multi-line Tag Parsing Bug

**Filed as:** https://github.com/markdoc/markdoc/issues/597

## Summary

Multi-line opening tags break sibling tag detection.
When an opening tag spans multiple lines, subsequent sibling tags get incorrectly nested
as children instead of remaining at the same level.

## Reproduction

Two semantically identical documents—the only difference is line wrapping in the opening
tag:

**Single-line opening tag** (parses correctly):

```markdown
{% field id="a" attr="x" %}{% /field %}
{% field id="b" %}{% /field %}
```

**Multi-line opening tag** (parses incorrectly):

```markdown
{% field id="a"
attr="x" %}{% /field %}
{% field id="b" %}{% /field %}
```

**Test script:**

```javascript
import Markdoc from '@markdoc/markdoc';

const singleLine = `{% field id="a" attr="x" %}{% /field %}
{% field id="b" %}{% /field %}`;

const multiLine = `{% field id="a"
attr="x" %}{% /field %}
{% field id="b" %}{% /field %}`;

function getFieldDepths(doc) {
  const ast = Markdoc.parse(doc);
  let fields = [];
  function walk(node, depth = 0) {
    if (node.type === 'tag' && node.tag === 'field') {
      fields.push({ id: node.attributes?.id, depth });
    }
    for (const child of node.children || []) walk(child, depth + 1);
  }
  walk(ast);
  return fields;
}

console.log('Single-line:', getFieldDepths(singleLine));
// → [ { id: 'a', depth: 3 }, { id: 'b', depth: 3 } ]  ✓ Same depth

console.log('Multi-line:', getFieldDepths(multiLine));
// → [ { id: 'a', depth: 1 }, { id: 'b', depth: 4 } ]  ✗ Different depths!
```

## Expected Behavior

Both documents should produce identical ASTs since they are semantically equivalent per
the [Markdoc tag specification](https://markdoc.dev/spec), which explicitly allows
newlines within tags.

## Actual Behavior

- **Single-line**: Both fields at depth 3 (siblings) ✓

- **Multi-line**: Field “a” at depth 1, field “b” at depth 4 (nested inside “a”) ✗

## Root Cause

In `src/tokenizer/plugins/annotations.ts`, the block tag rule:

1. Detects that the opening tag spans lines 0-1:
   ```
   {% field id="a"
   attr="x" %}{% /field %}
   ```

2. Advances `state.line` past those lines

3. **Content after `%}` on line 1 (the `{% /field %}` closing tag) is never tokenized**

The closing tag is lost, so the block-level `tag_open` has no matching `tag_close`, and
all subsequent content becomes its children.

## Token-level Evidence

```javascript
const Tokenizer = Markdoc.Tokenizer;
const tokenizer = new Tokenizer();

// Single-line: both tags inline, properly paired
tokenizer.tokenize(singleLine);
// → paragraph containing inline: tag_open, tag_close, tag_open, tag_close

// Multi-line: closing tag for "a" is missing!
tokenizer.tokenize(multiLine);
// → tag_open (field a, block-level)
// → paragraph containing inline: tag_open (field b), tag_close (field b)
// → NO tag_close for field a!
```

## Environment

- @markdoc/markdoc version: 0.5.4 (latest as of 2025-01)

- Node.js: v20+

## Workaround

Keep opening tags on a single line.
Do not wrap attributes across multiple lines within `{% ... %}` delimiters.
