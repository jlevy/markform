---
close_reason: null
closed_at: 2025-12-30T19:06:06.334Z
created_at: 2025-12-30T19:02:49.662Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.242Z
    original_id: markform-473
id: is-01kg3x1bv9jrxk6vp1thxes5pf
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 1: Expand FillCallbacks and TurnProgress types"
type: is
updated_at: 2025-12-30T19:06:06.334Z
version: 1
---
Add new optional callbacks and fields to harnessTypes.ts.

**Spec:** docs/project/specs/active/plan-2025-12-30-unified-fill-logging.md

**Changes to FillCallbacks:**
- Add onIssuesIdentified({ turnNumber, issues: InspectIssue[] })
- Add onPatchesGenerated({ turnNumber, patches: Patch[], stats?: TurnStats })

**Changes to TurnProgress:**
- Add issues: InspectIssue[]
- Add patches: Patch[]

**File:** packages/markform/src/harness/harnessTypes.ts

**Notes:**
- All additions are optional (no breaking changes)
- Import InspectIssue and Patch types

**Parent:** markform-472
