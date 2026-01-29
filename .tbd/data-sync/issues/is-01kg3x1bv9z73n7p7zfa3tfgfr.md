---
close_reason: null
closed_at: 2025-12-31T05:25:02.974Z
created_at: 2025-12-31T05:19:53.265Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.267Z
    original_id: markform-478
id: is-01kg3x1bv9z73n7p7zfa3tfgfr
kind: feature
labels: []
parent_id: null
priority: 1
status: closed
title: Improve patch apply result types with detailed rejection info
type: is
updated_at: 2025-12-31T05:25:02.974Z
version: 1
---
Replace ambiguous patchesApplied/patchesRejected with clearer types that expose rejection details.

**Current state:**
- `patchesApplied: number` - count only
- `patchesRejected: boolean` - no details on why

**Proposed change:**
- `applySuccess: boolean` - explicit success/failure
- `appliedPatches: Patch[]` - actual patches applied
- `rejectedPatches: PatchRejection[]` - rejection details with patchIndex, patch, message

**Files to change:**
1. coreTypes.ts - Add PatchRejection type, update ApplyResult
2. apply.ts - Return rejection details instead of discarding
3. harness.ts - Propagate new fields to StepResult  
4. harnessTypes.ts - Update TurnProgress
5. programmaticFill.ts - Use new fields
6. Tests - Update all affected tests
7. Docs - Update markform-apis.md

**Implementation order (TDD):**
1. Add PatchRejection type and update ApplyResult (test first)
2. Update applyPatches() to return rejection details
3. Update StepResult in coreTypes.ts
4. Update harness.apply() to use new fields
5. Update TurnProgress and programmaticFill
6. Update documentation
