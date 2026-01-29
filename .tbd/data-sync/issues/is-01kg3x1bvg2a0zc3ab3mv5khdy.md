---
close_reason: null
closed_at: 2025-12-23T15:17:31.006Z
created_at: 2025-12-23T07:20:20.336Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.135Z
    original_id: markform-g3k
id: is-01kg3x1bvg2a0zc3ab3mv5khdy
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: 2.1 CLI Infrastructure (cli/)
type: is
updated_at: 2025-12-23T15:17:40.827Z
version: 1
---
Create CLI infrastructure per TypeScript CLI Rules:
- bin.ts entry point with commander setup
- lib/colors.ts (picocolors wrapper)
- lib/shared.ts (context helpers, debug, dry-run)
- lib/formatting.ts (output formatting)
- Global options: --verbose, --quiet, --dry-run
- Colored help text
