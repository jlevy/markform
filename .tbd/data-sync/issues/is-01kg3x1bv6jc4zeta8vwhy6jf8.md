---
close_reason: null
closed_at: 2025-12-28T07:07:14.275Z
created_at: 2025-12-28T03:54:10.134Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.593Z
    original_id: markform-339
id: is-01kg3x1bv6jc4zeta8vwhy6jf8
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 3: Create renderMarkdownHtml() for read-only markdown view"
type: is
updated_at: 2025-12-28T07:07:14.275Z
version: 1
---
Add renderMarkdownHtml() to serve.ts:

Function should:
1. Convert markdown to HTML using a markdown parser (marked or similar)
2. Use clean, readable styling consistent with form UI
3. No form inputs or save functionality (read-only)
4. Include basic navigation (back, reload)

Used for: .raw.md, .report.md, and generic .md files

Location: packages/markform/src/cli/commands/serve.ts
