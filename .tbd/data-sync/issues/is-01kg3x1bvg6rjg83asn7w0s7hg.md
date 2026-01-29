---
close_reason: null
closed_at: 2025-12-23T09:09:47.167Z
created_at: 2025-12-23T08:31:12.069Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.071Z
    original_id: markform-c2w
id: is-01kg3x1bvg6rjg83asn7w0s7hg
kind: bug
labels: []
parent_id: null
priority: 1
status: closed
title: "ARCH-006: Fix clear_field patch semantics for select/checkbox fields"
type: is
updated_at: 2025-12-23T09:09:47.167Z
version: 1
---
## Problem
Spec says `clear_field` 'serializes as empty tag (no value fence)' but for select/checkbox fields, the value is in the option markers list, not a `value` fence.

## Why It Matters
- Scalar/list fields: value is in a fenced block
- Select/checkbox fields: value is in option markers like `[x]`, `[ ]`, `[y]`, `[n]`
- Current spec doesn't distinguish these cases
- applyPatches implementation would be ambiguous

## Recommended Fix
Define `clear_field` semantics per field kind:
- **Scalar/list fields:** clear = remove `value` fence entirely
- **Select/checkbox fields:** clear = reset all markers to their default state:
  - single-select: all `( )`
  - multi-select: all `[ ]`  
  - simple checkboxes: all `[ ]`
  - multi checkboxes: all `[-]`
  - explicit checkboxes: all `[_]` (unfilled)

## Files to Update
- docs/project/architecture/current/arch-markform-design.md.md (Patch Operations section)

## Blocks
- markform-8ap (1.6 Patch Application)
