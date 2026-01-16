# Research Brief: HTML Comment Syntax Alternatives for Markform

**Last Updated**: 2026-01-11

**Status**: In Progress

**Related**:

- [Markform Specification](../../../markform-spec.md)

- [Markform Reference](../../../markform-reference.md)

- [Markdoc Documentation](https://markdoc.dev/docs/overview)

- [CommonMark Specification](https://spec.commonmark.org/)

* * *

## Executive Summary

This research brief explores the feasibility of using HTML comment-like syntax (`

<!--% ... -->

`) as an alternative to Markdoc's Jinja-style tags (`{% ... %}`) for Markform.
The motivation is to improve compatibility with GitHub rendering, standard Markdown
editors, and other environments that don’t handle Markdoc’s custom tag syntax well.

The current Markform implementation uses Markdoc (`@markdoc/markdoc` v0.5.4), which:

- Parses Markdown via `markdown-it` as a tokenizer

- Uses a PEG.js grammar to parse the `{% %}` tag syntax

- Builds an AST that Markform traverses to extract form schema, values, and
  documentation

This research evaluates four main approaches to introduce an alternative syntax and
analyzes trade-offs for each.
The recommended approach is an **always-on preprocessor** that transparently supports
both syntaxes with no configuration required.

**Research Questions**:

1. Is `

<!--% ... -->

` syntax feasible as a verbatim-transmappable alternative to Markdoc tags?

2. What are the implementation approaches and their trade-offs?

3. Should Markform stick with Markdoc, fork it, or move to a custom parser?

4. Can both syntaxes be supported transparently without configuration flags?

* * *

## Research Methodology

### Approach

- Review of Markform specification and current implementation

- Analysis of Markdoc architecture, tokenizer, and PEG grammar

- Study of CommonMark/GFM specifications for HTML comment handling

- Evaluation of GPT-5 Pro analysis provided by user

- Web research on Markdoc internals and extension mechanisms

### Sources

- [Markdoc Specification](https://markdoc.dev/spec) - formal grammar

- [Markdoc Overview](https://markdoc.dev/docs/overview) - architecture

- [Markdoc Syntax](https://markdoc.dev/docs/syntax) - tag syntax details

- [CommonMark Spec 0.31.2](https://spec.commonmark.org/) - HTML blocks/comments

- [Markdoc GitHub Repository](https://github.com/markdoc/markdoc)

- Markform source code at
  [packages/markform/src/engine/parse.ts](../../../../packages/markform/src/engine/parse.ts)

* * *

## Research Findings

### 1. Current Markform Architecture

**Status**: Complete

**Details**:

- Markform uses `@markdoc/markdoc` for parsing via `Markdoc.parse(markdown)`

- The parser returns a raw AST that Markform traverses to extract:

  - Form schema (form, group, field tags)

  - Field responses/values (from `value` fenced code blocks)

  - Documentation blocks (description, instructions tags)

  - Notes

- Values are stored inline within tag bodies using fenced code blocks with language
  `value`

- Selection fields (checkboxes, single_select, multi_select) use inline `[x]`/`[ ]`
  markers

**Key Insight**: Markform doesn’t use Markdoc’s transform or render phases—only parsing.
This means the implementation could potentially swap out the parser layer without
affecting higher-level functionality.

### 2. Markdoc Parser Internals

**Status**: Complete

**Details**:

The Markdoc parser architecture consists of:

1. **Tokenizer** (wraps `markdown-it`):

   - Uses markdown-it as the underlying tokenizer

   - Adds custom plugins for tag recognition

   - Configuration options: `allowIndentation`, `allowComments`

2. **PEG.js Grammar** (`src/grammar/tag.pegjs`):

   - Defines the interior structure of tags (attributes, values)

   - Does NOT define the `{% %}` delimiters explicitly in the grammar

   - The delimiters are recognized by the markdown-it plugin first

3. **Tag Syntax**:

   - Opening: `{% tagname attr="value" %}`

   - Closing: `{% /tagname %}`

   - Self-closing: `{% tagname /%}`

   - Annotations: `{% #id %}` or `{% .class %}`

**Key Finding**: The `{% %}` delimiter recognition happens in the markdown-it plugin
layer, NOT in the PEG grammar.
This is important—it means changing delimiters requires modifying the tokenizer plugin,
not just the grammar.

### 3. HTML Comment Syntax in CommonMark

**Status**: Complete

**Details**:

Per CommonMark specification:

- HTML comments use `

<!-- comment content -->

`

- They are type 2 HTML blocks when starting a line with `

<!--`

- End condition: line containing `-->

`

- Cannot contain `-->` within the comment body

- Comments can span multiple lines

- Content is preserved literally (no escape processing)

**Key Constraints**:

| Constraint | Impact |
| --- | --- |
| Cannot contain `-->` in content | Low risk—Markform values rarely contain this |
| Type 2 block rules | Multiline directives become HTML blocks |
| Literal content preservation | Useful—attributes preserved exactly |
| Same-line trailing text captured | **Important**—see edge case below |

**Critical Edge Case (CommonMark Spec Behavior)**:

When an HTML comment’s opening (`

<!--`) and closing (`-->

`) are on the **same line**, the *entire line* becomes the HTML block body.
This means:

```markdown

<!--% field id="x" -->

Some trailing text
```

The text “Some trailing text” is captured as part of the HTML block body, **not** parsed
as Markdown. This is spec-compliant behavior per
[CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/#html-block).

However, content on **subsequent lines** is parsed normally:

```markdown

<!--% field id="x" -->

Some text on next line
```

Here “Some text on next line” is parsed as a separate Markdown paragraph.

**Mitigation**: For Markform, this is not a significant concern because:

1. Most directives are on their own lines

2. Inline annotations like `

<!--% #id -->

` at end of list items work correctly 3. The preprocessor transforms before CommonMark
parsing

Reference: [frostming/marko#202](https://github.com/frostming/marko/issues/202)
documents this behavior and confirms spec compliance.

**Assessment**: HTML comments are well-suited for directive syntax.
The `-->` constraint is manageable with escaping or documenting as a limitation.
The same-line trailing text behavior is a minor edge case that doesn’t affect typical
Markform usage patterns.

### 4. Proposed Syntax Alternatives

**Status**: Complete

This section evaluates multiple syntax alternatives, including HTML comment-based approaches
and XML/HTML tag approaches.

* * *

#### 4.1 HTML Comment Syntax Options

**Option A: Percent Prefix (`<!--% ... -->`)**

```markdown
<!--% form id="my_form" -->
<!--% field kind="single_select" id="rating" -->
- [ ] Good <!--% #good -->
- [ ] Bad <!--% #bad -->
<!--% /field -->
<!--% /form -->
```

Mapping:
- `{% tag %}` → `<!--% tag -->`
- `{% /tag %}` → `<!--% /tag -->`
- `{% tag /%}` → `<!--% tag /-->`
- `{% #id %}` → `<!--% #id -->`
- `{% .class %}` → `<!--% .class -->`

| Pros | Cons |
| --- | --- |
| Highly distinctive—won't conflict with regular comments | `%` character feels arbitrary/ugly |
| Simple, consistent transformation rule | All elements need the `%` prefix |
| Unambiguous parsing | |

* * *

**Option B: Wrapper (`<!--{% ... %}-->`)**

```markdown
<!--{% form id="my_form" %}-->
<!--{% field kind="string" id="name" %}--><!--{% /field %}-->
<!--{% /form %}-->
```

Preserves literal Markdoc syntax inside the comment.

| Pros | Cons |
| --- | --- |
| Preserves exact Markdoc syntax inside | Very verbose |
| Easy transmapping (just strip wrapper) | Harder to read |
| Could enable Markdoc syntax highlighting | |

* * *

**Option C: Namespace Prefix (`<!-- f:tag -->`) — RECOMMENDED**

Uses a short namespace prefix for tags, with plain annotations:

```markdown
<!-- f:form id="my_form" -->
<!-- f:field kind="single_select" id="rating" -->
- [ ] Good <!-- #good -->
- [ ] Bad <!-- #bad -->
<!-- /f:field -->
<!-- /f:form -->
```

Mapping:
- `{% tag %}` → `<!-- f:tag -->`
- `{% /tag %}` → `<!-- /f:tag -->`
- `{% tag /%}` → `<!-- f:tag /-->`
- `{% #id %}` → `<!-- #id -->` (no prefix needed)
- `{% .class %}` → `<!-- .class -->` (no prefix needed)

| Pros | Cons |
| --- | --- |
| Clean, readable syntax | Requires recognizing `f:` as special |
| Follows WordPress Gutenberg pattern (`wp:`) | Slightly more complex transformation |
| `f:` suggests "form" semantically | |
| Annotations (`#id`, `.class`) naturally distinctive | |
| Minimal overhead (2 chars for tags, 0 for annotations) | |

**Why annotations don't need a prefix**: The `#identifier` and `.classname` patterns look
like CSS selectors and are unlikely to appear in regular HTML comments. A comment like
`<!-- #good -->` is clearly an ID reference, not prose.

**Alternative namespace prefixes considered**:
- `m:` (Markform) — ties to project name, follows `wp:` pattern
- `mf:` (Markform) — more explicit but verbose

* * *

**Option D: Plain Comments with Contextual Parsing (`<!-- tag -->`)**

```markdown
<!-- form id="my_form" -->
<!-- field kind="single_select" id="rating" -->
- [ ] Good <!-- #good -->
- [ ] Bad <!-- #bad -->
<!-- /field -->
<!-- /form -->
```

Parser recognizes known Markform tag names: `form`, `group`, `field`, `description`,
`instructions`, `note`, and their closing variants.

| Pros | Cons |
| --- | --- |
| Cleanest possible syntax | Risk of false positives with regular comments |
| No special characters needed | `<!-- field notes here -->` could be misinterpreted |
| Most natural reading experience | Requires careful pattern matching |

**Risk assessment**: False positives are unlikely because Markform tags require specific
attributes, but the `f:` namespace (Option C) eliminates this risk entirely.

* * *

#### 4.2 XML/HTML Tag Syntax Options

**Option E: Custom HTML Elements (`<mf-field>`)**

```markdown
<mf-field kind="single_select" id="rating">

- [ ] Good
- [ ] Bad

</mf-field>
```

| Pros | Cons |
| --- | --- |
| Familiar HTML-like syntax | **Requires blank lines** around content |
| Could render in browsers | Content without blank lines gets swallowed |
| Self-closing works naturally | More verbose than comments |

**Critical Issue — Blank Line Requirement**:

Per CommonMark spec, custom HTML elements like `<mf-field>` are type 6/7 HTML blocks.
Their end condition is a **blank line**, not the closing tag. Without blank lines:

```markdown
<mf-field kind="single_select" id="rating">
- [ ] Good
- [ ] Bad
</mf-field>
```

The checkboxes are **not parsed as Markdown**—they become raw HTML block content.

Blank lines are required for correct parsing:

```markdown
<mf-field kind="single_select" id="rating">

- [ ] Good
- [ ] Bad

</mf-field>
```

This is error-prone. Users will forget blank lines and get broken rendering.

* * *

**Option F: Void-style Custom Elements (`<mf-field />`)**

```markdown
<mf-field kind="single_select" id="rating" />
- [ ] Good <mf-option id="good" />
- [ ] Bad <mf-option id="bad" />
<mf-end-field />
```

| Pros | Cons |
| --- | --- |
| Avoids blank line issue | Non-standard—`/>` ignored on non-void elements |
| Clear markers | Requires awkward `<mf-end-field />` pattern |

**Note**: In HTML5, self-closing syntax (`/>`) is only valid on void elements like `<br/>`.
On non-void elements, `/` is ignored: `<div/>` parses as `<div>`.

* * *

#### 4.3 Syntax Comparison Summary

| Option | Example | Distinctive | Readable | Risk | Status |
| --- | --- | --- | --- | --- | --- |
| A: `<!--%` | `<!--% field -->` | High | Medium | None | Viable |
| B: `<!--{%` | `<!--{% field %}-->` | High | Low | None | Not recommended |
| **C: `f:`** | `<!-- f:field -->` | **High** | **High** | **None** | **Preferred** |
| D: Plain | `<!-- field -->` | Low | Highest | Medium | Viable with caution |
| E: HTML tags | `<mf-field>` | High | Medium | **High** | Not recommended |
| F: Void tags | `<mf-field />` | Medium | Low | Medium | Not recommended |

**Recommendation**: Option C (`<!-- f:field -->` with plain `<!-- #id -->` annotations)
provides the best balance of clarity, safety, and readability.

* * *

## Comparative Analysis: Implementation Approaches

### Approach 1: Preprocessor (Recommended)

Transform `

<!--% ... -->

`→`{% ... %}` before passing to Markdoc.
**Always enabled** with no configuration needed.

| Criteria | Assessment |
| --- | --- |
| Implementation effort | Low-Medium |
| Markdoc compatibility | Full—uses Markdoc as-is |
| Two-way conversion | Yes—can convert both directions |
| Dual syntax support | **Always on**—both syntaxes work transparently |
| Source mapping | Preserved (line numbers unchanged) |
| Maintenance burden | Low—Markdoc updates automatically work |

**Implementation Notes**:

```typescript
// Pseudocode - runs on every parse
function preprocessCommentSyntax(markdown: string): string {
  // Must skip fenced code blocks and inline code
  // Replace

<!--% ... -->

with {% ... %}
  // Handle self-closing:

<!--% tag /-->

→ {% tag /%}
  // Returns unchanged if no comment syntax found
}
```

**Key Design Points**:

- Must correctly skip fenced code blocks (``` and ~~~)

- Must skip inline code spans

- Use simple state machine (not regex-only)

- **No flags needed**—`

<!--%` prefix is unambiguous

**Assessment**: Best balance of effort vs.
benefits. Backward compatible.
Both syntaxes always supported with zero configuration.

### Approach 2: Patch Markdoc’s Tokenizer

Modify the markdown-it plugin to recognize `<!--% -->

`in addition to`{% %}`.

| Criteria | Assessment |
| --- | --- |
| Implementation effort | High |
| Markdoc compatibility | Requires fork or monkey-patch |
| Two-way conversion | Not needed—native support |
| Dual syntax support | Yes—both recognized natively |
| Source mapping | Preserved |
| Maintenance burden | High—must maintain fork across updates |

**Implementation Notes**:

Would require:

1. Fork `@markdoc/markdoc`

2. Modify `src/tokenizer/plugins/annotations.ts` (or equivalent)

3. Add regex for `

<!--% ` opening and ` -->

` closing 4. Ensure PEG parser receives same interior content

**Assessment**: Not recommended unless source mapping is critical.
High maintenance cost.

### Approach 3: Fork/Reimplement Markdoc

Create a standalone Markform parser that handles the comment syntax natively.

| Criteria | Assessment |
| --- | --- |
| Implementation effort | Very High |
| Markdoc compatibility | N/A—new parser |
| Two-way conversion | Would need to define |
| Dual syntax support | Full control |
| Source mapping | Full control |
| Maintenance burden | Very High—own all parsing logic |

**Implementation Notes**:

Would involve:

1. Use `markdown-it` directly or alternative (remark/micromark)

2. Implement custom plugin for `

<!--% -->

` recognition 3. Build AST extraction logic (form, group, field, etc.)
4. Reimplement Markform’s value extraction

**Assessment**: Only justified if moving entirely away from Markdoc syntax.
Current Markform investment in Markdoc makes this costly.

### Approach 4: Abandon Markdoc, Use Pure Markdown + Directives

Switch to remark/micromark with a directive plugin.

| Criteria | Assessment |
| --- | --- |
| Implementation effort | High |
| Markdoc compatibility | None—different ecosystem |
| Two-way conversion | Would be Markform ↔ directive syntax |
| Dual syntax support | N/A |
| Source mapping | Yes (remark provides this) |
| Maintenance burden | Medium |

**Assessment**: Major architectural change.
Only consider if completely abandoning Markdoc syntax is acceptable.
Loses the community/tooling around Markdoc.

* * *

## Strengths/Weaknesses Summary

### Approach 1 (Preprocessor)

**Strengths**:

- Minimal implementation effort

- Full Markdoc compatibility maintained

- Can support both syntaxes in parallel

- Low maintenance—Markdoc updates work automatically

- Bidirectional conversion possible

**Weaknesses**:

- Adds a preprocessing step (small performance cost)

- Line number mapping slightly complicated for errors

- Must handle code block skipping carefully

### Approach 2 (Patch Markdoc)

**Strengths**:

- Native support—no preprocessing

- Accurate source mapping

- Clean architecture

**Weaknesses**:

- Requires fork or complex monkey-patching

- High maintenance as Markdoc evolves

- PEG grammar changes risky

### Approach 3 (Fork/Reimplement)

**Strengths**:

- Full control over syntax

- Can optimize for Markform’s specific needs

- No external dependencies

**Weaknesses**:

- Very high initial effort

- Ongoing maintenance burden

- Loses Markdoc ecosystem benefits

### Approach 4 (Abandon Markdoc)

**Strengths**:

- Fresh start with modern tools (remark)

- Could use standard directive proposals

- Active community

**Weaknesses**:

- Major rewrite required

- Breaks existing Markform documents

- Loses Markdoc’s proven parsing

* * *

## Best Practices

1. **Prefer preprocessing for syntax flexibility**: Industry practice shows that
   preprocessing/transpilation is often the most maintainable approach for syntax
   variations (cf. JSX→JS, SCSS→CSS, TypeScript→JavaScript).

2. **Skip code blocks correctly**: Any preprocessor MUST implement proper code block
   detection to avoid transforming content inside examples or literal code.

3. **Document `-->` constraint**: If adopting HTML comments, document that values cannot
   contain the literal string `-->` without escaping.

4. **Support both syntaxes during transition**: Allow `{% %}` and `

<!--% -->

` to coexist for gradual migration.

5. **Keep Markform parser layer thin**: The current architecture where Markform only
   uses Markdoc’s parse phase (not transform/render) should be preserved—it makes
   swapping parsing layers easier.

6. **Place comment directives on their own lines or at line end**: Due to CommonMark
   HTML block behavior, avoid placing text after `-->` on the same line.
   Either put the directive on its own line, or at the end of a line (like `

<!--% #id -->

` at the end of a list item).
This ensures subsequent Markdown is parsed correctly.

* * *

## Open Research Questions

1. **Performance impact of preprocessing**: How does adding a preprocessing step affect
   parse performance for large forms?
   The preprocessor is simple string manipulation, likely negligible, but should verify
   with benchmarks.

2. **Error message quality**: How to provide good error messages that map back to
   original source when using preprocessing?
   Line numbers should be preserved since we only replace delimiters, not change line
   structure.

3. **Self-closing tag convention**: The proposed syntax is `

<!--% tag /-->

`. Is this sufficiently clear?
Alternative considered: `

<!--% tag /%-->

`(closer to Markdoc's`/%}`). Current recommendation: `/--> ` for simplicity.

4. **Syntax detection for serialization**: When a document uses both syntaxes (or
   neither because it’s empty), which should be used for output?
   Proposed: detect first directive found, default to Markdoc syntax if ambiguous.

5. **Tooling/editor support**: What’s needed for syntax highlighting of the new format?
   The comment syntax is valid Markdown, so basic highlighting works.
   Enhanced highlighting for `

<!--% %>` could be added to VSCode extensions.

* * *

## Recommendations

### Summary

**Recommended approach: Preprocessor (Approach 1) with Option C syntax (`<!-- f:tag -->`)**

This provides the best balance of:

- Clean, readable syntax
- Full backward compatibility with existing Markdoc syntax
- Always-on dual syntax support (no flags or configuration needed)
- Low maintenance burden
- GitHub rendering compatibility
- Follows established patterns (WordPress Gutenberg `wp:` prefix)

### Recommended Syntax: Option C (Namespace Prefix)

**Tags use `f:` prefix, annotations are plain:**

| Markdoc Form | Comment Form |
| --- | --- |
| `{% tag attr="val" %}` | `<!-- f:tag attr="val" -->` |
| `{% /tag %}` | `<!-- /f:tag -->` |
| `{% tag /%}` | `<!-- f:tag /--> ` |
| `{% #id %}` | `<!-- #id -->` |
| `{% .class %}` | `<!-- .class -->` |

**Example:**

```markdown
<!-- f:form id="example" -->
<!-- f:field kind="single_select" id="rating" -->
- [ ] Good <!-- #good -->
- [ ] Bad <!-- #bad -->
<!-- /f:field -->
<!-- /f:form -->
```

**Why Option C over Option A (`<!--%`)**:

- `f:` is more semantically meaningful ("form")
- Follows WordPress Gutenberg's established `wp:` pattern
- Annotations (`#id`, `.class`) don't need prefixes—they're naturally distinctive
- Cleaner overall appearance

### Recommended Implementation

Implement a **Markdown-aware preprocessor** that is **always enabled**:

1. Transforms `<!-- f:tag -->` to `{% tag %}` before Markdoc.parse()
2. Transforms `<!-- #id -->` to `{% #id %}`
3. Correctly skips fenced code blocks and inline code
4. **Always supports both syntaxes in parallel** - no flags needed
5. Is implemented as a simple state machine (not regex-only)

**Key Design Decision**: The `f:` namespace prefix and `#`/`.` annotation patterns are
distinctive enough that they will never conflict with regular HTML comments or existing
Markdoc syntax. The preprocessor should **always be active** with no configuration needed.

### Alternative Syntaxes

1. **Option A (`<!--% ... -->`)**: Viable but the `%` feels arbitrary. Use if you prefer
   a single consistent prefix for all elements.

2. **Option D (Plain comments)**: Cleanest look but has false-positive risk. Use only
   if you're confident your documents won't contain conflicting comment patterns.

3. **HTML tag options (E, F)**: Not recommended due to CommonMark blank line requirements.

### Implementation Approaches (Not Recommended)

1. **Patch Markdoc**: Consider only if source mapping for errors becomes critical.

2. **Full rewrite**: Consider only if Markdoc becomes unmaintained or major new
   requirements arise that Markdoc can't support.

* * *

## Implementation Outline

### Phase 1: Preprocessor MVP

1. **Create `preprocessCommentSyntax(markdown: string): string`**

   - State machine to track: normal, fenced-code-block, inline-code

   - Transform `

<!--% ... -->

`→`{% ... %}`

- Handle self-closing: `

<!--% tag /-->

`→`{% tag /%}`

- Always runs (no opt-in)

2. **Update `parseForm()` to always preprocess**
   ```typescript
   export function parseForm(markdown: string): ParsedForm {
     // Always preprocess - both syntaxes supported transparently
     const content = preprocessCommentSyntax(markdown);
     const ast = Markdoc.parse(content);
     // ... rest unchanged
   }
   ```

3. **Track original syntax for serialization**

   - Detect which syntax was used (scan for `

<!--%`vs`{%`)

- Store in ParsedForm metadata

- Serialize back in same format by default

### Phase 2: Serialization Support

1. **Auto-detect and preserve syntax**

   - Check for `<!--%` presence to determine original syntax

   - Default: serialize back in the same syntax as input

   - API option to force specific syntax on output if needed

2. **Add reverse transform for comment syntax output**

   - Transform `{% ... %}` → `<!--% ... -->

` during serialization

- Preserves round-trip: parse comment → serialize comment

### Phase 3: Spec and Documentation Updates

1. **Update Markform Specification**

   - Document comment syntax as equivalent alternative

   - Clarify both syntaxes always supported

2. **Update Reference Documentation**

   - Show examples in both syntaxes

   - Explain GitHub rendering benefits

3. **Add CLI conversion utility** (optional convenience)

   - `markform convert --to-comments myform.form.md`

   - `markform convert --to-markdoc myform.form.md`

   - Not required for normal usage, just for bulk migration

* * *

## References

- [Markdoc Specification](https://markdoc.dev/spec) - Formal tag syntax grammar

- [Markdoc Overview](https://markdoc.dev/docs/overview) - Architecture and design

- [Markdoc FAQ](https://markdoc.dev/docs/faq) - Extension mechanisms

- [CommonMark Spec](https://spec.commonmark.org/0.31.2/) - HTML block rules

- [GitHub Markdown Docs](https://docs.github.com/github/writing-on-github) - Comment
  handling

- [markdown-it API](https://markdown-it.github.io/markdown-it/) - Tokenizer
  documentation

- [Markdoc GitHub Discussion #517](https://github.com/markdoc/markdoc/discussions/517) -
  Plugin usage

- [Stripe Markdoc Blog Post](https://stripe.com/blog/markdoc) - Design philosophy

- [frostming/marko#202](https://github.com/frostming/marko/issues/202) - CommonMark HTML
  block trailing text behavior

* * *

## Appendices

### Appendix A: Preprocessor State Machine Pseudocode

```typescript
enum State {
  NORMAL,
  FENCED_CODE,      // Inside ``` or ~~~
  INLINE_CODE,      // Inside `...`
}

function preprocessMarkform(input: string): string {
  let output = '';
  let state = State.NORMAL;
  let fenceChar = '';
  let fenceLength = 0;
  let i = 0;

  while (i < input.length) {
    switch (state) {
      case State.NORMAL:
        // Check for fence start (``` or ~~~)
        if (isAtLineStart(input, i)) {
          const fence = matchFence(input, i);
          if (fence) {
            state = State.FENCED_CODE;
            fenceChar = fence.char;
            fenceLength = fence.length;
            output += fence.match;
            i += fence.match.length;
            continue;
          }
        }
        // Check for inline code
        if (input[i] === '`') {
          const backticks = countBackticks(input, i);
          // Handle inline code span
          state = State.INLINE_CODE;
          // ... track backtick count for closing
        }
        // Check for

<!--% directive
        if (input.slice(i, i + 5) === '<!--%') {
          const end = input.indexOf('-->

', i + 5);
          if (end !== -1) {
            const interior = input.slice(i + 5, end).trim();
            // Transform to Markdoc syntax
            if (interior.endsWith('/')) {
              // Self-closing:

<!--% tag /-->

→ {% tag /%}
              output += '{% ' + interior.slice(0, -1).trim() + ' /%}';
            } else {
              output += '{% ' + interior + ' %}';
            }
            i = end + 3;
            continue;
          }
        }
        output += input[i];
        i++;
        break;

      case State.FENCED_CODE:
        // Check for fence close
        if (isAtLineStart(input, i) && matchClosingFence(input, i, fenceChar, fenceLength)) {
          state = State.NORMAL;
        }
        output += input[i];
        i++;
        break;

      case State.INLINE_CODE:
        // Check for closing backticks
        // ... handle inline code closing
        output += input[i];
        i++;
        break;
    }
  }
  return output;
}
```

### Appendix B: Example Conversions

#### Option C Syntax (Recommended)

**Original (Markdoc syntax)**:

```
{% form id="example" %}
{% group id="basics" %}

{% field kind="string" id="name" label="Name" required=true %}{% /field %}

{% field kind="single_select" id="rating" label="Rating" %}
- [ ] Good {% #good %}
- [ ] Bad {% #bad %}
{% /field %}

{% /group %}
{% /form %}
```

**Converted (Option C: `f:` namespace)**:

```
<!-- f:form id="example" -->
<!-- f:group id="basics" -->

<!-- f:field kind="string" id="name" label="Name" required=true --><!-- /f:field -->

<!-- f:field kind="single_select" id="rating" label="Rating" -->
- [ ] Good <!-- #good -->
- [ ] Bad <!-- #bad -->
<!-- /f:field -->

<!-- /f:group -->
<!-- /f:form -->
```

**GitHub Rendering**: All `<!-- f:... -->` and `<!-- #... -->` comments are hidden.
Only the checkboxes are visible:
- [ ] Good
- [ ] Bad

#### Option A Syntax (Alternative)

**Converted (Option A: `%` prefix)**:

```
<!--% form id="example" -->
<!--% group id="basics" -->

<!--% field kind="string" id="name" label="Name" required=true --><!--% /field -->

<!--% field kind="single_select" id="rating" label="Rating" -->
- [ ] Good <!--% #good -->
- [ ] Bad <!--% #bad -->
<!--% /field -->

<!--% /group -->
<!--% /form -->
```

Both syntaxes render identically on GitHub—all directives are hidden as HTML comments.
