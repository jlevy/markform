---
close_reason: null
closed_at: 2025-12-29T04:33:44.886Z
created_at: 2025-12-29T04:28:48.913Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.076Z
    original_id: markform-435
id: is-01kg3x1bv850tn37rm72xkmkkk
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 2: Update CLI commands"
type: is
updated_at: 2025-12-29T04:33:44.886Z
version: 1
---
Update CLI path resolution for renamed files and add apis command.

**Tasks:**
- Update packages/markform/src/cli/commands/docs.ts: path to markform-reference.md
- Update packages/markform/src/cli/commands/spec.ts: path to markform-spec.md
- Create packages/markform/src/cli/commands/apis.ts (copy pattern from docs.ts)
- Register `apis` command in packages/markform/src/cli/cli.ts

**Ref:** markform-433
