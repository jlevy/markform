---
close_reason: null
closed_at: 2025-12-24T21:35:24.690Z
created_at: 2025-12-24T21:26:54.993Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.426Z
    original_id: markform-186
id: is-01kg3x1bv23kxgv1hxpne47yt1
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Rename engine/types.ts to engine/coreTypes.ts
type: is
updated_at: 2025-12-24T21:35:24.690Z
version: 1
---
Rename engine/types.ts to engine/coreTypes.ts and update all imports.

Files to update:
- Rename: src/engine/types.ts -> src/engine/coreTypes.ts
- Update imports in ~20 files that import from ./engine/types.js

This is the foundational step - must complete before other type extraction tasks.
