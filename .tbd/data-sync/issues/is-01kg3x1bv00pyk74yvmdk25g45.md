---
close_reason: null
closed_at: 2025-12-23T21:52:39.835Z
created_at: 2025-12-23T21:14:59.421Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:02.900Z
    original_id: markform-102
id: is-01kg3x1bv00pyk74yvmdk25g45
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Extract versioned filename logic into cli/lib/versioning.ts
type: is
updated_at: 2025-12-23T21:52:39.835Z
version: 1
---
Extract the versioned filename logic into a shared utility for use across fill, render, and serve commands.

**Location:** `cli/lib/versioning.ts`

**Functionality:**
- `generateVersionedFilename(basePath: string): string` - finds next available version
- Pattern: `name.form.md` → `name-v1.form.md`, `name-v2.form.md`, etc.
- Detect existing version suffix (`-vN`, `_vN`, ` vN`) and increment
- Check filesystem for existing files to avoid conflicts

**Consumers:**
- `fill` command (default output)
- `render` command (HTML output naming)
- `serve` command (save button)

**Tests:**
- `form.form.md` → `form-v1.form.md`
- `form-v1.form.md` → `form-v2.form.md`
- `form-v99.form.md` → `form-v100.form.md`

**Part of:** markform-101 (fill command)
