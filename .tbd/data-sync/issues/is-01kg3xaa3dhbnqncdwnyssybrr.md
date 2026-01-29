---
close_reason: null
closed_at: 2026-01-05T22:10:45.137Z
created_at: 2026-01-03T21:10:26.323Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.820Z
    original_id: markform-551
id: is-01kg3xaa3dhbnqncdwnyssybrr
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: Add golden session tests for type coercion
type: is
updated_at: 2026-01-05T22:10:45.137Z
version: 1
---
Create comprehensive golden session tests that verify all type coercion behaviors end-to-end.

**Spec:** docs/project/specs/active/plan-2026-01-03-type-coercion-golden-tests.md

**Key deliverables:**
1. New coercion-test example form with all coercible field types
2. Mock source that sends 'wrong' formats triggering coercion
3. Golden session verifying all coercion warnings are captured
4. Updated prompts to better distinguish checkboxes from multi_select
5. Documentation updates for coercion behavior

**Depends on:** markform-550 (array-to-checkboxes coercion)
