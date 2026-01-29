---
close_reason: null
closed_at: 2025-12-23T09:24:21.797Z
created_at: 2025-12-23T08:32:05.503Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.473Z
    original_id: markform-vd0
id: is-01kg3xaa3fpzhjn87kah3n0c7y
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "ARCH-009: Clarify single-select validity vs requiredness semantics"
type: is
updated_at: 2025-12-23T09:24:21.797Z
version: 1
---
## Problem
Spec wording inconsistency: one section implies 'exactly one [x] always', but the data model allows `selected: null` and required semantics allow optional single-select to be empty.

## Why It Matters
Implementers need clear rules for:
- What constitutes a VALID single-select value?
- What constitutes a COMPLETE single-select value?

## Recommended Fix
Make explicit:
- **Validity invariant (always):** At most one selected marker (`(x)`)
- **Required invariant (only when `required=true`):** Exactly one selected

An optional single-select with no selection is valid but incomplete (if you track progress).

## Files to Update
- docs/project/architecture/current/arch-markform-design.md.md (single-select sections)

## Blocks
- markform-aae (1.5 Validation)
