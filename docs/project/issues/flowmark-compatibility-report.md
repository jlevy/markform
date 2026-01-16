# Flowmark Enhancement Request: Support for Markdoc Tags and Semantic HTML Comments

**Flowmark Version:** 0.6.0
**Issue Type:** Enhancement / Bug
**Priority:** High (breaks downstream tooling)

## Summary

Flowmark's text wrapping and formatting logic does not recognize Markdoc-style tags (`{% tag %}`) or semantic HTML comments (`<!-- prefix:tag -->`) as structural elements. This causes formatting that breaks parsers expecting these syntaxes, including:

- [Markdoc](https://markdoc.dev/) - Stripe's Markdown-based document format
- [Markform](https://github.com/jlevy/markform) - Form definition format built on Markdoc
- [WordPress Gutenberg](https://developer.wordpress.org/block-editor/) - Uses `<!-- wp:block -->` comment syntax
- Any templating system using Jinja-style `{% %}` delimiters

## Affected Use Cases

1. **Markdoc documents** - Technical documentation with custom tags
2. **Markform `.form.md` files** - Structured forms with field definitions
3. **WordPress block content** - Gutenberg block markup
4. **Hugo/Jekyll templates** - Static site generators with Jinja-style syntax

---

## Issue 1: Content Merged with Opening Tags

### Problem
Flowmark places content on the same line as an opening block tag, breaking parsers that expect content to start on a new line.

### Before (correct)
```markdown
{% description ref="example" %}
This is a multi-line description.
It should remain on separate lines.
{% /description %}
```

### After Flowmark (broken)
```markdown
{% description ref="example" %} This is a multi-line description.
It should remain on separate lines.
{% /description %}
```

### Same issue with HTML comments
```markdown
<!-- Before -->
<!-- f:description ref="example" -->
This is a multi-line description.
<!-- /f:description -->

<!-- After (broken) -->
<!-- f:description ref="example" --> This is a multi-line description.
<!-- /f:description -->
```

### Impact
- Parsers may interpret the tag + content as a single inline element
- Whitespace-sensitive content loses its structure

---

## Issue 2: Closing Tags Merged with List Items

### Problem
When a tag contains a list, Flowmark moves the closing tag onto the same line as the last list item.

### Before (correct)
```markdown
{% field kind="single_select" id="choice" label="Choice" %}
- [ ] Option A {% #option_a %}
- [ ] Option B {% #option_b %}
- [ ] Option C {% #option_c %}
{% /field %}
```

### After Flowmark (broken)
```markdown
{% field kind="single_select" id="choice" label="Choice" %}

- [ ] Option A {% #option_a %}

- [ ] Option B {% #option_b %}

- [ ] Option C {% #option_c %} {% /field %}
```

### Impact
- **Critical parser failure**: The closing tag `{% /field %}` is interpreted as part of the list item's annotation
- Markform parser error: `Option in field 'choice' missing ID annotation`
- The tag structure is completely broken

---

## Issue 3: Same-Line Tag Pairs Broken by Wrapping

### Problem
PR #10 correctly keeps individual tags atomic, but when two tags appear on the same line
(common for empty/self-closing fields), line wrapping can break the second tag.

**Note:** Individual tags on their own lines ARE preserved correctly in v0.6.0.

### Before (correct)
```markdown
{% field kind="string" id="email" label="Email" required=true placeholder="email" %}{% /field %}
```

### After Flowmark (broken)
```markdown
{% field kind="string" id="email" label="Email" required=true placeholder="email" %}{%
/field %}
```

### HTML comment variant (also broken)
```markdown
<!-- Before -->
<!-- f:field kind="string" id="email" label="Email" required=true placeholder="email" --><!-- /f:field -->

<!-- After -->
<!-- f:field kind="string" id="email" label="Email" required=true placeholder="email" --><!--
/f:field -->
```

### Workaround
Put closing tags on separate lines:
```markdown
{% field kind="string" id="email" label="Email" required=true placeholder="email" %}
{% /field %}
```
This is preserved correctly in v0.6.0.

### Impact
- Second tag in same-line pairs gets broken
- Common Markform pattern `{% field %}{% /field %}` for empty fields is affected
- Parser cannot recognize the split closing tag

---

## Issue 3a: Backslash Escapes Stripped from Attribute Values

### Problem
Backslash characters in attribute values (e.g., regex patterns) are being removed.

### Before (correct)
```markdown
pattern="^[^@]+@[^@]+\.[^@]+$"
```

### After Flowmark (broken)
```markdown
pattern="^[^@]+@[^@]+.[^@]+$"
```

### Impact
- Regex patterns are corrupted (`\.` → `.` changes meaning)
- Any escaped characters in attributes are affected
- Silent data corruption - no error, just wrong output

---

## Issue 4: Blank Lines Added Between List Items

### Problem
Flowmark converts tight lists to loose lists by adding blank lines between items.

### Before (tight list, correct)
```markdown
- [ ] Option A {% #option_a %}
- [ ] Option B {% #option_b %}
- [ ] Option C {% #option_c %}
```

### After Flowmark (loose list)
```markdown
- [ ] Option A {% #option_a %}

- [ ] Option B {% #option_b %}

- [ ] Option C {% #option_c %}
```

### Impact
- Changes semantic meaning (tight vs loose lists render differently)
- Combined with Issue 2, this moves closing tags incorrectly
- May affect parsers that rely on tight list structure

---

## Issue 5: Nested Tags Collapsed

### Problem
Nested tag structures get collapsed onto single lines, losing hierarchy.

### Before (correct)
```markdown
{% form id="test" %}
{% group id="section" title="Section Title" %}
{% field kind="number" id="count" label="Count" %}{% /field %}
{% /group %}
{% /form %}
```

### After Flowmark (collapsed)
```markdown
{% form id="test" %} {% group id="section" title="Section Title" %}
{% field kind="number" id="count" label="Count" %}{% /field %}
{% /group %} {% /form %}
```

### Impact
- Loses visual hierarchy and readability
- Multiple tags on one line may confuse parsers
- Difficult to maintain and review

---

## Issue 6: Tables Inside Tags Broken

### Problem
Tables within tags get merged with the closing tag.

### Before (correct)
```markdown
{% field kind="table" id="data" label="Data Table" %}
| Name | Value |
|------|-------|
{% /field %}
```

### After Flowmark (broken)
```markdown
{% field kind="table" id="data" label="Data Table" %}
| Name | Value | |------|-------| {% /field %}
```

### Impact
- Table structure completely destroyed
- Parser cannot recognize table or closing tag

---

## Issue 7: List Item Annotations Affected

### Problem
Annotations at the end of list items (Markdoc shorthand or Gutenberg-style) interact poorly with list formatting.

### Before (correct)
```markdown
- Item with annotation <!-- #item_id -->
- Another item <!-- .some_class -->
```

### After Flowmark (loose list)
```markdown
- Item with annotation <!-- #item_id -->

- Another item <!-- .some_class -->
```

### Impact
- Loose list changes rendering
- When combined with other issues, annotations may be parsed incorrectly

---

## Proposed Solutions

### Option A: Recognize Tags as Block Elements (Recommended)

Treat Markdoc tags and semantic HTML comments as block-level elements that should:
1. Never have content merged onto the same line as an opening tag
2. Always have closing tags on their own line
3. Never be wrapped internally

**Detection patterns:**
- Markdoc/Jinja: `{% tagname ... %}` and `{% /tagname %}`
- HTML comments with prefix: `<!-- prefix:tagname ... -->` and `<!-- /prefix:tagname -->`
- Common prefixes: `f:`, `wp:`, or configurable

### Option B: Add Ignore Directives

Support inline directives to skip formatting:

```markdown
<!-- flowmark-ignore-start -->
{% field kind="single_select" id="choice" %}
- [ ] Option A {% #option_a %}
- [ ] Option B {% #option_b %}
{% /field %}
<!-- flowmark-ignore-end -->
```

Or single-line:
```markdown
{% field ... %}{% /field %} <!-- flowmark-ignore-line -->
```

### Option C: Configuration File

Support `.flowmarkrc` or similar:

```yaml
# .flowmarkrc
preserve_patterns:
  - '\{%.*?%\}'           # Markdoc/Jinja tags
  - '<!--\s*\w+:.*?-->'   # Prefixed HTML comments
  - '<!--\s*[#.].*?-->'   # Annotation comments

block_elements:
  - '\{%\s*\w+.*?%\}'     # Opening Markdoc tags
  - '<!--\s*\w+:\w+.*?-->' # Opening HTML comment tags
```

### Option D: File Extension Handling

Recognize specific file extensions that use these syntaxes:
- `.form.md` - Markform files
- `.mdoc` - Markdoc files
- Disable aggressive formatting for these extensions

---

## Test Files

### Markdoc Syntax Test (`test-markdoc.md`)
```markdown
{% description ref="example" %}
This is a multi-line description.
It should remain on separate lines.
{% /description %}

{% field kind="single_select" id="choice" label="Choice" %}
- [ ] Option A {% #option_a %}
- [ ] Option B {% #option_b %}
- [ ] Option C {% #option_c %}
{% /field %}
```

### HTML Comment Syntax Test (`test-comments.md`)
```markdown
<!-- f:description ref="example" -->
This is a multi-line description.
It should remain on separate lines.
<!-- /f:description -->

<!-- f:field kind="single_select" id="choice" label="Choice" -->
- [ ] Option A <!-- #option_a -->
- [ ] Option B <!-- #option_b -->
- [ ] Option C <!-- #option_c -->
<!-- /f:field -->
```

**Expected behavior:** Both files should remain unchanged after `flowmark --auto`.

---

## References

- [Markdoc Syntax Specification](https://markdoc.dev/spec)
- [Markdoc Tag Documentation](https://markdoc.dev/docs/tags)
- [WordPress Gutenberg Block Grammar](https://developer.wordpress.org/block-editor/explanations/architecture/key-concepts/)
- [Markform Specification](https://github.com/jlevy/markform)

---

## Workaround (Current)

Users must currently exclude files from Flowmark processing:
- Add `*.form.md` to project-level ignore lists
- Run Flowmark selectively on non-Markdoc files only
- Manually fix formatting after Flowmark runs (not practical)

This is not sustainable for projects that want consistent Markdown formatting across all files.
