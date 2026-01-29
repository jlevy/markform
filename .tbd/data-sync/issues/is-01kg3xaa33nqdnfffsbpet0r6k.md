---
close_reason: null
closed_at: 2025-12-24T05:36:42.736Z
created_at: 2025-12-23T22:15:16.674Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.146Z
    original_id: markform-125
id: is-01kg3xaa33nqdnfffsbpet0r6k
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "TEST-003: Add CLI and live agent mock tests"
type: is
updated_at: 2025-12-24T05:36:42.736Z
version: 1
---
Add CLI and live agent tests identified in architecture review.

**Test cases:**
- Verify help output shows aligned defaults and flags
- Test `markform models` prints registry contents (after FILL-001)
- Test uninstalled provider error message is actionable
- Mock AI SDK to test tool call sequences
- Test patch extraction correctness
- Test early stop when `max_turns` or `max_patches_per_turn` reached

**Files:**
- packages/markform/tests/unit/

**Linked:** Blocks markform-110 (Review coverage reports and improve test coverage)
