---
close_reason: null
closed_at: 2025-12-28T05:23:28.437Z
created_at: 2025-12-28T00:45:30.437Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.468Z
    original_id: markform-273
id: is-01kg3xaa38me1xph7t2hped7f0
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Add ensureFormsDir() utility to create forms directory if missing
type: is
updated_at: 2025-12-28T05:23:28.437Z
version: 1
---
Add ensureFormsDir() async function to CLI lib/shared.ts or a new formsDir.ts. Uses the forms directory setting and creates the directory if it doesn't exist using fs.mkdir with recursive: true.
