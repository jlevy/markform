---
close_reason: researchHelpers.ts extracted to src/cli/lib/researchHelpers.ts
closed_at: 2026-01-29T06:35:24.124Z
created_at: 2026-01-06T17:57:56.971Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.938Z
    original_id: markform-574
id: is-01kg3xaa3dx9zgsd37qpn7fzpk
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Extract researchHelpers.ts from research.ts
type: is
updated_at: 2026-01-29T06:35:24.125Z
version: 2
---
Extract testable helper functions from research.ts to cli/lib/researchHelpers.ts. Functions to extract: validateResearchModel, parseResearchOptions, formatResearchOutput. This enables unit testing of ~100 lines that are currently untestable.
