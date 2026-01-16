# Feature Validation: HTML Comment Syntax Support

## Purpose

This validation spec documents the testing performed and manual validation needed for
the HTML comment syntax feature, which allows Markform forms to use HTML comment syntax
(`<!-- f:tag -->`) as an alternative to Markdoc tag syntax (`{% tag %}`).

**Feature Plan:** [plan-2026-01-12-html-comment-syntax-support.md](plan-2026-01-12-html-comment-syntax-support.md)

## Stage 4: Validation Stage

## Validation Planning

The implementation covers three phases:
1. **Phase 1**: Core preprocessor for parsing HTML comment syntax
2. **Phase 2**: Serialization support for round-trip preservation
3. **Phase 3**: Documentation updates

Phase 4 (CLI `--syntax` option) is optional and not implemented in this PR.

## Automated Validation (Testing Performed)

### Unit Testing

**Preprocessor Tests** (`tests/unit/engine/preprocess.test.ts` - 34 tests):
- Basic tag transformations (`<!-- f:tag -->` → `{% tag %}`)
- Closing tag transformations (`<!-- /f:tag -->` → `{% /tag %}`)
- Self-closing tag transformations (`<!-- f:tag /-->` → `{% tag /%}`)
- ID annotations (`<!-- #id -->` → `{% #id %}`)
- Class annotations (`<!-- .class -->` → `{% .class %}`)
- Fenced code block preservation (backticks and tildes)
- Inline code preservation
- 4-space indented code blocks (CommonMark spec compliance)
- Edge cases: empty input, no tags, mixed content

**Serialization Tests** (`tests/unit/engine/serialize-comment.test.ts` - 25 tests):
- `postprocessToCommentSyntax()` transformations
- `serializeForm()` syntax style preservation
- Explicit syntax style override via options
- Round-trip preservation (comment → parse → serialize → comment)
- Complex forms with all field types
- Forms with filled values
- Notes and documentation blocks
- Code blocks containing comment-like text

**Parse Integration Tests** (`tests/unit/engine/parse-comment.test.ts` - 10 tests):
- Basic form parsing with HTML comment syntax
- Syntax style detection
- Single-select with #id annotations
- Checkboxes with .class annotations
- AST equivalence between Markdoc and comment syntax
- Complex forms with all field types
- Notes and documentation blocks
- Forms with values
- Mixed regular comments and form directives
- Code block content preservation

### Integration and End-to-End Testing

**CLI Examples Tests** (`tests/unit/cli/examples.test.ts` - 19 tests):
- Validates that `simple-comment-syntax.form.md` parses correctly
- Included in the examples validation suite

**Golden Tests** (`tests/golden/golden.test.ts` - 14 tests):
- Existing golden tests continue to pass
- Ensures no regression in Markdoc syntax handling

### Manual Testing Needed

#### 1. Verify Comment Syntax Example Form

```bash
# Parse and validate the comment-syntax example form
cd packages/markform
npx markform validate examples/simple/simple-comment-syntax.form.md
```

**Expected**: Form parses successfully with no errors.

#### 2. Verify Round-Trip Preservation

```bash
# Parse a comment-syntax form and re-serialize it
npx markform validate examples/simple/simple-comment-syntax.form.md --output /tmp/roundtrip.form.md

# Compare - should use comment syntax, not Markdoc syntax
head -30 /tmp/roundtrip.form.md
```

**Expected**: Output should contain `<!-- f:form` and `<!-- f:field` patterns, NOT `{% form` or `{% field`.

#### 3. Verify GitHub Rendering

Open the example file on GitHub and verify the form tags are hidden:
- `packages/markform/examples/simple/simple-comment-syntax.form.md`

**Expected**: Only the checkbox lists and markdown content should be visible. The `<!-- f:... -->` tags should be completely hidden.

#### 4. Verify Documentation Updates

Review the updated documentation:
- `docs/markform-spec.md` - "Alternative Tag Syntax (HTML Comments)" section
- `docs/markform-reference.md` - Syntax table and example in Conventions section

**Expected**: Documentation is clear and accurate, includes syntax mapping table.

## Open Questions

None - all scope is clear and implementation matches the plan spec.
