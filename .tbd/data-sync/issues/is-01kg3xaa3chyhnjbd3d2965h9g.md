---
close_reason: null
closed_at: 2026-01-02T05:56:19.652Z
created_at: 2026-01-02T05:52:57.863Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.677Z
    original_id: markform-510
id: is-01kg3xaa3chyhnjbd3d2965h9g
kind: bug
labels: []
parent_id: null
priority: 2
status: closed
title: Improve table error messages to show expected row structure
type: is
updated_at: 2026-01-02T05:56:19.652Z
version: 1
---
In apply.ts:187, the table validation error message says:
  'rows must be an array of row objects'

This is too vague - it doesn't explain what the row objects should look like.

Fix: Include the expected structure in the error, e.g.:
  'rows must be an array of row objects, each mapping column IDs to values. Columns: [name, email, phone]'

The columnIds are already available in the error context (line 190), just need to include them in the message.
