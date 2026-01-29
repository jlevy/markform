---
close_reason: null
closed_at: 2025-12-30T00:18:01.496Z
created_at: 2025-12-29T23:58:14.500Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.193Z
    original_id: markform-464
id: is-01kg3x1bv9qaazyhd9skz7533d
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Add RunMode type to schema
type: is
updated_at: 2025-12-30T00:18:01.496Z
version: 1
---
Add `RunMode` type and `runMode` optional field to FormMetadata.

**Implementation:**
- Add to coreTypes.ts:
  ```typescript
  export type RunMode = 'interactive' | 'fill' | 'research';
  ```
- Add `runMode?: RunMode` to FormMetadata interface
- Add RunModeSchema Zod schema
- Add MAX_FORMS_IN_MENU constant to settings.ts

**Files:**
- packages/markform/src/engine/coreTypes.ts
- packages/markform/src/settings.ts

**Ref:** markform-462
