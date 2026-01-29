---
close_reason: null
closed_at: 2025-12-23T23:50:11.580Z
created_at: 2025-12-23T22:14:35.105Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.113Z
    original_id: markform-119
id: is-01kg3xaa33xybnqk3rfb9wxebm
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: "FILL-001: Add models command for model discovery"
type: is
updated_at: 2025-12-23T23:50:11.580Z
version: 1
---
Add a new CLI subcommand to list available models from the registry.

**Usage:**
```bash
markform models              # List all available models
markform models --provider anthropic  # Filter by provider
```

**Benefits:**
- Single source of truth for model availability
- Docs don't drift from code
- Can add test that asserts docs' 'Supported Models' table matches MODEL_REGISTRY

**Files:**
- packages/markform/src/cli/commands/models.ts (new)
- packages/markform/src/cli/cli.ts (register command)
- packages/markform/src/harness/modelResolver.ts (expose registry)
