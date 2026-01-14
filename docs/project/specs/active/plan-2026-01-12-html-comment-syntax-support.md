# Plan Spec: HTML Comment Syntax Support for Markform

## Purpose

This technical design document defines the implementation of HTML comment syntax
(`<!-- f:tag -->`) as the primary syntax for Markform. With this syntax, **Markform
files are completely valid Markdown** with form structure defined in readable HTML
comments. This enables forms to render cleanly on GitHub and in any Markdown editor,
while the Markdoc tag syntax (`{% ... %}`) remains fully supported as a secondary option.

**Dual Syntax Model:**

Markform supports both syntaxes through a **preprocessing step**: comment syntax is
transformed to Markdoc syntax before parsing, and optionally back during serialization.
Both syntaxes are always supported—no configuration required. However, **users are
encouraged to use only one syntax per file**, with HTML comment syntax recommended as
the default for new forms.

## Background

Markform currently uses Markdoc (`@markdoc/markdoc` v0.5.4) for parsing, which uses
Jinja-style tags (`{% tag %}`, `{% /tag %}`). While this syntax is powerful, it has
compatibility issues:

1. **GitHub rendering**: Markdoc tags render as visible text, cluttering document display
2. **Editor support**: Standard Markdown editors don't recognize Markdoc syntax
3. **Preview tools**: Markdown preview tools show raw tags instead of hiding them

The proposed solution is to support HTML comment-style syntax using an `f:` namespace
prefix (`<!-- f:tag -->`) that:
- Is valid HTML/Markdown and hidden by renderers
- Uses `f:` prefix for tags (semantically "form"), following WordPress Gutenberg's `wp:` pattern
- Uses plain annotations (`<!-- #id -->`, `<!-- .class -->`) without prefix (naturally distinctive)
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

1. **Preprocessor**: Transform `<!-- f:... -->` to `{% ... %}` before Markdoc parsing
2. **Syntax Detection**: Track which syntax the original document used
3. **Serialization**: Support outputting in either syntax (default: preserve original)
4. **Specification Update**: Document HTML comment syntax as equivalent alternative
5. **Documentation Update**: Show examples in both syntaxes throughout docs
6. **CLI Syntax Option**: Optional `--syntax` flag on output commands for format conversion

**Syntax Mapping (Option C - Namespace Prefix):**

| Markdoc Form | Comment Form | Notes |
| --- | --- | --- |
| `{% tag attr="val" %}` | `<!-- f:tag attr="val" -->` | Tags use `f:` prefix |
| `{% /tag %}` | `<!-- /f:tag -->` | Closing tags: slash before prefix |
| `{% tag /%}` | `<!-- f:tag /-->` | Self-closing: `/` before `-->` |
| `{% #id %}` | `<!-- #id -->` | Annotations: no prefix needed |
| `{% .class %}` | `<!-- .class -->` | Annotations: naturally distinctive |

**Why Option C over Option A (`<!--%`)**:
- `f:` is semantically meaningful ("form")
- Follows WordPress Gutenberg's established `wp:` pattern
- Annotations (`#id`, `.class`) look like CSS selectors—naturally distinctive
- Cleaner overall appearance

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
  - Mixed syntax within a file is supported but **not recommended**
  - Users are encouraged to use only one syntax per file
  - Round-trip: files preserve their original syntax by default
  - CLI `--syntax` option enables strict single-syntax enforcement

- **Database schemas**: N/A
  - No database component affected

## Stage 1: Planning Stage

### Feature Requirements

**Core Requirements:**

1. **Always-on preprocessing** - No configuration flags, CLI options, or opt-in required
2. **Transparent dual syntax** - Both `{% %}` and `<!-- f: -->` always work
3. **Preserve original syntax** - Serialization outputs in the same syntax as input
4. **Code block awareness** - Preprocessor must skip fenced code blocks and inline code
5. **Lossless round-trip** - parse → serialize produces equivalent document

**Acceptance Criteria:**

