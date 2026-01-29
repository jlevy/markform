---
close_reason: Implemented best-effort patch application with value coercion
closed_at: 2026-01-03T06:04:53.983Z
created_at: 2026-01-03T06:01:57.076Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.559Z
    original_id: markform-543
id: is-01kg3x1bvevdg93xb3mzg00x3p
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 1: Core type changes for best-effort patching"
type: is
updated_at: 2026-01-03T06:22:49.637Z
version: 1
---
Add types to coreTypes.ts:

- Add 'partial' to ApplyStatus type
- Add PatchWarning interface with patchIndex, fieldId, message, coercion
- Add appliedPatches: Patch[] to ApplyResult
- Add warnings: PatchWarning[] to ApplyResult

Parent: markform-542
