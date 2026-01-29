---
close_reason: null
closed_at: 2025-12-26T23:40:19.105Z
created_at: 2025-12-24T17:30:55.269Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.343Z
    original_id: markform-177
id: is-01kg3x1bv1jnh48rm0561yjmhz
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "[172.5] Update tests: parse.test.ts and serialize.test.ts"
type: is
updated_at: 2025-12-26T23:40:19.105Z
version: 1
---
**Parent:** markform-172
**Spec:** docs/project/specs/active/impl-2025-12-24-doc-block-syntax-simplification.md#phase-4

## Changes Required

### parse.test.ts (lines 424-531)
- Rename "doc block edge cases" → "documentation tag edge cases"
- Update test markdown to use new syntax
- Update assertions: `.kind` → `.tag`
- Update error message expectations

### serialize.test.ts (lines 630-650)
- Update test that includes doc blocks to use new syntax

## Acceptance
- `pnpm test --filter=markform` passes
- All doc block / documentation tag tests updated
- Golden tests still pass