- [ ] Existing Markdoc syntax forms parse identically to before
- [ ] New comment syntax forms parse to identical AST as equivalent Markdoc forms
- [ ] Serializing a comment-syntax form produces comment-syntax output
- [ ] Serializing a Markdoc-syntax form produces Markdoc-syntax output
- [ ] Code blocks containing `<!-- f:` or `<!-- #` are not transformed
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
| Specification | Document comment syntax as primary | Remove Markdoc syntax support |
| Examples | Convert all examples to comment syntax | N/A |
| CLI | `--syntax` option for strict validation + output | Separate convert command |
| Tests | Unit + integration tests, both syntaxes | Performance benchmarks |
| README | Update intro, de-emphasize Markdoc | Remove Markdoc mentions entirely |

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
   - Transform tags: `<!-- f:tag -->` → `{% tag %}`
   - Transform closing: `<!-- /f:tag -->` → `{% /tag %}`
   - Handle self-closing: `<!-- f:tag /-->` → `{% tag /%}`
   - Transform annotations: `<!-- #id -->` → `{% #id %}`, `<!-- .class -->` → `{% .class %}`
   - Returns unchanged if no comment syntax found

2. **`detectSyntaxStyle(markdown: string): SyntaxStyle`**
   - Scan for first `<!-- f:` or `<!-- #` or `<!-- .` pattern (comment syntax)
   - Scan for first `{%` pattern (markdoc syntax)
   - Return `'comments'` or `'tags'`
   - Default to `'tags'` for empty/ambiguous documents

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
| `src/cli/commands/validate.ts` | MODIFY | Add `--syntax` output option |

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

### Phase 4: CLI Syntax Option (Optional)

Add `--syntax` option to validate command for syntax enforcement and format conversion.

**Design:**

The `--syntax` option serves two purposes:
1. **Strict validation**: When provided, validate enforces that the input file uses ONLY
   the specified syntax. Mixed syntax or the wrong syntax causes validation to fail.
2. **Format conversion**: When outputting, serializes in the specified syntax.

```bash
# Strict validation (fails if file contains Markdoc syntax)
markform validate myform.form.md --syntax=comments

# Strict validation (fails if file contains comment syntax)
markform validate myform.form.md --syntax=tags

# Permissive validation (accepts either/both syntaxes, default)
markform validate myform.form.md

# Convert Markdoc → comments (strict input, comment output)
markform validate myform.form.md --syntax=comments --output=converted.form.md
```

**Strict Mode Behavior:**

When `--syntax` is specified:
- Scan the document for syntax patterns (excluding code blocks)
- If `--syntax=comments`: fail if any `{% ... %}` patterns found
- If `--syntax=tags`: fail if any `<!-- f:... -->` or `<!-- #... -->` patterns found
- Error message should identify the line/pattern that violates the syntax constraint

**Rationale:**

While Markform accepts both syntaxes, **consistent syntax within a file** improves
readability and maintainability. The `--syntax` option enables:
- CI/linting enforcement of syntax consistency
- Style guide compliance checking
- Deliberate format migration with validation

**Tasks:**

- [x] Update `src/cli/commands/validate.ts`:
  - [x] Add `--syntax` option with values `'comments'` | `'tags'`
  - [x] Implement strict syntax validation when option provided
  - [x] Pass syntax style to `serializeForm()` when outputting
  - [x] Default (no option): permissive, preserve original syntax

- [x] Add `validateSyntaxConsistency()` helper function:
  - [x] Scan for patterns of the "wrong" syntax
  - [x] Return line numbers and patterns found
  - [x] Skip fenced code blocks and inline code spans

- [x] Add tryscript test for `--syntax` option (both success and failure cases)

### Testing Strategy

1. **Unit Tests**: Core preprocessor logic, edge cases
2. **Integration Tests**: End-to-end parsing and serialization
3. **Golden Tests**: Session replay with comment-syntax forms
4. **Tryscript Tests**: CLI convert command

### Rollout Plan

1. **Phase 1**: Core preprocessor (parsing works) ✓
2. **Phase 2**: Serialization (full round-trip) ✓
3. **Phase 3**: Documentation (users can adopt) ✓
4. **Phase 4**: CLI `--syntax` option (strict validation + conversion) ✓
5. **Phase 5**: Make HTML comment syntax primary (documentation & examples)

### Phase 5: Make HTML Comment Syntax Primary (Documentation & Examples)

Promote HTML comment syntax from "alternative" to "primary/recommended" syntax, with
Markdoc syntax documented as a secondary/legacy option. This improves GitHub rendering
and Markdown compatibility while maintaining full backward compatibility.

**Key Insight:** With HTML comment syntax, **Markform files are completely valid
Markdown**. The form structure is defined entirely in well-structured, readable HTML
comments that Markdown renderers naturally hide. Users see clean, readable documents
while the underlying structure remains machine-parseable.

