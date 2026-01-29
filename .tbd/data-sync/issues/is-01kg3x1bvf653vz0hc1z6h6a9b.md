---
close_reason: null
closed_at: 2025-12-23T19:23:17.608Z
created_at: 2025-12-23T19:22:00.179Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.935Z
    original_id: markform-81
id: is-01kg3x1bvf653vz0hc1z6h6a9b
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Fix export.ts to always emit required field
type: is
updated_at: 2025-12-23T19:23:17.608Z
version: 1
---
Change export.ts line 54 from 'required: field.required' to 'required: field.required ?? false' so the JSON export always includes an explicit boolean.
