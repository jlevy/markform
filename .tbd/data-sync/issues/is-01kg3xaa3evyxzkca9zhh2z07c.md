---
close_reason: null
closed_at: 2025-12-23T09:31:28.260Z
created_at: 2025-12-23T08:33:00.339Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.140Z
    original_id: markform-7to
id: is-01kg3xaa3evyxzkca9zhh2z07c
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "PLAN-002: Remove nested group references from v0.1 plan"
type: is
updated_at: 2025-12-23T09:31:28.260Z
version: 1
---
## Problem
Plan refers to nested groups in complex example, but v0.1 architecture defers nested groups to v0.2.

## Why It Matters
- Creates confusion about v0.1 scope
- Could lead to implementing features meant for v0.2
- Complex fixture should stay within v0.1 constraints

## Recommended Fix
1. Review plan tasks and examples
2. Remove or defer any nested-group references
3. Ensure complex fixture stays within v0.1 scope (flat groups only)
4. Add explicit 'v0.2 scope' section for nested groups if mentioned

## Files to Update
- docs/project/plan/plan-2025-12-22-markform-v01-implementation.md
