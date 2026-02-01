# Feature Validation: Implicit Checkboxes

## Purpose

This validation spec documents the testing performed for the Implicit Checkboxes feature
and the manual validation steps for final review.

**Feature Plan:** [plan-2026-01-23-implicit-checkboxes.md](./plan-2026-01-23-implicit-checkboxes.md)

## Validation Planning

This feature enables "plan documents" — markdown documents with checkboxes but without
explicit field wrappers — to be parsed as valid Markforms. It includes:

1. Implicit checkboxes field when form has no explicit field tags
2. `findAllHeadings()` and `findEnclosingHeadings()` utility functions
3. `findAllCheckboxes()` function with enclosing heading info
4. `injectCheckboxIds()` and `injectHeaderIds()` with uniqueness validation
5. Nested field validation (error on field tags inside other field tags)

## Automated Validation (Testing Performed)

### Unit Testing

All unit tests pass (1751 total tests).

**Markdown Headers Utility (`markdownHeaders.test.ts`):**
- `findAllHeadings()` basic parsing
- `findAllHeadings()` returns empty for headings in code blocks
- `findAllHeadings()` with ATX headings at all levels
- `findEnclosingHeadings()` returns innermost first
- `findEnclosingHeadings()` handles deeply nested sections
- Line positions for all heading levels

**Inject IDs (`injectIds.test.ts`):**
- `findAllCheckboxes()` basic discovery
- `findAllCheckboxes()` with enclosing headings
- `findAllCheckboxes()` all checkbox states
- `injectCheckboxIds()` with generator function
- `injectCheckboxIds()` onlyMissing mode
- `injectCheckboxIds()` throws on duplicate IDs
- `injectCheckboxIds()` throws on conflict with existing IDs
- `injectHeaderIds()` with generator function
- `injectHeaderIds()` level filtering
- `injectHeaderIds()` onlyMissing mode
- `injectHeaderIds()` throws on duplicate/conflicting IDs

**Parser (`parse.test.ts`):**
- Implicit checkboxes field created when no explicit fields
- Implicit field has correct ID `checkboxes`
- Implicit field has `checkboxMode: 'multi'` and `implicit: true`
- Reserved field ID `checkboxes` validation
- Nested field validation (field tags inside field tags produce error)
- Mixed mode error (checkboxes outside fields when explicit fields exist)
- Missing checkbox ID validation

### Integration and End-to-End Testing

**Golden Tests (`golden.test.ts`):**
- Plan document parsing (`plan-document.form.md`)
- Plan document with progress (`plan-document-progress.form.md`)
- Plan document with Markdoc syntax (`plan-document-markdoc.form.md`)
- Structured value export for plan documents
- `injectCheckboxIds()` with label-based generator
- `injectCheckboxIds()` with heading-prefixed generator
- `injectCheckboxIds()` preserves existing IDs
- `injectHeaderIds()` with slug generator
- `injectHeaderIds()` level filtering
- `injectHeaderIds()` preserves existing IDs
- `injectHeaderIds()` replaces all when `onlyMissing=false`

**ID Uniqueness Error Cases:**
- Duplicate generated ID errors with line numbers
- ID conflict errors with existing IDs
- Error messages include item labels
- Level filtering respects conflict checking

### Manual Testing Needed

The following manual validation steps confirm the feature works end-to-end:

#### 1. Parse a Plan Document

Create a test plan document and verify it parses correctly:

```bash
cat > /tmp/test-plan.md << 'EOF'
---
markform:
  spec: MF/0.1
---
{% form id="test_plan" title="Test Plan" %}

## Phase 1
- [ ] Task A {% #task_a %}
- [x] Task B {% #task_b %}

## Phase 2
- [/] Task C {% #task_c %}

{% /form %}
EOF

pnpm markform inspect /tmp/test-plan.md
```

**Expected:** Should show a form with:
- ID: `test_plan`
- One field: `checkboxes` (implicit)
- 3 options: `task_a`, `task_b`, `task_c`
- Checkbox states: unchecked, checked, partial

#### 2. Verify Error on Missing Checkbox ID

```bash
cat > /tmp/test-missing-id.md << 'EOF'
---
markform:
  spec: MF/0.1
---
{% form id="test" title="Test" %}
- [ ] Task without ID
{% /form %}
EOF

pnpm markform inspect /tmp/test-missing-id.md
```

**Expected:** Should produce error mentioning missing ID annotation.

#### 3. Verify API Exports

```bash
grep -E "findAllHeadings|findEnclosingHeadings|findAllCheckboxes|injectCheckboxIds|injectHeaderIds" packages/markform/src/index.ts
```

**Expected:** All five functions should be exported.

#### 4. Review Example Files

Check the example plan documents in the examples directory:

```bash
ls packages/markform/examples/plan-document*.md
```

Verify they demonstrate the implicit checkboxes syntax with:
- Form tag but no explicit field tags
- Checkboxes with ID annotations
- Section headings for organization

## Open Questions

None - all acceptance criteria from the plan spec have been met with automated tests.
