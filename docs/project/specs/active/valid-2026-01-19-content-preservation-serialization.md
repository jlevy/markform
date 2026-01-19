# Feature Validation: Content Preservation in Canonical Serialization

## Purpose

This validation spec documents the testing performed and remaining manual validation needed
to confirm the content preservation feature implementation is complete and adequate.

**Feature Plan:** [plan-2026-01-19-content-preservation-serialization.md](plan-2026-01-19-content-preservation-serialization.md)

## Feature Summary

The content preservation feature ensures that all markdown content outside Markform tags
is preserved through parse → serialize round-trips. This was required by the Markform
specification (MF/0.1) but was not implemented until now.

**Key Capabilities Implemented:**

1. **Raw source storage** - `rawSource` and `tagRegions` fields added to `ParsedForm`
2. **Splice-based serialization** - Preserves content outside form tags during round-trips
3. **preserveContent option** - Defaults to `true`, can be set to `false` for regeneration
4. **CLI --normalize flag** - Added to `apply`, `fill`, and `export` commands

## Stage 4: Validation Stage

## Automated Validation (Testing Performed)

### Unit Testing

**Test file:** `packages/markform/tests/unit/engine/serialize-preservation.test.ts`

All tests pass (17 tests, 1 skipped for future Phase 3 feature).

**Content preservation outside form tags:**

- ✅ Preserves markdown heading before form tag
- ✅ Preserves markdown content after form tag
- ✅ Preserves code blocks outside form tags
- ✅ Preserves lists outside form tags
- ✅ Preserves blockquotes outside form tags

**preserveContent option:**

- ✅ Regenerates from scratch when `preserveContent: false`
- ✅ Preserves content by default (`preserveContent` defaults to `true`)

**Value changes while preserving content:**

- ✅ Preserves outside content when field value changes

**Fallback behavior:**

- ✅ Regenerates from scratch when `rawSource` is undefined (programmatic forms)

**Round-trip stability:**

- ✅ Produces stable output after multiple round-trips

**Comment syntax preservation:**

- ✅ Preserves content with comment syntax forms (`<!-- form -->`)
- ✅ Comment syntax round-trip produces stable output

**Edge cases (Phase 4):**

- ✅ Preserves code blocks with various content (including form-like patterns)
- ✅ Preserves complex nested markdown (tables, images, links, nested lists)
- ✅ Handles multiple code blocks with different fence styles (backticks and tildes)
- ✅ Preserves HTML entities and special characters (emojis, unicode, `<>`)
- ✅ Preserves YAML-like content in regular markdown code blocks

**Skipped (deferred to future work):**

- ⏸️ Preserves markdown content between groups (inside form tag) - Phase 3 feature

### Golden Tests

**Existing golden tests continue passing:**

All 14 golden tests pass, validating that the serialization changes don't break existing
form handling.

### Integration and End-to-End Testing

**Total test suite:** 1707 tests pass (1 skipped)

The content preservation feature is exercised by:

- All parse → serialize round-trip flows in existing tests
- Golden form tests that validate form structure after serialization
- Session replay tests that serialize forms during agent fill operations

## Manual Testing Needed

The following manual validation steps should be performed by the reviewer:

### 1. Validate content preservation with a real form

Create or find a form with markdown content outside the form tags and verify preservation:

```bash
# Create a test file with content outside form tags
cat > /tmp/test-preservation.form.md << 'EOF'
---
markform:
  spec: MF/0.1
---

# My Important Document

This introduction should be preserved.

- Bullet point 1
- Bullet point 2

{% form id="example" %}
{% group id="main" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}

## Appendix

Footer content that should survive.
EOF

# Apply a patch and verify content is preserved
markform apply /tmp/test-preservation.form.md --patch '{"op":"set","fieldId":"name","value":"Test"}'
```

**Expected:** The output file should contain "# My Important Document", the bullet points, and "## Appendix" with footer content.

### 2. Validate --normalize flag functionality

```bash
# Using the same test file, apply with --normalize flag
markform apply /tmp/test-preservation.form.md --normalize --patch '{"op":"set","fieldId":"name","value":"Test"}'
```

**Expected:** The output should NOT contain the markdown title, bullet points, or appendix. Only the form structure should be present.

### 3. Validate CLI --normalize flag exists in help

```bash
markform apply --help | grep normalize
markform fill --help | grep normalize
markform export --help | grep normalize
```

**Expected:** Each command should show `--normalize` option with description "Regenerate form without preserving external content".

### 4. Validate comment syntax form preservation

```bash
# Create a comment-syntax form
cat > /tmp/test-comment.form.md << 'EOF'
---
markform:
  spec: MF/0.1
---

# Comment Syntax Form

Introduction text.

<!-- form id="test" -->
<!-- group id="g1" -->
<!-- field kind="string" id="name" label="Name" --><!-- /field -->
<!-- /group -->
<!-- /form -->

## Footer
EOF

# Parse and re-serialize
markform export /tmp/test-comment.form.md
```

**Expected:** The output should preserve "# Comment Syntax Form", "Introduction text.", and "## Footer" sections while maintaining comment syntax for Markform tags.

### 5. Verify round-trip stability

```bash
# Export form, then export the result again
markform export /tmp/test-preservation.form.md > /tmp/round1.form.md
markform export /tmp/round1.form.md > /tmp/round2.form.md
diff /tmp/round1.form.md /tmp/round2.form.md
```

**Expected:** No difference between round 1 and round 2 outputs (stable round-trip).

### 6. Validate existing example forms still work

```bash
# Run tests on example forms
cd packages/markform
npm test
```

**Expected:** All 1707 tests pass (1 skipped).

## Acceptance Criteria Verification

From the plan spec:

- [x] Markdown headings before form tag are preserved after round-trip
- [x] Markdown paragraphs between groups are preserved after round-trip (OUTSIDE form only - inside form deferred)
- [x] Code blocks outside form tags are preserved after round-trip
- [x] Lists and other markdown structures are preserved
- [x] Markform tags are serialized in canonical format
- [x] Round-trip produces parseable, valid Markform document
- [x] All existing tests continue passing
- [x] New tests verify content preservation
- [x] Golden tests validate round-trip fidelity

## Open Questions

None - all questions from the plan spec were resolved during implementation:

1. **Granularity**: Tag-level preservation implemented for content outside form tag
2. **Tag modifications**: Falls back to regeneration when structural changes detected
3. **Frontmatter**: Handled separately (recomputed on serialization)
4. **Doc block preservation**: Naturally preserved since regions are replaced with canonical serialization
5. **Programmatic forms**: Always regenerate when `rawSource` undefined
6. **CLI normalization**: `--normalize` flag added to `apply`, `fill`, `export` commands

## Future Work

The following was explicitly deferred:

- **Content preservation inside form (between groups)**: Currently only content outside the `{% form %}...{% /form %}` tags is preserved. Content between `{% group %}` tags inside the form is regenerated. This is tracked as Phase 3 in the plan spec and has a skipped test as a placeholder.
