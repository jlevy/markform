---
close_reason: null
closed_at: 2025-12-25T09:26:22.279Z
created_at: 2025-12-25T09:24:53.426Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.623Z
    original_id: markform-202.15
id: is-01kg3x1bv3dczat0g9kze3a859
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Add comprehensive per-turn stats tracking
type: is
updated_at: 2025-12-25T09:26:22.279Z
version: 1
---
Add per-turn stats to TurnProgress and SessionTurn:
- Token usage: inputTokens, outputTokens from result.usage
- Tool usage: tool call counts, which tools used (generatePatches, web_search)
- Form tallies: answeredFields, skippedFields, requiredIssuesRemaining (from progressSummary)
Display in CLI verbose output and record in session logs.
