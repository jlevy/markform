---
close_reason: null
closed_at: 2025-12-24T04:27:50.489Z
created_at: 2025-12-24T02:08:08.231Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.184Z
    original_id: markform-149.6
id: is-01kg3x1bv10y52a2eteze3emv1
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 6: Update inspect CLI to show role info and blocked fields"
type: is
updated_at: 2025-12-24T04:27:50.489Z
version: 1
---
## Goal
Update inspect CLI to support role filtering and display blocked field info.

## Changes to inspect.ts (CLI command)
- Add `--roles <roles>` flag to filter issues by role
- Update console output to show "Blocked by: fieldId" annotations
- Optionally show role of each field in output

## Files
- packages/markform/src/cli/commands/inspect.ts

## Tests
- Test --roles flag works correctly
- Test blocked fields display "Blocked by" annotation
