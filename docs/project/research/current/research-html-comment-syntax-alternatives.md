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

This research brief explores the feasibility of using HTML comment-like syntax
(`<!--% ... -->`) as an alternative to Markdoc's Jinja-style tags (`{% ... %}`) for
Markform. The motivation is to improve compatibility with GitHub rendering, standard
Markdown editors, and other environments that don't handle Markdoc's custom tag syntax well.

The current Markform implementation uses Markdoc (`@markdoc/markdoc` v0.5.4), which:

- Parses Markdown via `markdown-it` as a tokenizer
- Uses a PEG.js grammar to parse the `{% %}` tag syntax
- Builds an AST that Markform traverses to extract form schema, values, and documentation

This research evaluates four main approaches to introduce an alternative syntax and analyzes
trade-offs for each. The recommended approach is an **always-on preprocessor** that
transparently supports both syntaxes with no configuration required.

**Research Questions**:

1. Is `<!--% ... -->` syntax feasible as a verbatim-transmappable alternative to Markdoc tags?

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
- Markform source code at [packages/markform/src/engine/parse.ts](../../../../packages/markform/src/engine/parse.ts)

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
- Values are stored inline within tag bodies using fenced code blocks with language `value`
- Selection fields (checkboxes, single_select, multi_select) use inline `[x]`/`[ ]` markers

**Key Insight**: Markform doesn't use Markdoc's transform or render phases—only parsing.
This means the implementation could potentially swap out the parser layer without affecting
higher-level functionality.

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

**Key Finding**: The `{% %}` delimiter recognition happens in the markdown-it plugin layer,
NOT in the PEG grammar. This is important—it means changing delimiters requires modifying
the tokenizer plugin, not just the grammar.

### 3. HTML Comment Syntax in CommonMark

**Status**: Complete

**Details**:

Per CommonMark specification:

- HTML comments use `<!-- comment content -->`
- They are type 2 HTML blocks when starting a line with `<!--`
- End condition: line containing `-->`
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

When an HTML comment's opening (`<!--`) and closing (`-->`) are on the **same line**, the
*entire line* becomes the HTML block body. This means:

```markdown
<!--% field id="x" --> Some trailing text
```

The text "Some trailing text" is captured as part of the HTML block body, **not** parsed as
Markdown. This is spec-compliant behavior per [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/#html-block).

However, content on **subsequent lines** is parsed normally:

```markdown
<!--% field id="x" -->
Some text on next line
```

Here "Some text on next line" is parsed as a separate Markdown paragraph.

**Mitigation**: For Markform, this is not a significant concern because:
1. Most directives are on their own lines
2. Inline annotations like `<!--% #id -->` at end of list items work correctly
3. The preprocessor transforms before CommonMark parsing

Reference: [frostming/marko#202](https://github.com/frostming/marko/issues/202) documents this
behavior and confirms spec compliance.

**Assessment**: HTML comments are well-suited for directive syntax. The `-->` constraint is
manageable with escaping or documenting as a limitation. The same-line trailing text behavior
is a minor edge case that doesn't affect typical Markform usage patterns.

### 4. Proposed Syntax Mapping

**Status**: Complete

**Details**:

Two viable mapping approaches:

**Option A: `<!--% ... -->` (Minimal)**

```markdown
<!--% form id="my_form" -->
<!--% group id="basics" -->
<!--% field kind="string" id="name" label="Name" --><!--% /field -->
<!--% /group -->
<!--% /form -->
```

Mapping:
- `{% tag %}` → `<!--% tag -->`
- `{% /tag %}` → `<!--% /tag -->`
- `{% tag /%}` → `<!--% tag /-->`

**Option B: `<!--{% ... %}-->` (Wrapper)**

```markdown
<!--{% form id="my_form" %}-->
<!--{% field kind="string" id="name" %}--><!--{% /field %}-->
<!--{% /form %}-->
```

This preserves literal Markdoc syntax inside the comment.

**Assessment**:

| Aspect | Option A | Option B |
| --- | --- | --- |
| Verbosity | Less verbose | More verbose |
| Editor recognition | None | Markdoc inside comment |
| Transmapping complexity | Medium | Low (just strip wrapper) |
| Self-closing handling | Needs `/--> ` convention | Uses `/%}` naturally |

**Recommendation**: Option B is cleaner for transmapping but more verbose.
Option A is more readable but requires new convention for self-closing.

* * *

## Comparative Analysis: Implementation Approaches

### Approach 1: Preprocessor (Recommended)

Transform `<!--% ... -->` → `{% ... %}` before passing to Markdoc. **Always enabled**
with no configuration needed.

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
  // Replace <!--% ... --> with {% ... %}
  // Handle self-closing: <!--% tag /--> → {% tag /%}
  // Returns unchanged if no comment syntax found
}
```

**Key Design Points**:
- Must correctly skip fenced code blocks (``` and ~~~)
- Must skip inline code spans
- Use simple state machine (not regex-only)
- **No flags needed**—`<!--%` prefix is unambiguous

