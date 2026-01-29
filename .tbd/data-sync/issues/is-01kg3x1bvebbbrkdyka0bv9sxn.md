---
close_reason: null
closed_at: 2026-01-05T22:10:44.456Z
created_at: 2026-01-03T21:22:31.520Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.635Z
    original_id: markform-558
id: is-01kg3x1bvebbbrkdyka0bv9sxn
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "[527-1] Create coercion-test example form"
type: is
updated_at: 2026-01-05T22:10:44.456Z
version: 1
---
Phase 1: Create example form with all coercible field types

- Create examples/coercion-test/ directory
- Create coercion-test.form.md with:
  - string_list field
  - url_list field
  - multi_select field
  - checkboxes (simple mode)
  - checkboxes (multi mode)
  - checkboxes (explicit mode)
- Create coercion-test-mock-filled.form.md with final expected values

Part of markform-551 implementation.
