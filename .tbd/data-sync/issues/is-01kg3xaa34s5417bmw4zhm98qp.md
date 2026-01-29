---
close_reason: null
closed_at: 2025-12-26T23:47:00.023Z
created_at: 2025-12-24T20:55:55.959Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.526Z
    original_id: markform-184.3
id: is-01kg3xaa34s5417bmw4zhm98qp
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "CLI: Update --prompt/--instructions help text to reflect 'addition' behavior"
type: is
updated_at: 2025-12-26T23:47:00.023Z
version: 1
---
CLI fill command (fill.ts:192-197) says --prompt 'overrides default' and --instructions 'overrides --prompt and default'. But the implementation (fill.ts:423) passes these as systemPromptAddition which appends, not overrides. Update help text to say 'appends to' or 'additional context for' the system prompt.
