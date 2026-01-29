---
close_reason: null
closed_at: 2025-12-28T07:02:52.612Z
created_at: 2025-12-28T03:53:26.429Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.708Z
    original_id: markform-333
id: is-01kg3xaa394pf8sqqhd6f2vfnj
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 2: Add report attribute to type definitions"
type: is
updated_at: 2025-12-28T07:02:52.612Z
version: 1
---
Add 'report?: boolean' attribute to types in coreTypes.ts:

1. Add to FieldBase (line 122-129):
   report?: boolean;  // whether to include in report output

2. Add to FieldGroup (line 235-240):
   report?: boolean;

3. Add to DocumentationBlock (line 334-340):
   report?: boolean;

Default behavior:
- instructions blocks: report=false
- All others: report=true

Location: packages/markform/src/engine/coreTypes.ts
