---
close_reason: null
closed_at: 2025-12-23T21:31:38.402Z
created_at: 2025-12-23T20:22:39.989Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.236Z
    original_id: markform-94
id: is-01kg3xaa3eqf2q4bc53z0vzfxq
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Standardize field naming: snake_case for JSON/YAML, camelCase for TypeScript"
type: is
updated_at: 2025-12-23T21:31:38.402Z
version: 1
---
We are not completely consistent on YAML filename casing. Need to establish and enforce:

**Convention:**
- All field keys in JSON and YAML: snake_case (e.g., field_count, parent_field_id)
- All fields in TypeScript: camelCase (e.g., fieldCount, parentFieldId)

**Implementation:**
- Add conversion layer when exporting to JSON/YAML (camelCase → snake_case)
- Add conversion layer when deserializing back to TypeScript (snake_case → camelCase)
- This should be robust since it's only for known fields

**Scope:**
- Update all architecture docs
- Update golden tests
- Update code
- Ensure everything passes

**Notes:**
- No backward compatibility needed
- Can do systematic update all at once
