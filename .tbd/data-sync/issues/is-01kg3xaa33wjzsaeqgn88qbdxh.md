---
close_reason: null
closed_at: 2025-12-24T01:15:32.503Z
created_at: 2025-12-23T22:14:21.944Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.102Z
    original_id: markform-117
id: is-01kg3xaa33wjzsaeqgn88qbdxh
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "ARCH-015: Define default doc block kind and clarify uniqueness"
type: is
updated_at: 2025-12-24T01:15:32.503Z
version: 1
---
Clarify documentation block behavior when `kind` attribute is omitted.

**Changes:**
- Specify that when `kind` is omitted, it defaults to `'notes'`
- Update uniqueness constraint text at lines 245-247 and 418-424
- Update `DocumentationBlock` type to show `kind` has a default value

This prevents accidental duplicate doc blocks and clarifies serialization behavior.

**Files:**
- docs/project/architecture/current/arch-markform-design.md.md
