---
close_reason: null
closed_at: 2025-12-28T07:07:14.275Z
created_at: 2025-12-28T03:54:22.560Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.604Z
    original_id: markform-341
id: is-01kg3x1bv7a2v585z8ph3sxpvb
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 3: Update handleRequest() to dispatch based on file type"
type: is
updated_at: 2025-12-28T07:07:14.275Z
version: 1
---
Update handleRequest() in serve.ts to dispatch to appropriate renderer:

- .form.md → renderFormHtml() (existing interactive form)
- .raw.md, .report.md, .md → renderMarkdownHtml() (read-only)
- .yml, .yaml → renderYamlHtml() (syntax-highlighted)
- .json → renderJsonHtml() (syntax-highlighted)
- unknown → error message or fallback

Disable /save endpoint for non-form files.

Location: packages/markform/src/cli/commands/serve.ts
