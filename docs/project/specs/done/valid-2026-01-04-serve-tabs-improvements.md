# Feature Validation: Serve Command Tabs Improvements

## Purpose

This validation spec documents the validation performed and remaining manual validation needed
for the serve command tabs improvements feature.

**Feature Plan:** plan-2026-01-04-serve-tabs-improvements.md

## Validation Planning

### Summary of Changes

1. **View Tab (new)**: Read-only display of form with all fields visible
2. **Edit Tab (renamed from "Markform")**: Interactive form editor
3. **Source Tab (new)**: Syntax-highlighted Markdown/Jinja source
4. **Report Tab (fixed)**: Improved HTML rendering with proper list containers
5. **Tab Order**: View, Edit, Source, Report, Values, Schema

## Automated Validation (Testing Performed)

### Unit Testing

All serve-render tests updated and passing (109 tests in `serve-render.test.ts`):

- **Tab bar rendering tests**: Updated to test new tab order (View, Edit, Source)
- **renderViewContent tests** (new):
  - Wraps content in view-content div
  - Renders groups with titles
  - Renders fields with labels and type badges
  - Shows required indicator for required fields
  - Shows "(not filled)" for empty fields
  - Shows actual values for filled fields
  - Shows "(skipped)" for skipped fields
  - Renders single_select with selected option label
  - Renders url fields as clickable links
- **renderSourceContent tests** (new):
  - Wraps content in pre tag
  - Highlights Jinja tags ({% ... %})
  - Highlights Jinja attributes
  - Highlights Jinja attribute values
  - Highlights Jinja comments ({# ... #})
  - Highlights Markdown headers
  - Highlights YAML frontmatter markers
  - Escapes HTML in source content
- **renderMarkdownContent list rendering tests** (new):
  - Wraps unordered list items in ul tag
  - Wraps ordered list items in ol tag
  - Closes list when transitioning to paragraph
  - Handles mixed list types
- **CSS style tests**: Updated to verify Jinja and View tab styles are present

### Integration and End-to-End Testing

All 1454 tests pass including:
- Golden tests
- Integration tests
- Session replay tests

Build and lint checks pass:
```bash
pnpm precommit  # format, lint, typecheck, test all pass
```

## Manual Testing Needed

### 1. View Tab Verification

Start the serve command with an example form:
```bash
pnpm markform serve packages/markform/examples/simple/simple-mock-filled.form.md
```

Verify:
- [ ] View tab is the default active tab on page load
- [ ] View tab shows all field groups with titles
- [ ] Each field displays label, type badge, and value
- [ ] Filled fields show their values correctly
- [ ] Empty fields show "(not filled)" indicator
- [ ] Skipped fields show "(skipped)" indicator with badge
- [ ] Required fields have asterisk indicator
- [ ] URL fields are rendered as clickable links

### 2. Edit Tab Verification

Click the "Edit" tab and verify:
- [ ] Tab is now labeled "Edit" (not "Markform")
- [ ] Form is interactive with input fields
- [ ] All field types render correctly
- [ ] Skip buttons work for optional fields
- [ ] Save button submits the form

### 3. Source Tab Verification

Click the "Source" tab and verify:
- [ ] Raw form source is displayed in a pre block
- [ ] Jinja tags ({% ... %}) are highlighted in purple
- [ ] Jinja keywords (form, field, group) are highlighted in red
- [ ] Jinja attributes (id, kind, label) are highlighted in blue
- [ ] Jinja attribute values are highlighted in green
- [ ] Jinja comments ({# ... #}) are highlighted as comments
- [ ] Markdown headers are highlighted
- [ ] YAML frontmatter markers (---) are highlighted as comments

### 4. Report Tab Verification

Test with a form that has a report file:
```bash
pnpm markform serve packages/markform/examples/simple/simple-mock-filled.form.md
```

Click the "Report" tab and verify:
- [ ] Report content is properly rendered
- [ ] Lists (unordered and ordered) are properly contained in ul/ol tags
- [ ] Headers, paragraphs render correctly
- [ ] Inline formatting (bold, italic, code) works

### 5. Tab Order Verification

Verify tabs appear in this order across the top:
- [ ] View
- [ ] Edit
- [ ] Source
- [ ] Report (if report file exists)
- [ ] Values (if values file exists)
- [ ] Schema (if schema file exists)

### 6. Tab Switching

Verify smooth tab switching:
- [ ] Clicking each tab shows the correct content
- [ ] Tab content is cached (switching back doesn't reload)
- [ ] Active tab is visually highlighted

## Open Questions

None at this time.
