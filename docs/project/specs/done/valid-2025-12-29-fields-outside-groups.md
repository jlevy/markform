# Bug Fix Validation: Fields Outside Field-Groups (markform-371)

## Purpose

This validation spec documents the testing and manual validation for the bug fix that
allows fields and documentation blocks (instructions/description/documentation) to work
correctly when placed outside of field-groups.

**Bug Reference:** markform-371

## Bug Summary

**Problem:** When a field (e.g., `string-field`) and its associated instructions block
were placed outside of a field-group (directly under the form tag), parsing failed with:
'instructions block references unknown ID'.

**Root Cause:** The parser only looked for fields inside field-group tags. Fields placed
directly under the form were never added to `idIndex`, causing doc block reference
validation to fail.

**Solution:** Modified the parser to also detect and process fields placed directly under
the form tag, storing them in an implicit field-group that serializes without wrapper
tags.

## Automated Validation (Testing Performed)

### Unit Testing

**Parse Tests** (`tests/unit/engine/parse.test.ts`):

- `parses field directly under form (outside field-group)` - Verifies ungrouped fields
  create an implicit group and are added to idIndex
- `allows instructions to reference ungrouped field` - Tests doc blocks can reference
  ungrouped fields
- `allows instructions before ungrouped field` - Tests ref resolution works regardless of
  order
- `parses multiple ungrouped fields` - Verifies multiple fields are collected correctly
- `handles mix of grouped and ungrouped fields` - Tests forms with both explicit and
  implicit groups
- `allows description and documentation blocks for ungrouped fields` - Tests all doc
  block types
- `parses ungrouped select field with options` - Tests option refs work for ungrouped
  select/checkbox fields

**Serialize Tests** (`tests/unit/engine/serialize.test.ts`):

- `serializes implicit group without field-group wrapper` - Verifies implicit groups
  don't get wrapper tags
- `round-trips form with ungrouped fields and instructions` - Tests parse → serialize →
  parse cycle
- `serializes mix of grouped and ungrouped fields correctly` - Verifies both group types
  serialize correctly

### Integration and End-to-End Testing

All existing golden tests and integration tests continue to pass (657 tests total),
confirming no regressions.

## Manual Testing Needed

### 1. CLI Inspect Command

Create a test form file with fields outside field-groups:

```bash
cat > /tmp/test-ungrouped.form.md << 'EOF'
---
markform:
  spec: MF/0.1
---

{% form id="test" title="Test Ungrouped Fields" %}

{% string-field id="movie" label="Favorite Movie" %}{% /string-field %}

{% instructions ref="movie" %}
Please enter your all-time favorite movie.
{% /instructions %}

{% /form %}
EOF

pnpm markform inspect /tmp/test-ungrouped.form.md
```

**Expected:** Command should complete without errors and show the form structure with the
field.

### 2. Round-Trip Serialization

Test that a form with ungrouped fields round-trips correctly:

```bash
# First inspect to verify it parses
pnpm markform inspect /tmp/test-ungrouped.form.md

# Then dump to see the serialized output
pnpm markform dump /tmp/test-ungrouped.form.md
```

**Expected:** The form should serialize without field-group wrapper tags around the
ungrouped field, preserving the original structure.

### 3. Mixed Grouped/Ungrouped Form

Create a more complex test with both grouped and ungrouped fields:

```bash
cat > /tmp/test-mixed.form.md << 'EOF'
---
markform:
  spec: MF/0.1
---

{% form id="survey" title="Mixed Survey" %}

{% string-field id="intro_note" label="Introduction Note" %}{% /string-field %}

{% field-group id="personal" title="Personal Info" %}
{% string-field id="name" label="Name" required=true %}{% /string-field %}
{% /field-group %}

{% instructions ref="intro_note" %}
This field is for any introductory notes.
{% /instructions %}

{% /form %}
EOF

pnpm markform inspect /tmp/test-mixed.form.md
```

**Expected:** Both the ungrouped field and the grouped field should parse correctly, with
instructions referencing the ungrouped field.
