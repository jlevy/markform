---
close_reason: null
closed_at: 2025-12-28T10:31:28.193Z
created_at: 2025-12-28T06:45:59.038Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.844Z
    original_id: markform-359
id: is-01kg3xaa39b12bjzvmb6yh60j0
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 1: Parser - type validation for examples"
type: is
updated_at: 2025-12-28T10:31:28.193Z
version: 1
---
Add type validation for examples: error if example doesn't parse as field type (EXAMPLE_TYPE_MISMATCH). For number-field, all examples must parse as numbers. For url-field/url-list, all must be valid URLs.
