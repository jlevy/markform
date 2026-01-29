---
close_reason: null
closed_at: 2025-12-29T23:36:30.687Z
created_at: 2025-12-29T23:23:27.136Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.324Z
    original_id: markform-456
id: is-01kg3xaa3b6c626abc83jdnhpg
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Update CLI imports to use paths.ts
type: is
updated_at: 2025-12-29T23:36:30.687Z
version: 1
---
Update imports in CLI commands:
- `src/cli/commands/fill.ts`: import getFormsDir from '../lib/paths.js'
- `src/cli/commands/research.ts`: import getFormsDir from '../lib/paths.js'
- `src/cli/commands/examples.ts`: import getFormsDir from '../lib/paths.js'
- `src/cli/cli.ts`: import DEFAULT_FORMS_DIR from './lib/paths.js'

**Ref:** markform-453
