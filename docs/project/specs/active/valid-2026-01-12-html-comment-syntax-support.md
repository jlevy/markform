# Feature Validation: HTML Comment Syntax Support

## Purpose

This validation spec documents the testing performed and manual validation needed for
the HTML comment syntax feature, which allows Markform forms to use HTML comment syntax
(`<!-- f:tag -->`) as an alternative to Markdoc tag syntax (`{% tag %}`).

**Feature Plan:** [plan-2026-01-12-html-comment-syntax-support.md](plan-2026-01-12-html-comment-syntax-support.md)

## Stage 4: Validation Stage

## Validation Planning

The implementation covers four phases:
1. **Phase 1**: Core preprocessor for parsing HTML comment syntax ✓ Complete
2. **Phase 2**: Serialization support for round-trip preservation ✓ Complete
3. **Phase 3**: Documentation updates ✓ Complete
4. **Phase 4**: CLI `--syntax` option for strict validation ✓ Complete

Phase 5 (Make HTML comment syntax primary in all docs/examples) is planned for future
work.

## Automated Validation (Testing Performed)

### Unit Testing

**Preprocessor Tests** (`tests/unit/engine/preprocess.test.ts` - 55 tests):
- Basic tag transformations (`<!-- f:tag -->` → `{% tag %}`)
- Closing tag transformations (`<!-- /f:tag -->` → `{% /tag %}`)
- Self-closing tag transformations (`<!-- f:tag /-->` → `{% tag /%}`)
- ID annotations (`<!-- #id -->` → `{% #id %}`)
- Class annotations (`<!-- .class -->` → `{% .class %}`)
- Fenced code block preservation (backticks and tildes)
- Inline code preservation
- 4-space indented code blocks (CommonMark spec compliance)
- Edge cases: empty input, no tags, mixed content
- Syntax detection (`detectSyntaxStyle()`)
- Syntax consistency validation (`validateSyntaxConsistency()`)
- Violation detection for "wrong" syntax patterns

**Serialization Tests** (`tests/unit/engine/serialize-comment.test.ts` - 30 tests):
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

**CLI Tryscript Tests** (`tests/cli/commands.tryscript.md` - 6 tests for --syntax):
- `--syntax=comments` passes for comment syntax file
- `--syntax=tags` passes for Markdoc syntax file
- `--syntax=comments` fails for Markdoc syntax file (correct detection)
- `--syntax=tags` fails for comment syntax file (correct detection)
- Invalid `--syntax` value shows error message
- `--syntax=comments` with `--format json` outputs violations

### Manual Testing Performed

All manual testing items have been verified during this merge:

#### 1. Comment Syntax Example Form ✓ Verified
```bash
node dist/bin.mjs validate examples/simple/simple-comment-syntax.form.md
```
**Result**: Form parses successfully with expected validation issues (empty required fields).

#### 2. Round-Trip Preservation ✓ Verified
```bash
node dist/bin.mjs export examples/simple/simple-comment-syntax.form.md --format=form
```
**Result**: Output contains `<!-- f:form` and `<!-- f:field` patterns, correctly preserving comment syntax.

#### 3. `--syntax` Enforcement ✓ Verified
```bash
# Should pass
node dist/bin.mjs validate examples/simple/simple-comment-syntax.form.md --syntax=comments
# Should fail with violations
node dist/bin.mjs validate examples/simple/simple.form.md --syntax=comments
```
**Result**: Correctly enforces syntax consistency.

### Remaining Manual Validation (For User)

#### 1. Verify GitHub Rendering

Open the example file on GitHub and verify the form tags are hidden:
- `packages/markform/examples/simple/simple-comment-syntax.form.md`

**Expected**: Only the checkbox lists and markdown content should be visible. The `<!-- f:... -->` tags should be completely hidden.

#### 2. Verify Documentation Updates

Review the updated documentation:
- `docs/markform-spec.md` - "Alternative Tag Syntax (HTML Comments)" section
- `docs/markform-reference.md` - Syntax table and example in Conventions section

**Expected**: Documentation is clear and accurate, includes syntax mapping table.

## Test Summary

| Test Category | Tests | Status |
|---------------|-------|--------|
| Preprocessor unit tests | 55 | ✓ Pass |
| Serialization unit tests | 30 | ✓ Pass |
| Parse integration tests | 10 | ✓ Pass |
| CLI tryscript tests (--syntax) | 6 | ✓ Pass |
| Golden/session tests | 26 | ✓ Pass |
| Full test suite | 1641 | ✓ Pass |

## Open Questions

None - all scope is clear and implementation matches the plan spec.
