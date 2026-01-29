---
close_reason: null
closed_at: 2025-12-23T09:24:31.826Z
created_at: 2025-12-23T08:32:06.948Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.132Z
    original_id: markform-25g
id: is-01kg3x1bv5ys1j72esmjpgxfb4
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "ARCH-010: Resolve canonical formatting vs fixture blank line conflict"
type: is
updated_at: 2025-12-23T09:24:31.826Z
version: 1
---
## Problem
Canonical formatting rule says 'no blank lines between fields' but fixtures (`simple.form.md`, `simple-mock-filled.form.md`) use blank lines between tags.

## Why It Matters
- Plan relies on golden fixtures and deterministic formatting
- If canonical output removes all blank lines, fixtures won't match unless regenerated
- This could cause spurious test failures

## Recommended Fix
Choose ONE approach:
- **Option A (recommended):** Loosen canonical formatting to allow ONE blank line between adjacent blocks (improves readability)
- **Option B:** Keep strict compaction, regenerate all fixtures to match, document as 'canonical expected output'

## Files to Update
- docs/project/architecture/current/arch-markform-design.md.md (Canonical Serialization section)
- Possibly: test fixture files if keeping strict formatting

## Blocks
- markform-1hn (1.3 Canonical Serialization)
