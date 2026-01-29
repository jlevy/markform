---
close_reason: --syntax option implemented in validate.ts:215 with enforcement logic at line 231
closed_at: 2026-01-29T06:35:27.881Z
created_at: 2026-01-12T05:42:34.437Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.049Z
    original_id: markform-594
id: is-01kg3xaa3eyk00e7rnkeb406x6
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: Add tryscript tests for --syntax option (optional)
type: is
updated_at: 2026-01-29T06:35:27.882Z
version: 2
---
## Task
Add tryscript tests for the `--syntax` CLI option:

## Test Cases
- Validate with `--syntax=comments` outputs comment syntax
- Validate with `--syntax=tags` outputs Markdoc syntax
- Default behavior preserves original syntax

## Files
- packages/markform/tests/tryscript/validate-syntax-*.md (NEW)

## Priority
Optional - only if --syntax option is implemented.

## Depends On
- validate.ts --syntax implementation
