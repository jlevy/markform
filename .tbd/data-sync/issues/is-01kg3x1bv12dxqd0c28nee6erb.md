---
close_reason: null
closed_at: 2025-12-24T02:47:44.793Z
created_at: 2025-12-24T02:07:27.996Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.167Z
    original_id: markform-149.3
id: is-01kg3x1bv12dxqd0c28nee6erb
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 3: Update inspect for role filtering and blocking checkpoints"
type: is
updated_at: 2025-12-24T02:47:44.793Z
version: 1
---
## Goal
Filter issues by role and detect blocking checkpoints in inspect.

## Changes to inspect.ts
- Add `isCheckboxComplete()` helper (checks completion based on checkboxMode)
- Add `findBlockingCheckpoint()` helper (finds first incomplete blocking checkbox)
- Add `getBlockedFieldIds()` helper (fields after blocking checkpoint)
- Add `targetRoles?: string[]` to InspectOptions
- Update `inspect()` to filter issues by target roles
- Add "blocked by" annotations to blocked field issues
- Update InspectIssue to include `blockedBy?: Id`

## Checkbox Completion Semantics
- mode='all': all options checked
- mode='any': at least one (or minDone) checked
- mode='explicit': no 'unfilled' values remain

## Files
- packages/markform/src/engine/inspect.ts

## Tests
- Test role filtering in inspect
- Test blocking checkpoint detection  
- Test "blocked by" annotations
- Test checkbox completion semantics (all/any/explicit modes)
