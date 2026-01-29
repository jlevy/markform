---
close_reason: null
closed_at: 2025-12-28T09:08:12.954Z
created_at: 2025-12-28T03:45:13.315Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.490Z
    original_id: markform-323.1
id: is-01kg3x1bv699rfwr5gs816tgtq
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Create spinner utility with context-aware status messages
type: is
updated_at: 2025-12-28T09:08:12.954Z
version: 1
---
Add a spinner utility to shared.ts that wraps @clack/prompts spinner with support for:
- Starting/stopping with custom messages
- Updating message in real-time
- Tracking elapsed time
- Context types: 'api' (for LLM calls with provider/model info) and 'compute' (for local calculations)
