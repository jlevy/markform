---
close_reason: null
closed_at: 2025-12-28T07:02:52.612Z
created_at: 2025-12-28T03:53:32.711Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.712Z
    original_id: markform-334
id: is-01kg3xaa39j8nrgs0vgnby67kc
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 2: Update parser to extract report attribute"
type: is
updated_at: 2025-12-28T07:02:52.612Z
version: 1
---
Update parse.ts and parseFields.ts to extract report=true/false from tags.

The report attribute should be:
- Extracted from markdoc attributes on field, group, and doc blocks
- Stored on the corresponding type (Field, FieldGroup, DocumentationBlock)
- Default to undefined (allowing runtime default based on tag type)

Location:
- packages/markform/src/engine/parse.ts
- packages/markform/src/engine/parseFields.ts
