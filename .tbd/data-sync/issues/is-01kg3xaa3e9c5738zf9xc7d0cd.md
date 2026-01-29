---
close_reason: null
closed_at: 2025-12-23T19:43:26.066Z
created_at: 2025-12-23T19:32:55.505Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.186Z
    original_id: markform-85
id: is-01kg3xaa3e9c5738zf9xc7d0cd
kind: bug
labels: []
parent_id: null
priority: 1
status: closed
title: "CLI serve: fix frozen form fields and use proper HTML form elements"
type: is
updated_at: 2025-12-23T19:43:26.066Z
version: 1
---
The serve command's web UI has critical usability issues that make it non-functional for editing:

**Issues identified:**

1. **Form fields appear frozen** - Users cannot enter values into any fields. The form renders but is not interactive/editable.

2. **Selection fields use text markers instead of HTML controls** - single_select and multi_select fields render as text like:
   ```
   ( ) Low
   ( ) Medium  
   ( ) High
   ```
   Instead of using proper HTML form elements.

**Expected behavior:**

1. All text fields (string, number, string_list) should be editable input elements
2. `single_select` should render as HTML `<select>` dropdown or radio buttons
3. `multi_select` should render as HTML checkboxes
4. `checkboxes` fields should render as HTML checkboxes with appropriate state markers
5. All field values should be captured and included when the Save button is clicked

**Files to investigate:**
- `src/web/server.ts` - HTML template generation
- `src/web/templates/` - if templates exist

**Reproduction:**
```bash
pnpm markform serve packages/markform/examples/simple/simple.form.md
# Open http://localhost:3000
# Try to edit any field - they appear frozen
```
