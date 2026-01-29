---
close_reason: null
closed_at: 2025-12-24T18:21:06.435Z
created_at: 2025-12-24T17:37:43.715Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.505Z
    original_id: markform-183
id: is-01kg3xaa34pmg222c7qv641yd4
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Integration tests for programmatic fill API
type: is
updated_at: 2025-12-24T18:21:06.435Z
version: 1
---
## Summary
Add integration tests for the programmatic fill API using MockAgent.

## Files
- NEW: `tests/integration/programmaticFill.test.ts`

## Test Cases
1. End-to-end with MockAgent:
   - Complete fill of simple.form.md using mock values
   - Complete fill of political-research.form.md with inputContext for user fields
   - Verify round-trip: fillForm result can be re-parsed

2. Error scenarios:
   - Form parse error returns appropriate error
   - Model resolution error returns appropriate error

## Dependencies
- markform-182 (exports complete)

## Spec Reference
docs/project/specs/active/plan-2025-12-24-programmatic-fill-api.md
