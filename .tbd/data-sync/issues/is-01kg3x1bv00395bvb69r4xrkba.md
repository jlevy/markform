---
close_reason: null
closed_at: 2025-12-23T22:11:11.144Z
created_at: 2025-12-23T22:05:41.346Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:02.963Z
    original_id: markform-113
id: is-01kg3x1bv00395bvb69r4xrkba
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Implement -o/--output flag for fill command
type: is
updated_at: 2025-12-23T22:11:11.144Z
version: 1
---
The fill command defines a -o/--output flag but doesn't use it. The filled form content should be written to the specified output path, or to a versioned filename if no -o is provided.

## Current Behavior
- The -o flag is defined in fill.ts but never used
- Fill command only outputs session transcript, not the form content

## Expected Behavior
- When -o is specified, write filled form to that path
- When -o is not specified, use versioned filename (e.g., form-v1.form.md)
- Use existing versioning logic from cli/lib/versioning.ts

## Files to Modify
- packages/markform/src/cli/commands/fill.ts
