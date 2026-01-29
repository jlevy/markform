---
close_reason: null
closed_at: 2025-12-27T23:42:48.169Z
created_at: 2025-12-27T23:24:22.794Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.263Z
    original_id: markform-265
id: is-01kg3x1bv5b4mm143pg5nc8eeg
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Add pickFence() helper function
type: is
updated_at: 2025-12-27T23:42:48.169Z
version: 1
---
Add pickFence(value: string): { char: '`' | '~'; len: number; processFalse: boolean } function. Check if content contains Markdoc tags (/{%/), compute max backtick and tilde runs at line start, pick char with smaller max-run (length = max(3, maxRun + 1)), prefer backticks on tie.
