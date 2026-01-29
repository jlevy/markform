---
close_reason: null
closed_at: 2025-12-23T09:24:11.775Z
created_at: 2025-12-23T08:32:04.614Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.451Z
    original_id: markform-p6z
id: is-01kg3xaa3fpmys1035mh9rnz1t
kind: bug
labels: []
parent_id: null
priority: 2
status: closed
title: "ARCH-008: Align explicit checkbox validation with required semantics"
type: is
updated_at: 2025-12-23T09:24:11.775Z
version: 1
---
## Problem
Built-in deterministic validation table says explicit checkboxes 'requires no unfilled values' without mentioning `required=true`, but Required Field Semantics section ties that rule to `required=true`.

## Why It Matters
These two sections contradict each other:
- Validation table implies: explicit mode ALWAYS requires all answered
- Required semantics implies: explicit mode only requires all answered when `required=true`

## Recommended Fix
Make both sections consistent. Recommended approach:
- **Validation:** Only checks that markers are valid (`unfilled|yes|no`)
- **Completeness:** If `required=true`, then all must be answered (no `[_]` markers)

This aligns with progress state meaning (`empty` vs `incomplete` vs `invalid`).

## Files to Update
- docs/project/architecture/current/arch-markform-design.md.md (Built-in Validation table + Required Field Semantics)

## Blocks
- markform-aae (1.5 Validation)
