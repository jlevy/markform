---
close_reason: null
closed_at: 2025-12-24T18:21:06.435Z
created_at: 2025-12-24T17:36:41.653Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.349Z
    original_id: markform-178
id: is-01kg3x1bv1hc5pp9xnn2t1wm23
kind: feature
labels: []
parent_id: null
priority: 1
status: closed
title: Programmatic Fill API
type: is
updated_at: 2025-12-24T18:21:06.435Z
version: 1
---
## Summary
Add a high-level programmatic API (`fillForm()`) that enables external agentic systems 
to execute form-filling sessions with a single function call.

## Spec
See: docs/project/specs/active/plan-2025-12-24-programmatic-fill-api.md

## Key Deliverables
1. Value coercion layer (`src/engine/values.ts`)
2. LiveAgent enhancement (systemPromptAddition)
3. `fillForm()` function (`src/harness/programmaticFill.ts`)
4. Export updates
5. Comprehensive tests

## Acceptance Criteria
- `fillForm()` exported from `markform` package
- Input context pre-fills fields before agent runs
- `systemPromptAddition` appends to composed prompt
- Progress callbacks and AbortSignal cancellation work
- All tests pass
