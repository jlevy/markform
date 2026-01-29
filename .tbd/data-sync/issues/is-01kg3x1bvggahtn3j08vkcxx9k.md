---
close_reason: null
closed_at: 2025-12-23T16:36:32.948Z
created_at: 2025-12-23T07:18:37.565Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.208Z
    original_id: markform-n3l
id: is-01kg3x1bvggahtn3j08vkcxx9k
kind: epic
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 2: Web UI (serve) and Basic CLI"
type: is
updated_at: 2025-12-23T16:41:39.886Z
version: 1
---
Enable browsing forms via web UI and basic CLI inspection.

Sub-tasks:
2.1 CLI Infrastructure (cli/)
2.2 Inspect Command (cli/commands/inspect.ts)
2.3 Export Command (cli/commands/export.ts)
2.4 Serve Command (cli/commands/serve.ts)

Checkpoints (automated):
- markform inspect outputs valid YAML
- markform export outputs valid JSON
- CLI integration tests pass

Checkpoints (manual):
- User verifies serve renders form correctly in browser
- User verifies Save button works with versioned filenames
