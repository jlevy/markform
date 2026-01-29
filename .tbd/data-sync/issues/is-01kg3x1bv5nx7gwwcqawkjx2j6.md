---
close_reason: null
closed_at: 2025-12-28T05:23:28.437Z
created_at: 2025-12-28T00:45:14.907Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.294Z
    original_id: markform-271
id: is-01kg3x1bv5nx7gwwcqawkjx2j6
kind: feature
labels: []
parent_id: null
priority: 1
status: closed
title: "Forms directory feature: centralize all form output to configurable forms/ directory"
type: is
updated_at: 2025-12-28T05:23:28.437Z
version: 1
---
Add a configurable forms directory (default ./forms) as the parent directory for all form output. CLI commands (examples, fill) and APIs should write forms, YAML exports, and raw markdown to this directory. The directory should be auto-created if missing and gitignored in this repo.