**Rationale:**
- **Valid Markdown**: Comment syntax means `.form.md` files render perfectly everywhere
- **GitHub-friendly**: All form tags are hidden; users see only content and checkboxes
- **Editor-compatible**: Standard Markdown editors and preview tools work seamlessly
- **Semantic prefix**: The `f:` prefix is meaningful ("form"), following `wp:` pattern
- **Implementation detail**: Markdoc is under the hood—users don't need to know about it

**Scope of Changes:**

#### 5.1 Documentation Updates

**README.md:**
- [ ] Reframe introduction: "Markform is structured Markdown for forms" (not "Markdoc-based")
- [ ] Lead with HTML comment syntax examples in all code blocks
- [ ] Mention Markdoc only briefly: "Built on Markdoc for parsing"
- [ ] Update Quick Start example to use comment syntax
- [ ] Update any inline examples throughout

**docs/markform-spec.md:**
- [ ] Rename "Alternative Tag Syntax" → "Tag Syntax"
- [ ] Present HTML comment syntax FIRST as the primary syntax
- [ ] Move Markdoc syntax to a subsection: "Legacy Markdoc Syntax (Alternative)"
- [ ] Update all inline examples to use comment syntax
- [ ] Update Layer 1 introduction to not emphasize Markdoc
- [ ] Change: "Built on Markdoc's tag syntax" → "Uses Markdoc for parsing internally"
- [ ] Update "Structural Tags" section examples
- [ ] Update "Field Tags" section examples
- [ ] Update "Option Syntax" section examples
- [ ] Update Checkbox State Tokens examples

**docs/markform-reference.md:**
- [ ] Lead "File Structure" example with comment syntax
- [ ] Swap the syntax table order (comment syntax first, Markdoc second)
- [ ] Update "Field Kinds" examples to use comment syntax
- [ ] Update all code examples throughout

**docs/markform-apis.md:**
- [ ] Update any API examples that show form content

#### 5.2 Example Files Conversion

Convert all example `.form.md` files to use HTML comment syntax as primary:

**Primary examples (convert to comment syntax):**
- [ ] `examples/simple/simple.form.md`
- [ ] `examples/simple/simple-mock-filled.form.md`
- [ ] `examples/simple/simple-skipped-filled.form.md`
- [ ] `examples/startup-research/startup-research.form.md`
- [ ] `examples/startup-research/startup-research-mock-filled.form.md`
- [ ] `examples/movie-research/movie-research-demo.form.md`
- [ ] `examples/movie-research/movie-deep-research.form.md`
- [ ] `examples/movie-research/movie-deep-research-mock-filled.form.md`
- [ ] `examples/startup-deep-research/startup-deep-research.form.md`
- [ ] `examples/rejection-test/rejection-test.form.md`
- [ ] `examples/rejection-test/rejection-test-mock-filled.form.md`

**Keep as comment syntax variant:**
- [ ] `examples/simple/simple-comment-syntax.form.md` → rename to `simple-markdoc-syntax.form.md` (legacy example)

#### 5.3 Test Suite Updates

**Strategy:** Keep both syntaxes well-tested, but use comment syntax as primary in new tests.

**Unit tests to update (use comment syntax as primary):**
- [ ] `tests/unit/engine/parse.test.ts` - Add/update tests using comment syntax
- [ ] `tests/unit/engine/serialize.test.ts` - Ensure comment syntax examples
- [ ] `tests/unit/engine/apply.test.ts` - Update form fixtures

**Tests to keep as Markdoc (for backward compatibility coverage):**
- [ ] `tests/unit/engine/preprocess.test.ts` - Tests both syntaxes explicitly
- [ ] `tests/unit/engine/parse-comment.test.ts` - Tests comment syntax specifically
- [ ] `tests/unit/engine/serialize-comment.test.ts` - Tests round-trip

**Golden tests:**
- [ ] Regenerate golden tests after example conversion: `pnpm test:golden:regen`
- [ ] Session transcripts may need updates if forms changed

**Integration tests:**
- [ ] Review and update any test fixtures using Markdoc syntax

#### 5.4 Default Behavior Changes (Optional)

Consider whether to change default behaviors:

**Option A: Preserve current defaults (recommended for Phase 5)**
- `detectSyntaxStyle()` returns `'tags'` for ambiguous documents
- `serializeForm()` preserves original syntax (no change)
- CLI `--syntax` option defaults to preserving original
- Backward compatible, no surprises for existing users

**Option B: Change default to comment syntax (future consideration)**
- `detectSyntaxStyle()` could return `'comments'` for ambiguous documents
- New forms created by tools could default to comment syntax
- Breaking change for tooling that expects Markdoc output
- Defer to future version if needed

