---
close_reason: null
closed_at: 2025-12-23T23:08:46.410Z
created_at: 2025-12-23T23:02:41.316Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.065Z
    original_id: markform-132
id: is-01kg3x1bv0d2cph9x2tw6n5zsy
kind: bug
labels: []
parent_id: null
priority: 2
status: closed
title: "ROLE-004: Fix inconsistent attribute naming (approval_mode vs approvalMode)"
type: is
updated_at: 2025-12-23T23:08:46.410Z
version: 1
---
## Problem
The spec uses `approval_mode` (snake_case) in the summary section but `approvalMode` (camelCase) elsewhere. Markdoc attributes should consistently use camelCase.

## Evidence
- Line 51: 'Add `approval_mode` attribute for checkpoint/gate checkboxes'
- Line 176: 'Attribute: `approvalMode` (camelCase per Markdoc attribute convention)'

## Recommended Fix
1. Change line 51 to use `approvalMode`
2. Search entire spec for any other instances of `approval_mode` and fix
3. Add note in spec that all Markdoc attributes use camelCase

## Files to Update
- docs/project/specs/active/plan-2025-12-23-role-system.md
