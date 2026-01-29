---
close_reason: null
closed_at: 2025-12-28T05:23:28.437Z
created_at: 2025-12-28T00:45:39.376Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.314Z
    original_id: markform-275
id: is-01kg3x1bv579sg0ghgbesmc3h4
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Update fill command to write output to forms directory
type: is
updated_at: 2025-12-28T05:23:28.437Z
version: 1
---
Modify fill.ts to: 1) Call ensureFormsDir() before writing output, 2) When no --output specified, use forms directory as base for versioned path generation instead of input file directory.
