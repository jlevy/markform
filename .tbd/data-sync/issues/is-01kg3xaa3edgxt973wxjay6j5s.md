---
close_reason: null
closed_at: 2025-12-23T19:51:06.647Z
created_at: 2025-12-23T19:43:26.604Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.201Z
    original_id: markform-88
id: is-01kg3xaa3edgxt973wxjay6j5s
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: Add render command for static HTML output
type: is
updated_at: 2025-12-23T19:51:06.647Z
version: 1
---
Add a `render` command that generates static HTML output (same rendering as serve command but without the server).

**Default behavior:**
- Renders the form to HTML and writes to a file with the same stem + .html extension
- Example: `markform render sample.form.md` → writes `sample.form.html`

**Options:**
- `--output <path>` or `-o <path>`: Override output filename

**Implementation notes:**
- Reuse `renderFormHtml()` from serve.ts (already exported)
- Write the complete HTML document to the output file
- Update architecture docs to document this command
- **Important:** Serve and render commands MUST share the same rendering logic

**Testing (TDD required):**
- Add tests that use the render command to generate HTML output
- Test that HTML output matches expected structure
- These tests can exercise the HTML rendering more easily than curl-based serve tests
- Tests should verify all field types render correctly

**Example usage:**
```bash
# Default: outputs sample.form.html
markform render sample.form.md

# Custom output path
markform render sample.form.md --output /path/to/output.html
```
