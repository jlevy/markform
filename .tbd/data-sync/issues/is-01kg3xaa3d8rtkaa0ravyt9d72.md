---
close_reason: Closed
closed_at: 2026-01-12T05:57:41.658Z
created_at: 2026-01-12T05:40:47.384Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.999Z
    original_id: markform-585
id: is-01kg3xaa3d8rtkaa0ravyt9d72
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Add unit tests for preprocess.ts
type: is
updated_at: 2026-01-12T05:57:41.658Z
version: 1
---
## Task
Create `tests/unit/engine/preprocess.test.ts`:

## Test Cases
- Basic transformation: `<!-- f:field -->` → `{% field %}`
- Closing tags: `<!-- /f:field -->` → `{% /field %}`
- Self-closing: `<!-- f:field /-->` → `{% field /%}`
- Annotations: `<!-- #id -->` → `{% #id %}`, `<!-- .class -->` → `{% .class %}`
- Code block skipping (fenced with ``` and ~~~)
- Inline code skipping
- No-op for Markdoc syntax (pass-through)
- Mixed syntax handling
- detectSyntaxStyle() returns correct style

## Files
- packages/markform/tests/unit/engine/preprocess.test.ts

## Depends On
- preprocess.ts implementation
