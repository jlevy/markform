---
close_reason: Added array coercion handling in normalizePatch() in apply.ts
closed_at: 2026-01-03T21:28:58.833Z
created_at: 2026-01-03T21:21:39.482Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.834Z
    original_id: markform-554
id: is-01kg3xaa3dsd1m6aqa8fzmpeta
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "[526-3] Implement array coercion in apply.ts"
type: is
updated_at: 2026-01-03T21:28:58.833Z
version: 1
---
Phase 2b: Add array coercion in normalizePatch()

- Add before existing boolean coercion
- Use createWarning() helper with 'array_to_checkboxes' type
- Handle empty array without warning
- Use mode-appropriate default state

Part of markform-550 implementation.
