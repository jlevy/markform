---
close_reason: null
closed_at: 2025-12-29T00:12:48.785Z
created_at: 2025-12-29T00:06:10.490Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.997Z
    original_id: markform-420
id: is-01kg3x1bv85h4c8tngxj9fsv2h
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: Add QualifiedColumnRef type alias
type: is
updated_at: 2025-12-29T00:12:48.785Z
version: 1
---
Add a typed template literal type for qualified column references, following the pattern established by QualifiedOptionRef.

## Change Required

### Add to coreTypes.ts
```typescript
/** Qualified column reference: "{fieldId}.{columnId}" */
export type QualifiedColumnRef = \`\${Id}.\${Id}\`;  // e.g., "team.name", "expenses.amount"
```

This should be placed near the existing QualifiedOptionRef type for consistency.

## Benefits
- Type-safe column references in columnsById map
- Consistent with existing QualifiedOptionRef pattern
- Better IDE autocompletion and error checking

## Files to Modify
- `packages/markform/src/engine/coreTypes.ts`

## Notes
- This is a prerequisite for markform-419 (columnsById in StructureSummary)
- No runtime changes needed - purely type-level
