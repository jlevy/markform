---
close_reason: null
closed_at: 2025-12-27T23:45:21.585Z
created_at: 2025-12-27T23:24:44.690Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.273Z
    original_id: markform-267
id: is-01kg3x1bv5ajj1d7sd4reqh39b
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Add unit tests for smart fence selection
type: is
updated_at: 2025-12-27T23:45:21.585Z
version: 1
---
Create tests/unit/engine/serialize-fence.test.ts with tests for: maxRunAtLineStart() (no fence chars, triple backticks, tildes, 4+ indent ignored, mixed), pickFence() (plain text, content with code blocks, Markdoc tags, tie-breaker), formatValueFence() (plain content, code blocks, Markdoc).
