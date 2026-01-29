---
close_reason: null
closed_at: 2025-12-23T09:25:01.910Z
created_at: 2025-12-23T08:32:09.340Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.049Z
    original_id: markform-bg7
id: is-01kg3x1bvgqzn1dqyp3vhwbjr3
kind: bug
labels: []
parent_id: null
priority: 2
status: closed
title: "ARCH-013: Resolve form_state vs minItems/minSelections inconsistency"
type: is
updated_at: 2025-12-23T09:25:01.910Z
version: 1
---
## Problem
`form_state` derived from counts can diverge from 'required issues' if `minItems`/`minSelections` is set without `required=true`.

## Evidence from Fixtures
In `simple.form.md`:
- `tags` has `minItems=1` but no `required=true`
- `categories` has `minSelections=1` but no `required=true`

## Why It Matters
This leads to inconsistency:
- `inspect` could report a 'required' issue (`min_items_not_met`)
- But `form_state` computed from `requiredFields` count could still show `complete`

## Decision Required
Choose ONE and apply consistently:
1. **Treat `minItems>0` / `minSelections>0` as implicitly required** (affects counts)
2. **Disallow min constraints unless `required=true`** (simplifies everything)
3. **Compute `form_state` from issue severities** instead of counts

## Files to Update
- docs/project/architecture/current/arch-markform-design.md.md (progress computation + required semantics)

## Depends On
- ARCH-008 (explicit checkbox validation)
- ARCH-009 (single-select semantics)
