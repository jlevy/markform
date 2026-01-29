---
close_reason: null
closed_at: 2026-01-04T01:57:20.542Z
created_at: 2026-01-02T23:36:11.109Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.727Z
    original_id: markform-520
id: is-01kg3xaa3c6n8r4d5vap22kj65
kind: feature
labels: []
parent_id: null
priority: 3
status: closed
title: "tryscript: Add binName option to specify command name"
type: is
updated_at: 2026-01-04T01:57:20.542Z
version: 1
---
Separate the binary path from the command name used in tests.

**Current limitation:**
The command name must match the binary filename (e.g., `bin.mjs`).

**Proposed:**
```yaml
---
bin: ./dist/bin.mjs
binName: markform
---
$ markform --help
```

When a command starts with `binName`, replace it with the resolved `bin` path.

This allows writing natural commands (`markform --help`) while the framework handles path resolution.

Reference: docs/project/specs/active/plan-2026-01-02-tryscript-cli-testing.md
