---
close_reason: null
closed_at: 2025-12-31T07:14:21.179Z
created_at: 2025-12-29T23:52:23.650Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.348Z
    original_id: markform-461
id: is-01kg3xaa3bk4f0p46phstfnvms
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: "Spec: Examples & Run Commands Redesign"
type: is
updated_at: 2025-12-31T07:14:21.179Z
version: 1
---
Redesign the examples command to be copy-only, add new run command for browsing and running forms, add status command for form inspection per-role, and introduce run_mode to frontmatter schema.

**Spec:** docs/project/specs/active/plan-2025-12-29-examples-run-commands.md

**Key Changes:**
- examples command: copy-only (no interactive flow)
- run command: new interactive launcher with menu
- status command: per-role form status display
- run_mode frontmatter field for explicit execution mode
- Global --overwrite option

**Implementation Order (per spec):**
1. Global options: Add --overwrite to cli.ts
2. Schema: Add RunMode type and runMode to FormMetadata
3. Parser: Parse and validate run_mode from frontmatter
4. Validation: run_mode vs form structure validation
5. status command
6. examples refactor (copy-only)
7. run command (menu + execution)
8. Migrate bundled examples
9. Update documentation
