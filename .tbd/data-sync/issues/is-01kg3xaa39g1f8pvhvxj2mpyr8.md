---
close_reason: null
closed_at: 2025-12-28T07:04:41.362Z
created_at: 2025-12-28T03:53:46.517Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.723Z
    original_id: markform-336
id: is-01kg3xaa39g1f8pvhvxj2mpyr8
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 2: Create report CLI command"
type: is
updated_at: 2025-12-28T07:04:41.362Z
version: 1
---
Create commands/report.ts:

Usage:
  markform report <file>
  markform report <file> -o output.report.md

Options:
  -o, --output <file>  Write to file instead of stdout

Behavior:
1. Parse the form file
2. Call serializeReportMarkdown()
3. Output to stdout or file (using deriveReportPath() for extension)

Location: packages/markform/src/cli/commands/report.ts

Also update cli.ts to register the command.
