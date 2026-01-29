---
close_reason: null
closed_at: 2025-12-23T15:02:24.951Z
created_at: 2025-12-23T07:19:40.796Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.125Z
    original_id: markform-7mt
id: is-01kg3xaa3e3h3rv4mge8me4s2n
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: 1.2 Markdoc Parsing (engine/parse.ts)
type: is
updated_at: 2025-12-23T15:03:22.036Z
version: 1
---
Implement parseForm(markdown: string): ParsedForm
- Frontmatter extraction and parsing
- AST traversal for form/group/field tags
- Option extraction from list items
- Value extraction from fence nodes
- Documentation block extraction
- Semantic validation (ID uniqueness, refs, etc.)
- Build orderIndex and idIndex
- Unit tests for all field types and edge cases
