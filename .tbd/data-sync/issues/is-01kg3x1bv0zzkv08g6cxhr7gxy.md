---
close_reason: null
closed_at: 2025-12-23T23:08:46.410Z
created_at: 2025-12-23T23:03:17.919Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.086Z
    original_id: markform-136
id: is-01kg3x1bv0zzkv08g6cxhr7gxy
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "ROLE-008: Promote inspect role enhancements to Must Have"
type: is
updated_at: 2025-12-23T23:08:46.410Z
version: 1
---
## Problem
Role-filtered inspect and blocked field reasoning are listed as 'Nice to Have' but are essential for UX.

## Why It Matters
- Users need to understand why fields can't be filled
- Debugging multi-stage workflows requires role filtering
- Blocked fields need 'blocked by' annotations

## Recommended Fix
1. Promote to Must Have:
   - `inspect --roles` (filters issues by role)
   - Show 'Blocked by: <fieldId> (approvalMode=blocking)' annotations on affected fields
2. Add acceptance criteria for:
   - inspect shows blocked field annotations
   - inspect respects --roles filter
3. Consider adding:
   - `--dry-run` to fill to show which fields would be filled/blocked
   - `--explain` to print why each field is (not) selected
   - `markform inspect --list-roles` to see available roles

## Files to Update
- docs/project/specs/active/plan-2025-12-23-role-system.md (move items from Nice to Have to Must Have)
