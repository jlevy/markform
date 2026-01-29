---
close_reason: null
closed_at: 2025-12-24T07:00:00.498Z
created_at: 2025-12-24T06:17:39.900Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.194Z
    original_id: markform-150
id: is-01kg3x1bv1awq1ty4nsze3cdhb
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: Implement examples CLI command
type: is
updated_at: 2025-12-24T07:00:00.498Z
version: 1
---
Implement the `examples` CLI command per plan-2025-12-23-examples-cli-command.md.

This command provides a menu-driven console UI for users to discover and scaffold example forms into their current working directory.

**Key Features:**
- Interactive selection menu with 3 bundled examples
- Editable filename prompt (pre-filled with default)
- Overwrite confirmation if file exists
- Display suggested next commands after writing
- `--list` flag for non-interactive listing
- `--name <example>` flag to skip selection

**Prerequisites:** Role System (done), Interactive Fill Mode (done), Political Research Example Form (needs to be created)
