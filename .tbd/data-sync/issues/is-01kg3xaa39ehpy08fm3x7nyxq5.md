---
close_reason: null
closed_at: 2025-12-28T10:31:28.193Z
created_at: 2025-12-28T06:45:59.094Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.849Z
    original_id: markform-360
id: is-01kg3xaa39ehpy08fm3x7nyxq5
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 1: Parser - type validation for placeholder (warning)"
type: is
updated_at: 2025-12-28T10:31:28.193Z
version: 1
---
Add type validation for placeholder: warning (not error) if placeholder doesn't parse as field type (PLACEHOLDER_TYPE_MISMATCH). Placeholders often include decorative text like 'e.g., 123...' that won't parse.
