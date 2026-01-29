---
close_reason: null
closed_at: 2025-12-29T00:17:49.446Z
created_at: 2025-12-29T00:05:53.204Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.992Z
    original_id: markform-419
id: is-01kg3x1bv86qpkt22a6s4tw3d8
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Add columnCount and columnsById to StructureSummary
type: is
updated_at: 2025-12-29T00:17:49.446Z
version: 1
---
Extend StructureSummary to include table column tracking, incorporating the approach from Grok's PR #31.

## Changes Required

### Add to StructureSummary interface (coreTypes.ts)
```typescript
export interface StructureSummary {
  // ... existing fields ...
  
  /** Count of table columns across all table fields */
  columnCount: number;
  
  /** Map of qualified column refs to column metadata */
  columnsById: Record<QualifiedColumnRef, { parentFieldId: Id; columnType: ColumnType }>;
}
```

### Update computeStructureSummary (summaries.ts)
Add logic to count columns and build columnsById map:
```typescript
// Count columns for table fields
if (field.kind === 'table') {
  for (const column of field.columns) {
    columnCount++;
    const qualifiedRef: QualifiedColumnRef = `${field.id}.${column.id}`;
    columnsById[qualifiedRef] = {
      parentFieldId: field.id,
      columnType: column.type,
    };
  }
}
```

## Benefits
- Enables form analysis to understand table structure
- Provides quick lookup of column metadata by qualified reference
- Symmetric with existing optionsById pattern

## Files to Modify
- `packages/markform/src/engine/coreTypes.ts`
- `packages/markform/src/engine/summaries.ts`

## Testing
- Add test for columnCount in structure summary
- Add test for columnsById mapping
