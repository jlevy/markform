---
close_reason: null
closed_at: 2025-12-23T15:02:24.951Z
created_at: 2025-12-23T07:19:43.841Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.212Z
    original_id: markform-8ap
id: is-01kg3xaa3enacjddqfy0edac1n
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: 1.6 Patch Application (engine/apply.ts)
type: is
updated_at: 2025-12-23T15:03:22.038Z
version: 1
---
Implement applyPatches(form: ParsedForm, patches: Patch[]): ApplyResult
- Structural validation (field/option existence, type checking)
- Patch semantics (set_*, clear_field, set_checkboxes merge)
- Transaction semantics (all-or-nothing)
- Unit tests for all operations and error cases
