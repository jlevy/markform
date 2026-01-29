---
close_reason: null
closed_at: 2025-12-27T23:42:48.169Z
created_at: 2025-12-27T23:24:16.004Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.257Z
    original_id: markform-264
id: is-01kg3x1bv5asvw6j6sh7p0mpw3
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Add maxRunAtLineStart() helper function
type: is
updated_at: 2025-12-27T23:42:48.169Z
version: 1
---
Add maxRunAtLineStart(value: string, char: string): number function to serialize.ts. Matches lines starting with 0-3 spaces followed by runs of the fence char and returns the maximum run length found. Pattern: /^( {0,3})(char+)/gm
