---
close_reason: null
closed_at: 2025-12-29T03:29:41.138Z
created_at: 2025-12-29T02:38:40.165Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.026Z
    original_id: markform-426
id: is-01kg3x1bv8b4ja53scfpxfn328
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Migrate form files to unified field syntax
type: is
updated_at: 2025-12-29T03:29:41.138Z
version: 1
---
Convert all `.form.md` files to new unified syntax using parse → serialize.

**Files to migrate:**
- `packages/markform/examples/**/*.form.md` (10+ template files)
- `packages/markform/examples/**/*-filled*.form.md` (filled files auto-update)
- `forms/*.form.md` (12 files)
- `*.form.md` in repo root (7 files)
- `attic/**/*.form.md` (7 files, low priority)

**Session files to update:**
- `packages/markform/examples/simple/simple.session.yaml`
- `packages/markform/examples/simple/simple-with-skips.session.yaml`

**Approach:** Run serializer on each file after Phase 1 is complete.

**Post-migration:** Regenerate golden tests: `pnpm --filter markform test:golden:regen`
