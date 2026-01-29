---
close_reason: null
closed_at: 2025-12-29T23:37:57.600Z
created_at: 2025-12-29T23:23:29.625Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.343Z
    original_id: markform-460
id: is-01kg3xaa3bp0gz7aqp37n96hvj
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Create node-free-core.test.ts guard test
type: is
updated_at: 2025-12-29T23:37:57.600Z
version: 1
---
Create `tests/unit/node-free-core.test.ts`:

Automated test that fails if Node.js dependencies leak into core:
1. Source-level: Scan src/ for node: imports outside cli/
2. Build-level: Verify dist/index.mjs and dist/ai-sdk.mjs have no node: refs
3. VERSION verification: Confirm built VERSION matches package.json

This prevents future regressions and ensures release process works correctly.

**Ref:** markform-453
