---
close_reason: null
closed_at: 2025-12-23T23:08:46.410Z
created_at: 2025-12-23T23:02:25.909Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.174Z
    original_id: markform-130
id: is-01kg3xaa332v5dtxec8v3y9a5w
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "ROLE-002: Define checkbox completion semantics for blocking gates"
type: is
updated_at: 2025-12-23T23:08:46.410Z
version: 1
---
## Problem
`isCheckboxComplete()` is referenced in blocking logic but its 'complete' semantics with `checkboxMode` and `minDone` aren't specified.

## Why It Matters
- Blocking gates depend on knowing when a checkbox is 'complete'
- Different modes (all, any, explicit) have different completion criteria
- Without clear definition, implementations will diverge

## Recommended Fix
Specify exactly:
- `checkboxMode='all'`: complete when all options checked
- `checkboxMode='any'`: complete when at least one checked (or minDone if specified)
- `checkboxMode='explicit'`: complete when all options answered (no `[_]` markers)
- `minDone` override: complete when checkedCount >= minDone

Add this to the spec and create corresponding tests.

## Files to Update
- docs/project/specs/active/plan-2025-12-23-role-system.md (add Checkbox Completion Semantics section)
- Add tests for each completion mode with blocking
