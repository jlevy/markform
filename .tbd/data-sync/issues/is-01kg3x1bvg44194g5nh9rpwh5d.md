---
close_reason: null
closed_at: 2025-12-23T09:32:08.373Z
created_at: 2025-12-23T08:33:04.550Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.242Z
    original_id: markform-s2w
id: is-01kg3x1bvg44194g5nh9rpwh5d
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "PLAN-007: Use optional peer deps for AI integration packaging"
type: is
updated_at: 2025-12-23T09:32:08.373Z
version: 1
---
## Problem
`markform/ai` subpath should not force-install AI SDK dependencies. The monorepo research brief explicitly calls out optional peer deps as a best practice for adapters.

## Why It Matters
- Users who don't use AI features shouldn't install AI SDK
- Reduces bundle size for non-AI use cases
- Follows modern package patterns from research brief

## Recommended Fix
1. Use optional peer dependencies for AI SDK adapters
2. Use subpath exports pattern: `markform/ai-sdk`
3. Document which peer deps are required for each subpath
4. Add install instructions for each integration

## Files to Update
- docs/project/plan/plan-2025-12-22-markform-v01-implementation.md (Phase 4 packaging)

## Blocks
- markform-x39 (Phase 4: Vercel AI SDK Integration)
