# Plan Spec: HTML Comment Syntax Support for Markform

## Purpose

This technical design document defines the implementation of HTML comment syntax
(`<!--% ... -->`) as an alternative to Markdoc's Jinja-style tags (`{% ... %}`). This
enables Markform files to render cleanly on GitHub and in standard Markdown editors while
maintaining full backward compatibility with existing Markdoc syntax.

## Background

Markform currently uses Markdoc (`@markdoc/markdoc` v0.5.4) for parsing, which uses
Jinja-style tags (`{% tag %}`, `{% /tag %}`). While this syntax is powerful, it has
compatibility issues:

1. **GitHub rendering**: Markdoc tags render as visible text, cluttering document display
2. **Editor support**: Standard Markdown editors don't recognize Markdoc syntax
3. **Preview tools**: Markdown preview tools show raw tags instead of hiding them

The proposed solution is to support HTML comment-style syntax (`<!--% tag -->`) that:
- Is valid HTML/Markdown and hidden by renderers
- Is visually distinct from regular HTML comments (`<!--%` vs `<!--`)
- Can coexist with Markdoc syntax (both always supported)

**Related Documentation:**
- [Research Brief](../../research/current/research-html-comment-syntax-alternatives.md)
- [Markform Specification](../../../markform-spec.md)
- [Markform Reference](../../../markform-reference.md)
- [Current Parser](../../../../packages/markform/src/engine/parse.ts)
- [Current Serializer](../../../../packages/markform/src/engine/serialize.ts)

## Summary of Task

Implement an **always-on preprocessor** that transparently supports both Markdoc and HTML
comment syntax with no configuration required:

1. **Preprocessor**: Transform `<!--% ... -->` to `{% ... %}` before Markdoc parsing
2. **Syntax Detection**: Track which syntax the original document used
3. **Serialization**: Support outputting in either syntax (default: preserve original)
4. **Specification Update**: Document HTML comment syntax as equivalent alternative
5. **Documentation Update**: Show examples in both syntaxes throughout docs
6. **CLI Conversion Utility**: Optional `markform convert` command for bulk migration

**Syntax Mapping:**

| Markdoc Form | Comment Form |
| --- | --- |
| `{% tag attr="val" %}` | `<!--% tag attr="val" -->` |
| `{% /tag %}` | `<!--% /tag -->` |
| `{% tag /%}` | `<!--% tag /-->` |
| `{% #id %}` | `<!--% #id -->` |
| `{% .class %}` | `<!--% .class -->` |

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN
  - Internal API changes don't need deprecation stubs
  - New `SyntaxStyle` type is additive, not breaking

- **Library APIs**: KEEP DEPRECATED for one release
  - `parseForm()` signature remains unchanged
  - `serializeForm()` gets new optional parameter, existing calls work unchanged
  - New `detectSyntaxStyle()` exported for advanced use cases

- **Server APIs**: N/A
  - No server component affected

- **File formats**: SUPPORT BOTH
  - Existing `.form.md` files with Markdoc syntax continue working unchanged
  - New files can use either syntax
  - Mixed syntax within a file is supported (not recommended)
  - Round-trip: files preserve their original syntax by default

- **Database schemas**: N/A
  - No database component affected

## Stage 1: Planning Stage

### Feature Requirements

**Core Requirements:**

1. **Always-on preprocessing** - No configuration flags, CLI options, or opt-in required
2. **Transparent dual syntax** - Both `{% %}` and `<!--% -->` always work
3. **Preserve original syntax** - Serialization outputs in the same syntax as input
4. **Code block awareness** - Preprocessor must skip fenced code blocks and inline code
5. **Lossless round-trip** - parse → serialize produces equivalent document

**Acceptance Criteria:**

- [ ] Existing Markdoc syntax forms parse identically to before
- [ ] New comment syntax forms parse to identical AST as equivalent Markdoc forms
- [ ] Serializing a comment-syntax form produces comment-syntax output
- [ ] Serializing a Markdoc-syntax form produces Markdoc-syntax output
- [ ] Code blocks containing `<!--%` are not transformed
- [ ] All existing tests continue passing
- [ ] New tests cover comment syntax parsing and serialization

**Out of Scope:**

- Performance benchmarks (preprocessor is simple string manipulation)
- Source mapping for error messages (line numbers unchanged)
- VSCode extension for syntax highlighting (valid Markdown works already)
- Multi-file document support

### Feature Scope

| Area | In Scope | Out of Scope |
| --- | --- | --- |
| Parsing | Preprocess comment → Markdoc | Custom parser/fork Markdoc |
| Serialization | Output in detected syntax | Force syntax via config flag |
| Specification | Document as equivalent syntax | Define as primary/preferred |
| Examples | Update 2-3 key examples | Convert all examples |
| CLI | Optional `convert` command | Interactive converter |
| Tests | Unit + integration tests | Performance benchmarks |

## Stage 2: Architecture Stage

