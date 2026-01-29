---
close_reason: null
closed_at: 2025-12-24T05:36:42.681Z
created_at: 2025-12-23T22:15:09.916Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.022Z
    original_id: markform-124
id: is-01kg3x1bv08sxmh79sgghwaeqh
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "TEST-002: Add golden tests for field type edge cases"
type: is
updated_at: 2025-12-24T05:36:42.681Z
version: 1
---
Add golden tests for field type edge cases identified in architecture review.

**Test cases:**
- Checkboxes multi-state transitions in required fields
- Simple-mode `minDone` threshold behavior
- `single_select` exactly-one semantics
- `string_list` `uniqueItems` duplicate rejection
- Serialization determinism via sha256 comparison

**Files:**
- packages/markform/tests/golden/

**Linked:** Blocks markform-110 (Review coverage reports and improve test coverage)
