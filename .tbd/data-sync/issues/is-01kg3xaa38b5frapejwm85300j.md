---
close_reason: null
closed_at: 2025-12-28T02:37:33.973Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.578Z
    original_id: markform-312
id: is-01kg3xaa38b5frapejwm85300j
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 4.2: Create research.ts CLI command"
type: is
updated_at: 2025-12-28T02:37:33.973Z
version: 1
---
CLI command for research workflow.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md (Phase 4)

Create src/cli/commands/research.ts:

1. Arguments: <form-path> [-- field=value...]
2. Options:
   --model, -m (required, must support web search)
   --initial-values, -i (JSON/YAML file)
   --output, -o (output path)
   --export-formats (form,raw,yaml)
   --max-turns, --max-issues, --max-patches, --max-fields, --max-groups
   --interactive (prompt for missing user fields)
   --verbose, -v

3. Validation:
   - Model must be web-search-capable (fail fast)
   - Form must be valid research form (isResearchForm)

4. Execution:
   - Load and parse form
   - Parse initial values from --initial-values and -- args
   - Call runResearch()
   - Write output using exportMultiFormat()

File I/O handled here at CLI layer, not in core API.
