---
close_reason: null
closed_at: 2025-12-23T09:00:11.677Z
created_at: 2025-12-23T08:30:23.013Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.360Z
    original_id: markform-gv1
id: is-01kg3xaa3fnqtgta297aw3jwkc
kind: bug
labels: []
parent_id: null
priority: 0
status: closed
title: "ARCH-001: Fix idIndex type for field-scoped option IDs"
type: is
updated_at: 2025-12-23T09:00:11.677Z
version: 1
---
## Problem
Option IDs are field-scoped but `ParsedForm.idIndex: Map<Id, IdIndexEntry>` claims to index `kind:'option'` too. Option IDs can repeat across fields, so a global `Map<Id,...>` can't safely index options.

## Why It Matters
- `QualifiedOptionRef = \`${Id}.${OptionId}\`` is defined for external references
- But `idIndex` uses plain `Id` as key, which can't represent qualified refs
- This will cause collisions when multiple fields have options with same local ID

## Recommended Fix
**Option A (recommended):** Separate indices
- `idIndex: Map<Id, IdIndexEntry>` for form/group/field only
- `optionIndex: Map<QualifiedOptionRef, OptionIndexEntry>` for options

**Option B:** Single string-keyed index
- `idIndex: Map<string, IdIndexEntry>` accepting both `Id` and `QualifiedOptionRef`

## Also Fix
- Semantic validation bullet 'Globally-unique IDs across all elements' should exclude options
- Options are only unique within their parent field
- Update ParsedForm interface in architecture doc

## Files to Update
- docs/project/architecture/current/arch-markform-design.md.md

## Blocks
- markform-bmy (1.1 Types and Schemas)
