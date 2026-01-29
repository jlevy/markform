---
close_reason: null
closed_at: 2025-12-29T23:42:26.937Z
created_at: 2025-12-29T07:53:46.621Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.114Z
    original_id: markform-442
id: is-01kg3x1bv9kzwrkjgz6x515fcq
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 1: Core JSON Schema Engine Implementation"
type: is
updated_at: 2025-12-29T23:42:26.937Z
version: 1
---
Create engine/jsonSchema.ts with core conversion logic.

**Tasks:**
- [ ] Create engine/jsonSchema.ts with types and core conversion
- [ ] Implement fieldToJsonSchema() for all 11 field types
- [ ] Implement formToJsonSchema() wrapping field conversions
- [ ] Add description lookup from doc blocks
- [ ] Add unit tests for each field type mapping

**Ref:** markform-432
