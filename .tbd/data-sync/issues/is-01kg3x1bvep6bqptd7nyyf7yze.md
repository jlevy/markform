---
close_reason: null
closed_at: 2026-01-05T22:10:44.456Z
created_at: 2026-01-03T21:22:45.019Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.639Z
    original_id: markform-559
id: is-01kg3x1bvep6bqptd7nyyf7yze
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "[527-2] Create mock source with coercion-triggering formats"
type: is
updated_at: 2026-01-05T22:10:44.456Z
version: 1
---
Phase 1b: Create mock source that sends 'wrong' formats

The mock agent should intentionally send:
- Single strings for string_list fields
- Single URL for url_list fields
- Single option for multi_select fields
- Booleans for checkboxes (all modes)
- Arrays for checkboxes (after markform-550 is done)

Part of markform-551 implementation.
