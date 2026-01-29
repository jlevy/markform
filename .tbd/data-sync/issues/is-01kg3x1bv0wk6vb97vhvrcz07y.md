---
close_reason: null
closed_at: 2025-12-23T22:11:11.144Z
created_at: 2025-12-23T21:51:02.502Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:02.958Z
    original_id: markform-112
id: is-01kg3x1bv0wk6vb97vhvrcz07y
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Update CLI documentation to include dump command
type: is
updated_at: 2025-12-23T22:11:11.144Z
version: 1
---
Update all CLI documentation to include the new dump command.

## Files to Update
- `docs/cli.md` - Add dump command section with usage examples
- `README.md` - Add dump to CLI commands list (if applicable)
- Any other relevant docs

## Content to Add
- Command syntax: `markform dump <file> [--format=<fmt>]`
- Output format options (console, plaintext, yaml, json)
- Example output for each format
- Use cases (quick value extraction, scripting, integration)

## Depends On
- markform-111 (Add dump command for extracting form values)
