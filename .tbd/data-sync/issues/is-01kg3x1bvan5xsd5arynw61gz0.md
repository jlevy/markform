---
close_reason: null
closed_at: 2026-01-02T06:42:45.519Z
created_at: 2026-01-02T06:24:54.640Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.467Z
    original_id: markform-513
id: is-01kg3x1bvan5xsd5arynw61gz0
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: "Standardize patch property names: use 'value' for all operations"
type: is
updated_at: 2026-01-02T06:42:45.519Z
version: 1
---
## Problem

LLMs naturally use 'value' for all patch operations, but markform uses different property names:
- `set_checkboxes`: expects `values` (plural)
- `set_table`: expects `rows`
- `set_string_list`/`set_url_list`: expects `items`
- `set_single_select`/`set_multi_select`: expects `selected`

This causes unnecessary errors and self-correction cycles, wasting tokens/time.

## Solution

Standardize all patch operations to use `value` as the property name. The operation name (`set_table`, `set_checkboxes`, etc.) already conveys semantics.

## Tasks
1. Update Zod schemas in coreTypes.ts
2. Update TypeScript interfaces (Patch types)
3. Update apply.ts to read from `value`
4. Update tests
5. Update documentation
6. Consider deprecation aliases for backwards compatibility
