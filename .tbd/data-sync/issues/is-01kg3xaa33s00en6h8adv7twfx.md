---
close_reason: null
closed_at: 2025-12-23T23:08:46.410Z
created_at: 2025-12-23T23:03:08.068Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.203Z
    original_id: markform-135
id: is-01kg3xaa33s00en6h8adv7twfx
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "ROLE-007: Define field clearing semantics per field type"
type: is
updated_at: 2025-12-23T23:08:46.410Z
version: 1
---
## Problem
Overwrite mode implies 'clear and re-fill' but behavior per field type (strings, checkboxes, arrays) is not defined.

## Why It Matters
- Different field types have different 'empty' representations
- Without clear semantics, implementations will diverge
- Round-trip behavior must be predictable

## Recommended Fix
Define a `clearFieldValue(kind)` table in the spec:
- `string-field` → empty string
- `number-field` → null/undefined (pick one consistently)
- `checkboxes` → all unchecked
- `single-select` → no selection
- `array/repeater` → empty list
- `richtext` → empty doc/empty string

Add tests per field type.

## Files to Update
- docs/project/specs/active/plan-2025-12-23-role-system.md (add Field Clearing Semantics section)
- Add tests for each field type clear behavior