### Current Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌────────────────┐
│  .form.md   │ ──▶  │  Markdoc.parse() │ ──▶  │  ParsedForm    │
│  (Markdoc)  │      │                  │      │                │
└─────────────┘      └──────────────────┘      └────────────────┘
                                                       │
                                                       ▼
                     ┌──────────────────┐      ┌────────────────┐
                     │ serializeForm()  │ ◀──  │  Form State    │
                     │                  │      │                │
                     └──────────────────┘      └────────────────┘
                             │
                             ▼
                     ┌─────────────┐
                     │  .form.md   │
                     │  (Markdoc)  │
                     └─────────────┘
```

### Proposed Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  .form.md   │ ──▶  │ preprocessSyntax │ ──▶  │  Markdoc.parse() │
│ (Either)    │      │                  │      │                  │
└─────────────┘      └──────────────────┘      └──────────────────┘
       │                     │                         │
       │                     ▼                         ▼
       │             ┌──────────────────┐      ┌────────────────┐
       │             │  SyntaxStyle     │      │  ParsedForm    │
       │             │ "markdoc"|"html" │      │ +syntaxStyle   │
       │             └──────────────────┘      └────────────────┘
       │                                               │
       │                                               ▼
       │             ┌──────────────────┐      ┌────────────────┐
       │             │ serializeForm()  │ ◀──  │  Form State    │
       │             │ +syntaxStyle opt │      │                │
       │             └──────────────────┘      └────────────────┘
       │                     │
       │                     ▼
       │             ┌─────────────┐
       └────────────▶│  .form.md   │  (Same syntax as input)
                     │  (Either)   │
                     └─────────────┘
```

### Key Components

1. **`preprocessCommentSyntax(markdown: string): string`**
   - State machine to track: normal, fenced-code-block, inline-code
   - Transform `<!--% ... -->` → `{% ... %}`
   - Handle self-closing: `<!--% tag /-->` → `{% tag /%}`
   - Returns unchanged if no comment syntax found

2. **`detectSyntaxStyle(markdown: string): SyntaxStyle`**
   - Scan for first `<!--%` or `{%` pattern
   - Return `'html-comment'` or `'markdoc'`
   - Default to `'markdoc'` for empty/ambiguous documents

3. **Updated `parseForm()`**
   - Call `preprocessCommentSyntax()` before `Markdoc.parse()`
   - Store detected syntax style in ParsedForm metadata

4. **Updated `serializeForm()`**
   - New optional parameter to force syntax style
   - Default: use syntax style from ParsedForm metadata
   - Fallback to Markdoc syntax if not detected

### File Changes Summary

| File | Change Type | Description |
| --- | --- | --- |
| `src/engine/preprocess.ts` | NEW | Preprocessor + syntax detection |
| `src/engine/parse.ts` | MODIFY | Call preprocessor, store syntax style |
| `src/engine/serialize.ts` | MODIFY | Output in detected/specified syntax |
| `src/engine/coreTypes.ts` | MODIFY | Add SyntaxStyle type, extend metadata |
| `tests/unit/engine/preprocess.test.ts` | NEW | Preprocessor unit tests |
| `tests/unit/engine/parse-comment.test.ts` | NEW | Comment syntax parsing tests |
| `tests/unit/engine/serialize-comment.test.ts` | NEW | Comment syntax serialization tests |
| `docs/markform-spec.md` | MODIFY | Document alternative syntax |
| `docs/markform-reference.md` | MODIFY | Add comment syntax examples |
| `src/cli/commands/convert.ts` | NEW | Optional convert command |

## Stage 3: Refine Architecture

### Reusable Components Found

1. **State machine pattern**: Similar to `pickFence()` in serialize.ts for code block detection
2. **YAML library**: Already using for frontmatter, no new dependencies needed
3. **Test patterns**: Existing parse.test.ts and serialize.test.ts patterns to follow

### Performance Considerations

- Preprocessor is O(n) single-pass string manipulation
- No regex backtracking risk (simple pattern matching)
- Memory: single string allocation for output
- Expected overhead: <1ms for typical forms

### Simplifications Made

1. **No configuration flags** - Always-on is simpler than conditional
2. **No source mapping** - Line numbers unchanged after preprocessing
3. **No mixed-syntax warning** - Valid use case, just not recommended
4. **Syntax detection via scan** - Simpler than AST-based detection

## Stage 4: Implementation Plan

### Phase 1: Core Preprocessor

Implement the preprocessor and integrate with parsing.

**Tasks:**

- [ ] Create `src/engine/preprocess.ts` with:
  - [ ] `SyntaxStyle` type definition
  - [ ] `preprocessCommentSyntax()` function
  - [ ] `detectSyntaxStyle()` function
  - [ ] State machine for code block detection

- [ ] Update `src/engine/coreTypes.ts`:
  - [ ] Add `SyntaxStyle` to types
  - [ ] Add `syntaxStyle?: SyntaxStyle` to `ParsedForm`

- [ ] Update `src/engine/parse.ts`:
  - [ ] Import and call preprocessor before Markdoc.parse()
  - [ ] Store detected syntax style in result

