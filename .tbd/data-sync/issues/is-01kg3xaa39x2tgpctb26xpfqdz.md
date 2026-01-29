---
close_reason: null
closed_at: 2025-12-28T07:07:14.275Z
created_at: 2025-12-28T03:54:16.280Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.744Z
    original_id: markform-340
id: is-01kg3xaa39x2tgpctb26xpfqdz
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 3: Create renderYamlHtml() and renderJsonHtml() for syntax-highlighted views"
type: is
updated_at: 2025-12-28T07:07:14.275Z
version: 1
---
Add renderYamlHtml() and renderJsonHtml() to serve.ts:

Both functions should:
1. Read the raw file content
2. Apply syntax highlighting (CSS-based or Prism.js)
3. Display in a styled code block
4. Read-only, no editing functionality
5. Consistent styling with form UI

For YAML: use the yaml library to parse and pretty-print
For JSON: use JSON.stringify(JSON.parse(content), null, 2)

Location: packages/markform/src/cli/commands/serve.ts
