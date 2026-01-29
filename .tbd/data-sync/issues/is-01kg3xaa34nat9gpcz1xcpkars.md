---
close_reason: null
closed_at: 2025-12-24T18:06:03.654Z
created_at: 2025-12-24T17:37:01.370Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.484Z
    original_id: markform-179
id: is-01kg3xaa34nat9gpcz1xcpkars
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Value coercion layer (values.ts)
type: is
updated_at: 2025-12-24T18:06:03.654Z
version: 1
---
## Summary
Create unified value coercion layer for converting raw input values to typed Patches.

## Files
- NEW: `src/engine/values.ts`

## Deliverables
1. `findFieldById()` - O(1) lookup using idIndex
2. `coerceToFieldPatch()` - raw value → typed Patch with validation
3. `coerceInputContext()` - batch coercion with warnings/errors
4. Types: `RawFieldValue`, `InputContext`, `CoercionResult`, `CoerceInputContextResult`

## Coercion Rules
| Field Kind | Accepts | Coerces | Rejects |
|------------|---------|---------|---------|
| string | string | number→string, boolean→string | array, object |
| number | number | numeric string→number | non-numeric, array |
| string_list | string[] | string→[string] | non-array non-string |
| single_select | string | - | invalid option ID |
| multi_select | string[] | string→[string] | invalid option IDs |
| checkboxes | Record | - | wrong structure |

## Tests
- tests/unit/values.test.ts (see Testing Plan in spec)

## Spec Reference
docs/project/specs/active/plan-2025-12-24-programmatic-fill-api.md
