---
close_reason: null
closed_at: 2025-12-29T23:35:09.468Z
created_at: 2025-12-29T23:23:25.651Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.310Z
    original_id: markform-454
id: is-01kg3xaa3beq29cma48hbwszx0
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Create cli/lib/paths.ts with getFormsDir()
type: is
updated_at: 2025-12-29T23:35:09.468Z
version: 1
---
Create new file `src/cli/lib/paths.ts` with:
- `DEFAULT_FORMS_DIR` constant
- `getFormsDir()` function using `node:path` resolve

This isolates Node.js path utilities to CLI-only code.

**Ref:** markform-453
