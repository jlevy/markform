---
close_reason: null
closed_at: 2025-12-24T18:17:25.540Z
created_at: 2025-12-24T17:37:31.789Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.372Z
    original_id: markform-182
id: is-01kg3x1bv2eh7re8kafdm054k6
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Export updates for programmatic API
type: is
updated_at: 2025-12-24T18:17:25.540Z
version: 1
---
## Summary
Update package exports to expose the new programmatic fill API.

## Files
- MODIFY: `src/harness/index.ts`
- MODIFY: `src/index.ts`

## Deliverables
1. Export from harness/index.ts:
   - `fillForm`
   - `FillOptions`, `FillResult`, `FillStatus`, `TurnProgress`

2. Export from main index.ts:
   - `fillForm`
   - All types above
   - Coercion types: `InputContext`, `RawFieldValue`

## Dependencies
- markform-181 (fillForm implementation)

## Spec Reference
docs/project/specs/active/plan-2025-12-24-programmatic-fill-api.md
