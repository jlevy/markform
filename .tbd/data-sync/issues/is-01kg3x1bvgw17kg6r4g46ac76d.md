---
close_reason: null
closed_at: 2025-12-23T09:31:38.290Z
created_at: 2025-12-23T08:33:01.243Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.161Z
    original_id: markform-jvy
id: is-01kg3x1bvgw17kg6r4g46ac76d
kind: bug
labels: []
parent_id: null
priority: 1
status: closed
title: "PLAN-003: Align plan with architecture on process=false emission"
type: is
updated_at: 2025-12-23T09:31:38.290Z
version: 1
---
## Problem
Plan instructs 'Ensure `process=false` on all value fences' but architecture says emit `process=false` only when the value contains Markdoc syntax (`{%` sequences).

## Why It Matters
- Creates spec conflict between plan and architecture
- Golden fixtures could fight the actual spec
- Implementers won't know which rule to follow

## Recommended Fix
1. Update plan to match architecture: emit `process=false` only when value contains Markdoc syntax
2. Add test cases for both scenarios (with and without Markdoc syntax in values)
3. Ensure golden fixtures reflect the conditional emission rule

## Files to Update
- docs/project/plan/plan-2025-12-22-markform-v01-implementation.md

## Depends On
- ARCH-007 (comment syntax decision affects what triggers process=false)
