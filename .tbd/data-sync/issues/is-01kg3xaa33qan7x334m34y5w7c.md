---
close_reason: null
closed_at: 2025-12-23T22:11:11.144Z
created_at: 2025-12-23T22:05:42.231Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.087Z
    original_id: markform-114
id: is-01kg3xaa33qan7x334m34y5w7c
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Integrate versioned filename logic into fill command
type: is
updated_at: 2025-12-23T22:11:11.144Z
version: 1
---
The versioning logic exists in cli/lib/versioning.ts but is not integrated into the fill command output. When no -o flag is provided, the fill command should automatically generate a versioned output filename.

## Current Behavior
- Versioning logic exists and is tested
- Fill command doesn't use it

## Expected Behavior
- Fill command uses getVersionedFilename() when -o not specified
- Output goes to form-v1.form.md, form-v2.form.md, etc.

## Depends On
- markform-113 (Implement -o/--output flag for fill command)
