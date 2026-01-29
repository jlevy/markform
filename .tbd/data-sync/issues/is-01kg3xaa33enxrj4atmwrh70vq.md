---
close_reason: null
closed_at: 2025-12-23T21:54:26.664Z
created_at: 2025-12-23T21:40:20.125Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.057Z
    original_id: markform-108
id: is-01kg3xaa33enxrj4atmwrh70vq
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: CLI help should show general flags alongside subcommand-specific flags
type: is
updated_at: 2025-12-23T21:54:26.664Z
version: 1
---
When running `markform export --help`, it should show:
1. General flags that apply to the subcommand (e.g., --no-color, --quiet)
2. Subcommand-specific flags (e.g., --format for export)

**Research needed:**
- How to handle `markdown` as a format option for export (makes sense there)
- Other commands only support console/plaintext/yaml/json - not markdown
- Need a clean way to define format options per-command

**Current behavior:** Unknown - needs investigation
**Expected behavior:** Help shows all applicable flags grouped appropriately
