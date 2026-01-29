---
close_reason: null
closed_at: 2025-12-24T06:54:01.942Z
created_at: 2025-12-24T06:18:06.084Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.345Z
    original_id: markform-153
id: is-01kg3xaa341baanff91h8fs0s5
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Implement examples command with interactive selection
type: is
updated_at: 2025-12-24T06:54:01.942Z
version: 1
---
Create src/cli/commands/examples.ts with interactive menu.

Features to implement:
1. Interactive selection using @clack/prompts.select()
2. Filename prompt using @clack/prompts.text() with default value
3. File existence check and overwrite confirmation using @clack/prompts.confirm()
4. Success message with three-step workflow (interactive fill, agent fill, dump)
5. --list flag for non-interactive listing
6. --name <example> flag to skip selection (still prompts for filename)
7. Register command in src/cli/cli.ts

Dependencies: @clack/prompts (installed), picocolors (installed), fs/promises
