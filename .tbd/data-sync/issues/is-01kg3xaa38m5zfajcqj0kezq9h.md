---
close_reason: null
closed_at: 2025-12-28T05:24:01.190Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.590Z
    original_id: markform-314
id: is-01kg3xaa38m5zfajcqj0kezq9h
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 5.1: Add type field to ExampleDefinition"
type: is
updated_at: 2025-12-28T05:24:01.190Z
version: 1
---
Add type field to distinguish standard vs research examples.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md (Phase 5)

1. Update ExampleDefinition in cli/lib/cliTypes.ts:
   type?: 'standard' | 'research'

2. Add docstring explaining the type field

3. Update exampleRegistry.ts to add type field:
   - startup-deep-research: type: 'research'
   - celebrity-deep-research: type: 'research'
   - simple (and others): type: 'standard' (or omit for default)
