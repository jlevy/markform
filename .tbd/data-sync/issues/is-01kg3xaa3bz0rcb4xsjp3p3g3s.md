---
close_reason: null
closed_at: 2025-12-30T00:18:01.496Z
created_at: 2025-12-29T23:58:08.587Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.365Z
    original_id: markform-463
id: is-01kg3xaa3bz0rcb4xsjp3p3g3s
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Add global --overwrite CLI option
type: is
updated_at: 2025-12-30T00:18:01.496Z
version: 1
---
Add `--overwrite` as a global CLI option in cli.ts.

**Implementation:**
- Add to cli.ts global options alongside `--forms-dir`
- Maps to `fillMode: 'overwrite'` vs `'continue'`
- Update CommandContext type in cliTypes.ts to include `overwrite: boolean`
- Remove any confirmation prompts for pre-filled forms
- Log info when form has pre-filled values

**Files:**
- packages/markform/src/cli/cli.ts
- packages/markform/src/cli/lib/cliTypes.ts

**Ref:** markform-462
