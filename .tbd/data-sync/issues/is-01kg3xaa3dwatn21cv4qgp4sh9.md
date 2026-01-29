---
close_reason: Implemented best-effort patch application with value coercion
closed_at: 2026-01-03T06:22:49.637Z
created_at: 2026-01-03T06:01:59.796Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.799Z
    original_id: markform-547
id: is-01kg3xaa3dwatn21cv4qgp4sh9
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 5: Tests for best-effort patching and coercion"
type: is
updated_at: 2026-01-03T06:34:13.185Z
version: 1
---
Add/update tests in apply.test.ts:

- Update existing 'transaction semantics' test for new partial behavior
- all patches valid → applyStatus: 'applied'
- all patches invalid → applyStatus: 'rejected'
- mixed valid/invalid → applyStatus: 'partial', correct appliedPatches
- single string → string_list coercion with warning
- single URL → url_list coercion with warning
- single option → multi_select coercion with warning
- verify form state only reflects applied patches
- coerced values are in appliedPatches (not original)

Parent: markform-542
