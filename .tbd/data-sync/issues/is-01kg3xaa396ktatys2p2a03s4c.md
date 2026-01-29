---
close_reason: null
closed_at: 2025-12-28T06:57:11.636Z
created_at: 2025-12-28T03:53:15.108Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.702Z
    original_id: markform-332
id: is-01kg3xaa396ktatys2p2a03s4c
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 1: Add tests for dump state output format"
type: is
updated_at: 2025-12-28T06:57:11.636Z
version: 1
---
Add tests verifying:
- YAML/JSON output includes all fields with states
- Skipped fields show state: skipped with reason
- Unanswered fields show state: unanswered
- Answered fields show state: answered with value

Location: packages/markform/tests/unit/cli/dump.test.ts (new or extend)
