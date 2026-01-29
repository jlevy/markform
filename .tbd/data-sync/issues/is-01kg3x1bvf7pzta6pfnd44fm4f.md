---
close_reason: null
closed_at: null
created_at: 2026-01-06T17:57:56.971Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.724Z
    original_id: markform-574
id: is-01kg3x1bvf7pzta6pfnd44fm4f
kind: task
labels: []
parent_id: null
priority: 1
status: open
title: Extract researchHelpers.ts from research.ts
type: is
updated_at: 2026-01-06T17:57:56.971Z
version: 1
---
Extract testable helper functions from research.ts to cli/lib/researchHelpers.ts. Functions to extract: validateResearchModel, parseResearchOptions, formatResearchOutput. This enables unit testing of ~100 lines that are currently untestable.
