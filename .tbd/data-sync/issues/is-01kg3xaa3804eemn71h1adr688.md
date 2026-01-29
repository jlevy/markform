---
close_reason: null
closed_at: 2025-12-28T05:23:28.437Z
created_at: 2025-12-28T00:45:43.856Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.485Z
    original_id: markform-276
id: is-01kg3xaa3804eemn71h1adr688
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Update versioning.ts to support forms directory paths
type: is
updated_at: 2025-12-28T05:23:28.437Z
version: 1
---
Add new function generateVersionedPathInFormsDir() that generates versioned filename (e.g., simple-filled1.form.md) within the forms directory. Handles both form basename derivation from input path and version incrementing within forms dir.