- [ ] Create `tests/unit/engine/preprocess.test.ts`:
  - [ ] Test basic transformation
  - [ ] Test self-closing tag handling
  - [ ] Test code block skipping (fenced with ``` and ~~~)
  - [ ] Test inline code skipping
  - [ ] Test no-op for Markdoc syntax
  - [ ] Test mixed syntax handling

- [ ] Create `tests/unit/engine/parse-comment.test.ts`:
  - [ ] Test parsing comment-syntax forms
  - [ ] Test syntax style detection
  - [ ] Verify identical AST for equivalent Markdoc/comment forms

### Phase 2: Serialization Support

Add support for serializing in comment syntax.

**Tasks:**

- [ ] Update `src/engine/serialize.ts`:
  - [ ] Add `postprocessToCommentSyntax()` function
  - [ ] Update `serializeForm()` to accept syntax style option
  - [ ] Default to ParsedForm's detected syntax style
  - [ ] Transform output for comment syntax

- [ ] Create `tests/unit/engine/serialize-comment.test.ts`:
  - [ ] Test serialization in comment syntax
  - [ ] Test round-trip: comment → parse → serialize → same comment
  - [ ] Test round-trip: markdoc → parse → serialize → same markdoc
  - [ ] Test forced syntax override

### Phase 3: Documentation Updates

Update specification and reference documentation.

**Tasks:**

- [ ] Update `docs/markform-spec.md`:
  - [ ] Add "Alternative Tag Syntax" section to Layer 1
  - [ ] Document syntax mapping table
  - [ ] Explain always-on behavior
  - [ ] Document `-->` constraint in values

- [ ] Update `docs/markform-reference.md`:
  - [ ] Add syntax note in File Structure section
  - [ ] Add example showing comment syntax
  - [ ] Update "Conventions" section

- [ ] Update `packages/markform/examples/simple/simple.form.md`:
  - [ ] Create comment-syntax variant for comparison

### Phase 4: CLI Conversion Utility (Optional)

Add optional CLI command for bulk conversion.

**Tasks:**

- [ ] Create `src/cli/commands/convert.ts`:
  - [ ] Implement `markform convert` command
  - [ ] `--to-comments` flag for Markdoc → comments
  - [ ] `--to-markdoc` flag for comments → Markdoc
  - [ ] `--dry-run` flag for preview
  - [ ] Support stdin/stdout and file paths

- [ ] Update CLI index to register command

- [ ] Add tryscript test for convert command

### Testing Strategy

1. **Unit Tests**: Core preprocessor logic, edge cases
2. **Integration Tests**: End-to-end parsing and serialization
3. **Golden Tests**: Session replay with comment-syntax forms
4. **Tryscript Tests**: CLI convert command

### Rollout Plan

1. **Phase 1**: Core preprocessor (parsing works)
2. **Phase 2**: Serialization (full round-trip)
3. **Phase 3**: Documentation (users can adopt)
4. **Phase 4**: CLI utility (bulk migration tool)

## Stage 5: Implementation Checklist

### Pre-Implementation

- [ ] Verify no breaking changes to existing tests
- [ ] Run `pnpm precommit` baseline

### Implementation

- [ ] Complete Phase 1: Core Preprocessor
- [ ] Run tests: `pnpm test`
- [ ] Complete Phase 2: Serialization Support
- [ ] Run tests: `pnpm test`
- [ ] Complete Phase 3: Documentation Updates
- [ ] Complete Phase 4: CLI Conversion (if time permits)

### Post-Implementation

- [ ] Run full precommit: `pnpm precommit`
- [ ] Update golden tests if needed: `pnpm test:golden:regen`
- [ ] Update tryscript tests if needed: `pnpm test:tryscript:update`
- [ ] Review coverage report for new code

## Appendix A: Preprocessor State Machine Pseudocode

```typescript
enum State {
  NORMAL,
  FENCED_CODE,      // Inside ``` or ~~~
  INLINE_CODE,      // Inside `...`
}

function preprocessCommentSyntax(input: string): string {
  let output = '';
  let state = State.NORMAL;
  let fenceChar = '';
  let fenceLength = 0;
  let i = 0;

  while (i < input.length) {
    switch (state) {
      case State.NORMAL:
        // Check for fence start (``` or ~~~) at line start
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
          const end = findClosingBacktick(input, i);
          if (end !== -1) {
            output += input.slice(i, end + 1);
            i = end + 1;
            continue;
          }
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
    }
  }
  return output;
}
```

## Appendix B: Example Conversion

**Original (Markdoc syntax):**

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

**Converted (Comment syntax):**

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

## References

- [Research Brief](../../research/current/research-html-comment-syntax-alternatives.md)
- [Markdoc Specification](https://markdoc.dev/spec)
- [CommonMark Spec](https://spec.commonmark.org/0.31.2/)
- [Current Parser Implementation](../../../../packages/markform/src/engine/parse.ts)
