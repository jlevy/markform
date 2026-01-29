---
close_reason: null
closed_at: 2025-12-23T09:01:39.743Z
created_at: 2025-12-23T08:31:09.697Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.605Z
    original_id: markform-4va
id: is-01kg3xaa3cx2m4xpmajd2gp7jr
kind: bug
labels: []
parent_id: null
priority: 1
status: closed
title: "ARCH-003: Fix contradictory InspectIssue priority sorting"
type: is
updated_at: 2025-12-23T09:01:39.743Z
version: 1
---
## Problem
Spec says 'sorted by priority (descending)' but also says 'priority: 1 = highest'. These are contradictory.

If 1 = highest and we sort descending, highest priority items appear last.

## Recommended Fix
Pick ONE convention and make both sections match:
- **Option A (recommended):** 'sorted by priority (ascending)' with '1 = highest' 
- **Option B:** 'sorted by priority (descending)' with 'higher number = higher priority'

## Files to Update
- docs/project/architecture/current/arch-markform-design.md.md (InspectResult section)

## Blocks
- markform-bve (1.7 Inspect implementation)
