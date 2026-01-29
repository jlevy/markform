---
close_reason: null
closed_at: 2025-12-28T06:55:22.427Z
created_at: 2025-12-28T03:52:52.656Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.537Z
    original_id: markform-329
id: is-01kg3x1bv60t5rb4qj708dc1z0
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 0: Add unit tests for file type detection and path derivation"
type: is
updated_at: 2025-12-28T06:55:22.427Z
version: 1
---
Add tests for:
- detectFileType() returns correct type for all extensions
- deriveExportPath() strips known extensions and adds new ones
- deriveReportPath() creates .report.md paths

Location: packages/markform/tests/unit/settings.test.ts (new or extend)
