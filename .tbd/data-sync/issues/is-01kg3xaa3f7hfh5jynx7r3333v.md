---
close_reason: null
closed_at: 2025-12-23T15:53:56.533Z
created_at: 2025-12-23T07:20:46.388Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.436Z
    original_id: markform-o5m
id: is-01kg3xaa3f7hfh5jynx7r3333v
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: 3.2 Harness Implementation (harness/)
type: is
updated_at: 2025-12-23T16:17:36.834Z
version: 1
---
Implement FormHarness class:
- State machine: INIT -> STEP -> WAIT -> APPLY -> COMPLETE
- step() returns StepResult with summaries and issues
- apply(patches) applies and revalidates
- max_turns safety limit
