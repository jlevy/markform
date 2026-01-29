---
close_reason: null
closed_at: 2025-12-23T19:27:53.898Z
created_at: 2025-12-23T17:33:27.787Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.103Z
    original_id: markform-77
id: is-01kg3xaa3e2gmt9n9m9zqapnmy
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "CLI: add systematic --format flag (console/plaintext/yaml/json) across all commands"
type: is
updated_at: 2025-12-23T19:27:53.898Z
version: 1
---
Add consistent output format support across all CLI commands:

**Format options:**
- console: auto-detect TTY, use ANSI colors if available (default)
- plaintext: same as console but no ANSI colors  
- yaml: structured YAML output (existing behavior)
- json: structured JSON output (existing behavior)

**Commands to update:**
- inspect: already has --json, add console/plaintext/yaml
- export: currently JSON only, add other formats
- apply: add format options for result output
- serve: may not need (web-based)
- run: add format for session output

**Implementation:**
- Add shared --format <format> option to relevant commands
- Create output formatter utility
- Respect NO_COLOR and FORCE_COLOR env vars
- picocolors handles TTY detection for console mode
