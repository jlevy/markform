---
close_reason: null
closed_at: 2025-12-23T09:24:41.861Z
created_at: 2025-12-23T08:32:08.590Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.467Z
    original_id: markform-ufu
id: is-01kg3xaa3f4pavt2zkj456xrfy
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "ARCH-012: Define policy for non-Markform nodes in forms"
type: is
updated_at: 2025-12-23T09:24:41.861Z
version: 1
---
## Problem
Spec doesn't say what happens to non-Markform nodes (comments, headings, plain text between tags). The company form uses separators that may not be preserved.

## Why It Matters
- `earnings-analysis.form.md` uses `{# PART ... #}` separators
- Parser likely ignores them, but serializer behavior is unspecified
- Could cause silent data loss on round-trip

## Decision Required
Explicitly state ONE of:
1. Non-markform nodes are forbidden (parse error)
2. Non-markform nodes are allowed but discarded on canonical serialize
3. Non-markform nodes are allowed and preserved verbatim (requires raw slicing)

## Recommendation for v0.1
- Allow HTML comments only (`<!-- ... -->`)
- Ignore/error on other arbitrary content
- Don't promise preservation beyond doc blocks

## Files to Update
- docs/project/architecture/current/arch-markform-design.md.md

## Depends On
- ARCH-007 (need to decide comment syntax first)
