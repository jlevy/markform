---
close_reason: null
closed_at: 2025-12-24T18:16:04.575Z
created_at: 2025-12-24T17:37:18.826Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.367Z
    original_id: markform-181
id: is-01kg3x1bv2aq1k4n4zppdec8nj
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: fillForm() programmatic API
type: is
updated_at: 2025-12-24T18:16:04.575Z
version: 1
---
## Summary
Implement the main `fillForm()` function that provides a single-call entry point for form filling.

## Files
- NEW: `src/harness/programmaticFill.ts`

## Deliverables
1. `fillForm()` async function
2. Types: `FillOptions`, `FillResult`, `FillStatus`, `TurnProgress`
3. Input context handling via coercion layer
4. Progress callback support (`onTurnComplete`)
5. Cancellation via AbortSignal
6. Proper status handling (ok, max_turns, cancelled, error)

## Algorithm
1. Parse form if string
2. Resolve model if string
3. Apply input context using coerceInputContext()
4. Create harness + agent
5. Run harness loop with abort check
6. Return structured FillResult

## Dependencies
- markform-179 (value coercion layer)
- markform-180 (LiveAgent systemPromptAddition)

## Tests
- tests/unit/programmaticFill.test.ts (see Testing Plan in spec)

## Spec Reference
docs/project/specs/active/plan-2025-12-24-programmatic-fill-api.md
