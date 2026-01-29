---
close_reason: null
closed_at: 2025-12-23T09:31:58.338Z
created_at: 2025-12-23T08:33:03.046Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.088Z
    original_id: markform-cre
id: is-01kg3x1bvga4mdnz1vpgb9exdx
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "PLAN-005: Add task for doc body raw slice preservation"
type: is
updated_at: 2025-12-23T09:31:58.338Z
version: 1
---
## Problem
Architecture requires doc bodies be preserved verbatim for deterministic round-trip, but plan doesn't explicitly cover capturing raw text ranges.

## Why It Matters
- Doc blocks contain user-written markdown that must not be altered
- Need to capture the exact source text, not a reconstructed version
- Markdoc node location metadata may or may not be available

## Recommended Fix
Add explicit tasks:
1. Document how to get source ranges from Markdoc node location metadata
2. Add fallback strategy if location isn't available for some nodes
3. Add tests verifying doc body round-trip preservation
4. Test with various markdown content (lists, code blocks, etc.)

## Files to Update
- docs/project/plan/plan-2025-12-22-markform-v01-implementation.md (add to Phase 1 parsing tasks)

## Blocks
- markform-7mt (1.2 Markdoc Parsing)
