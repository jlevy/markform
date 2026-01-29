---
close_reason: Coverage config properly excludes node_modules via include pattern (src/**/*.ts) and explicit exclude list in vitest.config.ts:11-35
closed_at: 2026-01-29T06:34:50.809Z
created_at: 2026-01-06T17:57:38.174Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.921Z
    original_id: markform-571
id: is-01kg3xaa3djqd49t0f5nr4a4s2
kind: bug
labels: []
parent_id: null
priority: 0
status: closed
title: Fix coverage configuration (exclude node_modules)
type: is
updated_at: 2026-01-29T06:34:50.810Z
version: 2
---
The c8 configuration includes '--include dist/**' which pulls in transpiled node_modules. This inflates reported coverage by ~7,400 lines. Fix by excluding node_modules or switching to vitest's built-in coverage.
