---
close_reason: null
closed_at: 2025-12-23T16:36:28.831Z
created_at: 2025-12-23T07:18:38.251Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.283Z
    original_id: markform-yz3
id: is-01kg3x1bvhaehn0nbwcxvpbrqe
kind: epic
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 3: End-to-End CLI and Session Tests"
type: is
updated_at: 2025-12-23T16:41:39.891Z
version: 1
---
Complete CLI functionality and golden session testing.

Sub-tasks:
3.1 Apply Command (cli/commands/apply.ts)
3.2 Harness Implementation (harness/)
3.3 Mock Agent (harness/mockAgent.ts)
3.4 Run Command (cli/commands/run.ts)
3.5 Golden Session Tests (tests/golden/)

Checkpoints (automated):
- markform apply with valid patches succeeds
- markform apply with invalid patches rejects batch
- markform run --mock completes
- Golden tests pass for both forms

Checkpoints (manual):
- User reviews session transcript YAML for readability
