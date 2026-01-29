---
close_reason: null
closed_at: 2025-12-23T09:07:13.788Z
created_at: 2025-12-23T08:31:10.397Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.691Z
    original_id: markform-1qs
id: is-01kg3xaa35g20h6fa30r1sfqre
kind: bug
labels: []
parent_id: null
priority: 1
status: closed
title: "ARCH-004: InspectIssue needs scope field for group-level validators"
type: is
updated_at: 2025-12-23T09:07:13.788Z
version: 1
---
## Problem
InspectIssue uses `fieldId` but group-level validators exist. The current structure can't properly represent issues from group or form-level validators.

## Why It Matters
- Group-level validators validate across multiple fields
- Form-level validators validate the entire form
- Current `fieldId` property can't represent these scopes

## Recommended Fix
- Rename `fieldId` to `ref` or `targetId`
- Add `scope: 'form' | 'group' | 'field' | 'option'` field
- Allow `QualifiedOptionRef` for option-level issues

## Files to Update
- docs/project/architecture/current/arch-markform-design.md.md (InspectIssue interface)

## Blocks
- markform-bve (1.7 Inspect implementation)
