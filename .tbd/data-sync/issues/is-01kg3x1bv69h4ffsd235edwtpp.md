---
close_reason: null
closed_at: 2025-12-28T06:57:11.636Z
created_at: 2025-12-28T03:53:09.820Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.548Z
    original_id: markform-331
id: is-01kg3x1bv69h4ffsd235edwtpp
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 1: Update dump console output to show field states"
type: is
updated_at: 2025-12-28T06:57:11.636Z
version: 1
---
Update formatConsoleValues() in dump.ts to show state for each field:

- answered: show value (current behavior)
- skipped: show [skipped] with optional reason
- unanswered: show (unanswered)

Example output:
company_name: "Acme Corp"
funding_amount: [skipped] Information not available
analysis: (unanswered)

Location: packages/markform/src/cli/commands/dump.ts
