---
close_reason: null
closed_at: 2025-12-29T23:39:23.470Z
created_at: 2025-12-29T23:22:59.788Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.135Z
    original_id: markform-453
id: is-01kg3x1bv9g0n5mxcma87w5zdm
kind: feature
labels: []
parent_id: null
priority: 1
status: closed
title: Node-Free Core Library
type: is
updated_at: 2025-12-29T23:39:23.470Z
version: 1
---
Make markform core library free of Node.js dependencies so it can be used in browser, edge runtime, and other non-Node environments.

**Spec:** docs/project/specs/active/plan-2025-12-29-node-free-core.md

**Problem:**
- `index.ts` imports `node:module` for VERSION
- `settings.ts` imports `node:path` for `getFormsDir()`
- This breaks bundlers in Convex, Cloudflare Workers, browsers, etc.

**Solution:**
1. Move `getFormsDir()` to `cli/lib/paths.ts`
2. Use build-time VERSION injection via tsdown define
3. Add automated guard test to prevent regressions

**Backward Compatibility:** Hard cut - no compatibility needed
