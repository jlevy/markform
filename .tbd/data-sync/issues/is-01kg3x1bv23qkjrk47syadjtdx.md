---
close_reason: null
closed_at: 2025-12-25T09:24:38.064Z
created_at: 2025-12-25T08:50:40.608Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.599Z
    original_id: markform-202.10
id: is-01kg3x1bv23qkjrk47syadjtdx
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Update golden test runner to verify LLM stats
type: is
updated_at: 2025-12-25T09:24:38.064Z
version: 1
---
Update runner.ts to compare llm stats in TurnResult if present in session. For mock sessions, llm should be undefined. For live sessions, verify historyMessages grows across turns.
