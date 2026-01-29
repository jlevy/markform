---
close_reason: runHelpers.ts extracted to src/cli/lib/runHelpers.ts
closed_at: 2026-01-29T06:35:23.085Z
created_at: 2026-01-06T17:57:53.322Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.932Z
    original_id: markform-573
id: is-01kg3xaa3dvjxyy8xr4as7v3b3
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Extract runHelpers.ts from run.ts
type: is
updated_at: 2026-01-29T06:35:23.086Z
version: 2
---
Extract testable helper functions from run.ts to cli/lib/runHelpers.ts. Functions to extract: scanFormsDirectory, enrichFormEntry, buildModelOptions, runAgentFillWorkflow. This enables unit testing of ~350 lines that are currently untestable.
