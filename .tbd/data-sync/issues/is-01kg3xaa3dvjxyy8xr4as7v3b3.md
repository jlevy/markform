---
close_reason: null
closed_at: null
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
status: open
title: Extract runHelpers.ts from run.ts
type: is
updated_at: 2026-01-06T17:57:53.322Z
version: 1
---
Extract testable helper functions from run.ts to cli/lib/runHelpers.ts. Functions to extract: scanFormsDirectory, enrichFormEntry, buildModelOptions, runAgentFillWorkflow. This enables unit testing of ~350 lines that are currently untestable.
