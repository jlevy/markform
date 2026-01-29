---
close_reason: Added tests for array-to-checkboxes coercion in both valueCoercion.test.ts and apply.test.ts
closed_at: 2026-01-03T21:32:38.613Z
created_at: 2026-01-03T21:21:51.963Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.839Z
    original_id: markform-555
id: is-01kg3xaa3d1bwjvyvykt774an0
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "[526-4] Add tests for array-to-checkboxes coercion"
type: is
updated_at: 2026-01-03T21:32:38.613Z
version: 1
---
Phase 4: Add tests for array coercion

- Update apply.test.ts:1513-1519 to expect coercion instead of rejection
- Add test: array coercion produces warning with correct type
- Add test: empty array coerces to empty object without warning
- Add test: array with invalid option ID still produces error
- Add test: array with non-string items produces error
- Add test: explicit mode uses 'yes' as default state
- Add test in valueCoercion.test.ts for array input coercion
- Add test: verify coerced values appear in appliedPatches

Part of markform-550 implementation.
