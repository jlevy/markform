---
close_reason: null
closed_at: 2025-12-28T06:57:11.636Z
created_at: 2025-12-28T03:53:03.957Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.543Z
    original_id: markform-330
id: is-01kg3x1bv69asxe120z1n9vnn0
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 1: Update dump command to use toStructuredValues()"
type: is
updated_at: 2025-12-28T06:57:11.636Z
version: 1
---
Update dump.ts to use toStructuredValues() from exportHelpers.ts.

Current state: dump.ts has local toPlainValue() function (lines 80-101) that duplicates logic and only includes answered fields.

Changes needed:
1. Import toStructuredValues from exportHelpers.ts
2. Remove local toPlainValue() function
3. Use toStructuredValues() for YAML/JSON output
4. Ensure all fields are included with their states (answered, skipped, unanswered)

Location: packages/markform/src/cli/commands/dump.ts
