---
close_reason: null
closed_at: 2025-12-27T23:42:48.169Z
created_at: 2025-12-27T23:24:39.293Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.269Z
    original_id: markform-266
id: is-01kg3x1bv5dpgcepxkwry4r5b7
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Update formatValueFence() for smart fence selection
type: is
updated_at: 2025-12-27T23:42:48.169Z
version: 1
---
Modify formatValueFence(content: string): string to use pickFence() for determining fence char, length, and process=false flag. Build fence with appropriate char/length and add {% process=false %} after language marker when needed.
