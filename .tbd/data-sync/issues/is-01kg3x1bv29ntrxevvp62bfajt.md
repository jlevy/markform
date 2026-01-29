---
close_reason: null
closed_at: 2025-12-24T21:40:30.841Z
created_at: 2025-12-24T21:26:56.939Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.441Z
    original_id: markform-189
id: is-01kg3x1bv29ntrxevvp62bfajt
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Create cli/lib/cliTypes.ts and extract types
type: is
updated_at: 2025-12-24T21:40:30.841Z
version: 1
---
Create cli/lib/cliTypes.ts and extract CLI types.

Extract from:
- shared.ts: OutputFormat, CommandContext
- exportHelpers.ts: ExportResult
- examples/index.ts: ExampleDefinition

Update imports in CLI command files.
