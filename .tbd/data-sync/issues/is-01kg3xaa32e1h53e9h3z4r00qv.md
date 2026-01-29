---
close_reason: null
closed_at: 2025-12-23T09:31:48.312Z
created_at: 2025-12-23T08:33:02.206Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.007Z
    original_id: markform-0oa
id: is-01kg3xaa32e1h53e9h3z4r00qv
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "PLAN-004: Add task for Markdoc tag config/schema definitions"
type: is
updated_at: 2025-12-23T09:31:48.312Z
version: 1
---
## Problem
Plan doesn't explicitly include defining a Markdoc config/schema for custom tags, but architecture requires `Markdoc.validate(ast, config)` as an early syntax/schema gate.

## Why It Matters
- `Markdoc.validate()` is only meaningful with a proper config object
- Need tag definitions for `form`, `field-group`, all field tags, `doc`
- Need attribute schemas for each tag
- Without this, Markdoc.validate just does basic syntax checking

## Recommended Fix
Add a concrete task:
1. Implement `markformMarkdocConfig` with tag definitions and attribute schemas
2. Define required vs optional attributes per tag
3. Add unit tests that invalid attributes are caught by Markdoc.validate
4. Test that unknown tags are rejected

## Files to Update
- docs/project/plan/plan-2025-12-22-markform-v01-implementation.md (add task to Phase 1)

## Blocks
- markform-7mt (1.2 Markdoc Parsing)
