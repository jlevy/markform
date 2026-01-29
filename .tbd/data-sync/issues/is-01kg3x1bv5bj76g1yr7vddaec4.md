---
close_reason: null
closed_at: 2025-12-28T05:23:28.437Z
created_at: 2025-12-28T00:45:35.190Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.309Z
    original_id: markform-274
id: is-01kg3x1bv5bj76g1yr7vddaec4
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Update examples command to write output to forms directory
type: is
updated_at: 2025-12-28T05:23:28.437Z
version: 1
---
Modify examples.ts to: 1) Call ensureFormsDir() at start, 2) Change default output path from process.cwd() to forms directory, 3) Write all outputs (.form.md, .raw.md, .yml) to forms directory.
