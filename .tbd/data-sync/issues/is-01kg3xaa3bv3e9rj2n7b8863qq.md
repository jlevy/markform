---
close_reason: null
closed_at: 2025-12-30T00:18:01.496Z
created_at: 2025-12-29T23:57:58.593Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.354Z
    original_id: markform-462
id: is-01kg3xaa3bv3e9rj2n7b8863qq
kind: feature
labels: []
parent_id: null
priority: 1
status: closed
title: Examples/Run/Status CLI Redesign
type: is
updated_at: 2025-12-30T00:18:01.496Z
version: 1
---
Implement the examples/run/status CLI redesign per plan-2025-12-29-examples-run-commands.md

**Goals:**
1. Separate concerns: `examples` copies, `run` executes
2. Enable users to browse and run their own forms
3. Provide per-role status information via `status` command
4. Explicit `run_mode` in frontmatter
5. Consistent global options: `--forms-dir`, `--overwrite`

**Spec:** docs/project/specs/active/plan-2025-12-29-examples-run-commands.md
