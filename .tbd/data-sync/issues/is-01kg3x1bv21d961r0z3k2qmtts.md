---
close_reason: null
closed_at: 2025-12-24T21:50:10.377Z
created_at: 2025-12-24T21:31:29.240Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.447Z
    original_id: markform-190
id: is-01kg3x1bv21d961r0z3k2qmtts
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: Remove dead harness/index.ts barrel file
type: is
updated_at: 2025-12-24T21:50:10.377Z
version: 1
---
Delete src/harness/index.ts - a barrel re-export file that nobody imports. All consumers (src/index.ts and CLI commands) import directly from source files like ./harness/harness.js. Zero imports use the barrel. Per typescript-rules.md: Avoid re-exporting unless for library consumers.
