---
close_reason: null
closed_at: 2025-12-29T23:35:47.880Z
created_at: 2025-12-29T23:23:26.526Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.144Z
    original_id: markform-455
id: is-01kg3x1bv9pr773pjzh02sggvt
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Remove node:path from settings.ts
type: is
updated_at: 2025-12-29T23:35:47.880Z
version: 1
---
Update `src/settings.ts`:
- Remove `import { resolve } from 'node:path'`
- Remove `getFormsDir()` function
- Remove `DEFAULT_FORMS_DIR` constant (moved to paths.ts)

After this change, settings.ts will be pure TypeScript with no Node.js deps.

**Ref:** markform-453
