---
close_reason: null
closed_at: 2025-12-24T21:51:55.917Z
created_at: 2025-12-24T21:31:31.381Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.583Z
    original_id: markform-191
id: is-01kg3xaa3527rwjkps49xf5k79
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: Rename cli/examples/index.ts to exampleRegistry.ts
type: is
updated_at: 2025-12-24T21:51:55.917Z
version: 1
---
Rename src/cli/examples/index.ts to exampleRegistry.ts. The file contains actual logic (ExampleDefinition interface, EXAMPLE_DEFINITIONS array, loadExampleContent function) - not a re-export barrel. Per typescript-rules.md: Avoid non-descriptive index.ts names for source modules.