**Assessment**: Best balance of effort vs. benefits. Backward compatible. Both
syntaxes always supported with zero configuration.

### Approach 2: Patch Markdoc's Tokenizer

Modify the markdown-it plugin to recognize `<!--% -->` in addition to `{% %}`.

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
3. Add regex for `<!--% ` opening and ` -->` closing
4. Ensure PEG parser receives same interior content

**Assessment**: Not recommended unless source mapping is critical. High maintenance cost.

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
2. Implement custom plugin for `<!--% -->` recognition
3. Build AST extraction logic (form, group, field, etc.)
4. Reimplement Markform's value extraction

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

**Assessment**: Major architectural change. Only consider if completely abandoning
Markdoc syntax is acceptable. Loses the community/tooling around Markdoc.

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
- Can optimize for Markform's specific needs
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
- Loses Markdoc's proven parsing

* * *

## Best Practices

1. **Prefer preprocessing for syntax flexibility**: Industry practice shows that
   preprocessing/transpilation is often the most maintainable approach for syntax
   variations (cf. JSX→JS, SCSS→CSS, TypeScript→JavaScript).

2. **Skip code blocks correctly**: Any preprocessor MUST implement proper code block
   detection to avoid transforming content inside examples or literal code.

3. **Document `-->` constraint**: If adopting HTML comments, document that values
   cannot contain the literal string `-->` without escaping.

4. **Support both syntaxes during transition**: Allow `{% %}` and `<!--% -->` to
   coexist for gradual migration.

5. **Keep Markform parser layer thin**: The current architecture where Markform only
   uses Markdoc's parse phase (not transform/render) should be preserved—it makes
   swapping parsing layers easier.

6. **Place comment directives on their own lines or at line end**: Due to CommonMark
   HTML block behavior, avoid placing text after `-->` on the same line. Either put
   the directive on its own line, or at the end of a line (like `<!--% #id -->` at
   the end of a list item). This ensures subsequent Markdown is parsed correctly.

* * *

## Open Research Questions

1. **Performance impact of preprocessing**: How does adding a preprocessing step
   affect parse performance for large forms? The preprocessor is simple string
   manipulation, likely negligible, but should verify with benchmarks.

2. **Error message quality**: How to provide good error messages that map back to
   original source when using preprocessing? Line numbers should be preserved since
   we only replace delimiters, not change line structure.

