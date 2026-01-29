---
close_reason: null
closed_at: 2025-12-23T09:00:32.547Z
created_at: 2025-12-23T08:31:08.963Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.118Z
    original_id: markform-e89
id: is-01kg3x1bvga9v1bv5455s5en5d
kind: bug
labels: []
parent_id: null
priority: 1
status: closed
title: "ARCH-002: Clarify ID uniqueness rules (global vs field-scoped)"
type: is
updated_at: 2025-12-23T09:00:32.547Z
version: 1
---
## Problem
Semantic validation says 'Globally-unique IDs across all elements', but options are explicitly field-scoped.

## Why It Matters
The current wording implies options must have globally unique IDs, which contradicts the field-scoped design where `field1.opt_a` and `field2.opt_a` are both valid.

## Recommended Fix
Clarify uniqueness rules explicitly:
- Form/group/field IDs are globally unique within the form
- Option IDs are unique only within their parent field
- Doc blocks are unique by `(ref, kind)` tuple

## Files to Update
- docs/project/architecture/current/arch-markform-design.md.md (semantic validation section)

## Related
- ARCH-001 (option indexing fix)
