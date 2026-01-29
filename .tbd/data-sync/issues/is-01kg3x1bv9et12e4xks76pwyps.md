---
close_reason: null
closed_at: 2025-12-30T00:18:01.496Z
created_at: 2025-12-29T23:58:48.700Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.209Z
    original_id: markform-467
id: is-01kg3x1bv9et12e4xks76pwyps
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Implement status command with per-role stats
type: is
updated_at: 2025-12-30T00:18:01.496Z
version: 1
---
Create new `markform status` command for form fill status with per-role breakdown.

**Usage:**
```bash
markform status form.md        # Summary + per-role stats
markform status form.md --json # Machine-readable
```

**Output:**
- Overall: N/M fields filled (X%)
- Breakdown by answer state (complete, empty, skipped, aborted)
- By Role: per-role counts
- Run Mode: explicit/inferred + source
- Suggested command

**Implementation:**
- Create StatusReport interface
- Compute per-role stats by iterating fields and grouping by field.role
- Format console output with colors
- Support --json for machine-readable output

**Files:**
- packages/markform/src/cli/commands/status.ts (new)
- packages/markform/src/cli/cli.ts (register)

**Ref:** markform-462
