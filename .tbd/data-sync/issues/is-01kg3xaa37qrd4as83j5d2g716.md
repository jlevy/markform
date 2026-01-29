---
close_reason: null
closed_at: 2025-12-26T23:40:29.004Z
created_at: 2025-12-26T21:01:11.126Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.164Z
    original_id: markform-254.4
id: is-01kg3xaa37qrd4as83j5d2g716
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Update sentinel parsing to use parenthesized format
type: is
updated_at: 2025-12-26T23:40:29.004Z
version: 1
---
Update parse.ts to parse %SKIP% (reason) and %ABORT% (reason) format. Extract reason from parentheses and store in FieldResponse.reason.
