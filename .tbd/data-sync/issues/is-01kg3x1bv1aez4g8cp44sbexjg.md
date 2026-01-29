---
close_reason: null
closed_at: 2025-12-24T01:14:38.274Z
created_at: 2025-12-24T00:50:51.556Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.122Z
    original_id: markform-143
id: is-01kg3x1bv1aez4g8cp44sbexjg
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Change versioned output suffix from -v1 to -filled1
type: is
updated_at: 2025-12-24T01:14:38.274Z
version: 1
---
Change the versioned output suffix for filled form files from `-v1`, `-v2`, etc. to `-filled1`, `-filled2`, etc.

## Rationale
- Clearer naming: `simple-filled1.form.md` is more descriptive than `simple-v1.form.md`
- Avoids confusion with other versioning schemes
- Allows distinct names while preventing overwrites

## Files to Update
- `packages/markform/src/cli/lib/versioning.ts` - Change suffix pattern from `-v` to `-filled`
- Tests in `packages/markform/tests/unit/cli/versioning.test.ts`
- Any documentation mentioning the `-v1` pattern

## Example
Before: `simple.form.md` → `simple-v1.form.md` → `simple-v2.form.md`
After: `simple.form.md` → `simple-filled1.form.md` → `simple-filled2.form.md`
