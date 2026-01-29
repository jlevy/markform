---
close_reason: Implemented in commit 28b947a
closed_at: 2026-01-12T06:33:10.924Z
created_at: 2026-01-12T05:41:12.884Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.011Z
    original_id: markform-587
id: is-01kg3xaa3d3gcbqc1jchkxn9mk
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Add postprocessToCommentSyntax() to serialize.ts
type: is
updated_at: 2026-01-12T06:33:10.924Z
version: 1
---
## Task
Update `src/engine/serialize.ts`:
- Add `postprocessToCommentSyntax(markdown: string): string` function
- Transforms Markdoc syntax back to comment syntax
- `{% tag ... %}` → `<!-- f:tag ... -->`
- `{% /tag %}` → `<!-- /f:tag -->`
- `{% tag /%}` → `<!-- f:tag /-->`
- `{% #id %}` → `<!-- #id -->`
- `{% .class %}` → `<!-- .class -->`

## Files
- packages/markform/src/engine/serialize.ts

## Depends On
- Phase 1 complete (parsing works)
