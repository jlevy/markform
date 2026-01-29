---
close_reason: null
closed_at: 2025-12-23T09:24:31.833Z
created_at: 2025-12-23T08:32:07.755Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.332Z
    original_id: markform-d5y
id: is-01kg3xaa3fexepggwjb9x106a0
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "ARCH-011: Separate input vs output frontmatter schema"
type: is
updated_at: 2025-12-23T09:24:31.833Z
version: 1
---
## Problem
Frontmatter schema shown as required (`formSummary`, `formProgress`, `formState`) but example input forms only provide `markform_version`.

## Why It Matters
- Input forms (templates) should have minimal frontmatter
- Output forms (after processing) include derived metadata
- Current spec conflates these two schemas

## Recommended Fix
Separate schemas:
- **Input frontmatter:** `markform_version` (required), optional user metadata
- **Output frontmatter:** Adds `formSummary`, `formProgress`, `formState` (derived on serialize)

## Files to Update
- docs/project/architecture/current/arch-markform-design.md.md (Frontmatter section)