3. **Self-closing tag convention**: The proposed syntax is `<!--% tag /-->`. Is
   this sufficiently clear? Alternative considered: `<!--% tag /%-->` (closer to
   Markdoc's `/%}`). Current recommendation: `/--> ` for simplicity.

4. **Syntax detection for serialization**: When a document uses both syntaxes (or
   neither because it's empty), which should be used for output? Proposed: detect
   first directive found, default to Markdoc syntax if ambiguous.

5. **Tooling/editor support**: What's needed for syntax highlighting of the new
   format? The comment syntax is valid Markdown, so basic highlighting works.
   Enhanced highlighting for `<!--% %>` could be added to VSCode extensions.

* * *

## Recommendations

### Summary

**Recommended approach: Preprocessor (Approach 1) with Option A syntax (`<!--% ... -->`)**

This provides the best balance of:
- Minimal implementation effort
- Full backward compatibility with existing Markdoc syntax
- Always-on dual syntax support (no flags or configuration needed)
- Low maintenance burden
- GitHub rendering compatibility

### Recommended Approach

Implement a **Markdown-aware preprocessor** that is **always enabled**:

1. Transforms `<!--% ... -->` to `{% ... %}` before Markdoc.parse()
2. Correctly skips fenced code blocks and inline code
3. **Always supports both syntaxes in parallel** - no flags needed
4. Is implemented as a simple state machine (not regex-only)

**Key Design Decision**: The `<!--%` prefix is distinctive enough that it will never
conflict with regular HTML comments or existing Markdoc syntax. Therefore, the
preprocessor should **always be active** - no configuration flags, CLI options, or
opt-in required. This ensures:

- Existing Markform documents using `{% %}` continue to work unchanged
- New documents can use `<!--% -->` for GitHub compatibility
- Documents can mix both syntaxes if desired (though not recommended for clarity)

**Syntax Specification**:

| Markdoc Form | Comment Form |
| --- | --- |
| `{% tag attr="val" %}` | `<!--% tag attr="val" -->` |
| `{% /tag %}` | `<!--% /tag -->` |
| `{% tag /%}` | `<!--% tag /-->` |
| `{% #id %}` | `<!--% #id -->` |
| `{% .class %}` | `<!--% .class -->` |

**Rationale**:

- Minimal verbosity increase vs. Markdoc syntax
- Clear visual distinction from regular HTML comments (`<!--%` vs `<!--`)
- Consistent closing pattern
- Lossless round-trip conversion possible
- **No configuration burden** - just works

### Alternative Approaches (Not Recommended)

1. **Option B wrapper syntax** (`<!--{% %}-->`): More verbose but preserves literal
   Markdoc inside. Not recommended due to verbosity.

2. **Patch Markdoc**: Consider only if:
   - Source mapping for errors becomes critical
   - Performance of preprocessing is proven unacceptable
   - Long-term commitment to maintaining a fork is acceptable

3. **Full rewrite**: Consider only if:
   - Markdoc itself becomes unmaintained
   - Major new requirements arise that Markdoc can't support
   - Community moves to different standard

* * *

## Implementation Outline

### Phase 1: Preprocessor MVP

1. **Create `preprocessCommentSyntax(markdown: string): string`**
   - State machine to track: normal, fenced-code-block, inline-code
   - Transform `<!--% ... -->` → `{% ... %}`
   - Handle self-closing: `<!--% tag /-->` → `{% tag /%}`
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
   - Detect which syntax was used (scan for `<!--%` vs `{%`)
   - Store in ParsedForm metadata
   - Serialize back in same format by default

### Phase 2: Serialization Support

1. **Auto-detect and preserve syntax**
   - Check for `<!--%` presence to determine original syntax
   - Default: serialize back in the same syntax as input
   - API option to force specific syntax on output if needed

2. **Add reverse transform for comment syntax output**
   - Transform `{% ... %}` → `<!--% ... -->` during serialization
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
- [GitHub Markdown Docs](https://docs.github.com/github/writing-on-github) - Comment handling
- [markdown-it API](https://markdown-it.github.io/markdown-it/) - Tokenizer documentation
- [Markdoc GitHub Discussion #517](https://github.com/markdoc/markdoc/discussions/517) - Plugin usage
- [Stripe Markdoc Blog Post](https://stripe.com/blog/markdoc) - Design philosophy
- [frostming/marko#202](https://github.com/frostming/marko/issues/202) - CommonMark HTML block trailing text behavior

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
        // Check for <!--% directive
        if (input.slice(i, i + 5) === '<!--%') {
          const end = input.indexOf('-->', i + 5);
          if (end !== -1) {
            const interior = input.slice(i + 5, end).trim();
            // Transform to Markdoc syntax
            if (interior.endsWith('/')) {
              // Self-closing: <!--% tag /--> → {% tag /%}
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

### Appendix B: Example Conversion

**Original (Markdoc syntax)**:

```jinja
---
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
{% /form %}
```

**Converted (Comment syntax)**:

```markdown
---
markform:
  spec: MF/0.1
---
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

**GitHub Rendering**: The comment version renders as clean Markdown with the checklist
visible and all directives hidden.
