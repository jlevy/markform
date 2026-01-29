---
close_reason: null
closed_at: 2025-12-28T07:04:41.362Z
created_at: 2025-12-28T03:53:52.516Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.728Z
    original_id: markform-337
id: is-01kg3xaa394pr26tkmdbrynvgk
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 2: Add tests for report command and serialization"
type: is
updated_at: 2025-12-28T07:04:41.362Z
version: 1
---
Add tests for:
1. serializeReportMarkdown() excludes instructions by default
2. serializeReportMarkdown() includes instructions when option set
3. Elements with report=false are excluded
4. Elements with explicit report=true are included
5. Report command outputs to stdout
6. Report command writes to file with -o flag

Location: packages/markform/tests/unit/serialize.test.ts (extend)
Location: packages/markform/tests/unit/cli/report.test.ts (new)
