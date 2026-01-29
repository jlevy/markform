---
close_reason: null
closed_at: 2025-12-23T19:43:33.314Z
created_at: 2025-12-23T19:38:54.801Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.195Z
    original_id: markform-87
id: is-01kg3xaa3e8jx3cpntrebvrhdx
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Replace --json flag with --format=json consistently across all commands
type: is
updated_at: 2025-12-23T19:43:33.314Z
version: 1
---
Remove the standalone `--json` flag from all CLI commands and standardize on `--format=json` (and `--format=yaml`, etc.) everywhere.

**What needs to change:**
1. Audit all CLI commands for `--json` flag usage
2. Replace with `--format` option supporting json/yaml/etc.
3. Update architecture docs to reflect the consistent `--format` pattern
4. Ensure help text and examples use `--format=json` not `--json`

**Rationale:**
- Consistency: `--format` is more flexible and extensible
- Already using `--format` in some places (e.g., `run` command)
- Single pattern is easier to document and remember
