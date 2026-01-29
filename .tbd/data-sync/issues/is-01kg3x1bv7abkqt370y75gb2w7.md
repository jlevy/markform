---
close_reason: null
closed_at: 2025-12-28T07:07:14.275Z
created_at: 2025-12-28T03:54:28.112Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.610Z
    original_id: markform-342
id: is-01kg3x1bv7abkqt370y75gb2w7
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 3: Add tests for multi-format serve"
type: is
updated_at: 2025-12-28T07:07:14.275Z
version: 1
---
Add integration tests for serve with different file types:

1. .form.md renders interactive form (existing behavior)
2. .raw.md renders read-only markdown
3. .report.md renders read-only markdown
4. .yml renders syntax-highlighted YAML
5. .json renders syntax-highlighted JSON
6. /save endpoint returns error for non-form files

Location: packages/markform/tests/integration/serve.test.ts (new or extend)