#### 5.5 File Inventory

**Files requiring content changes:**

| File | Type | Changes |
| --- | --- | --- |
| `README.md` | docs | Reframe intro, update examples |
| `docs/markform-spec.md` | spec | Major restructure of syntax section, all examples |
| `docs/markform-reference.md` | docs | Update examples, swap syntax order |
| `docs/markform-apis.md` | docs | Update any form examples |
| `examples/simple/*.form.md` (4 files) | examples | Convert to comment syntax |
| `examples/startup-research/*.form.md` (2 files) | examples | Convert to comment syntax |
| `examples/movie-research/*.form.md` (3 files) | examples | Convert to comment syntax |
| `examples/startup-deep-research/*.form.md` (1 file) | examples | Convert to comment syntax |
| `examples/rejection-test/*.form.md` (2 files) | examples | Convert to comment syntax |
| `tests/unit/engine/*.test.ts` (select files) | tests | Update primary examples |

**Files NOT requiring changes:**
- `src/engine/preprocess.ts` - Already handles both syntaxes
- `src/engine/serialize.ts` - Already outputs both syntaxes
- `src/engine/parse.ts` - No changes needed
- Type definitions - No changes needed

#### 5.6 Migration Checklist

**Pre-migration:**
- [ ] Run all tests to establish baseline: `pnpm test`
- [ ] Document current test count

**Migration:**
- [ ] Convert example files (can use CLI: `markform validate <file> --syntax=comments`)
- [ ] Update documentation
- [ ] Update test fixtures
- [ ] Regenerate golden tests

**Post-migration:**
- [ ] Run all tests: `pnpm test`
- [ ] Verify test count unchanged (or document new tests)
- [ ] Run `pnpm precommit`
- [ ] Manual review: check a few examples render correctly on GitHub

#### 5.7 Rollback Plan

If issues arise:
- All changes are documentation/example content only
- Git revert can undo changes
- Markdoc syntax continues to work (backward compatible)
- No code changes required for rollback

---

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

// Patterns to recognize:
// <!-- f:tagname ... -->     → {% tagname ... %}
// <!-- /f:tagname -->        → {% /tagname %}
// <!-- f:tagname ... /-->    → {% tagname ... /%}
// <!-- #id -->               → {% #id %}
// <!-- .class -->            → {% .class %}

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
        // Check for <!-- comment directive
        if (input.slice(i, i + 4) === '<!--') {
          const end = input.indexOf('-->', i + 4);
          if (end !== -1) {
            const interior = input.slice(i + 4, end).trim();

            // Check for f: namespace prefix (tags)
            if (interior.startsWith('f:')) {
              const tagContent = interior.slice(2); // Remove 'f:'
              if (tagContent.endsWith('/')) {
                // Self-closing: <!-- f:tag /--> → {% tag /%}
                output += '{% ' + tagContent.slice(0, -1).trim() + ' /%}';
              } else {
                output += '{% ' + tagContent + ' %}';
              }
              i = end + 3;
              continue;
            }

            // Check for /f: closing tag
            if (interior.startsWith('/f:')) {
              const tagName = interior.slice(3); // Remove '/f:'
              output += '{% /' + tagName + ' %}';
              i = end + 3;
              continue;
            }

            // Check for #id or .class annotations
            if (interior.startsWith('#') || interior.startsWith('.')) {
              output += '{% ' + interior + ' %}';
              i = end + 3;
              continue;
            }

            // Not a markform directive, pass through unchanged
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

**Converted (Option C - `f:` namespace prefix):**

```markdown
---
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
<!-- /f:form -->
```

**GitHub Rendering**: All `<!-- f:... -->` and `<!-- #... -->` comments are hidden.
Only the checkboxes are visible:
- [ ] Good
- [ ] Bad

**Key Syntax Differences from Option A (`<!--%`):**

| Aspect | Option A | Option C (Recommended) |
| --- | --- | --- |
| Tags | `<!--% field -->` | `<!-- f:field -->` |
| Closing | `<!--% /field -->` | `<!-- /f:field -->` |
| Annotations | `<!--% #id -->` | `<!-- #id -->` |
| Prefix style | `%` (arbitrary) | `f:` (semantic, like `wp:`) |

## References

- [Research Brief](../../research/current/research-html-comment-syntax-alternatives.md)
- [Markdoc Specification](https://markdoc.dev/spec)
- [CommonMark Spec](https://spec.commonmark.org/0.31.2/)
- [Current Parser Implementation](../../../../packages/markform/src/engine/parse.ts)
