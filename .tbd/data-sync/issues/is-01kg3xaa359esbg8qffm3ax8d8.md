---
close_reason: null
closed_at: 2025-12-25T00:00:00.000Z
created_at: 2025-12-24T23:24:54.501Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.642Z
    original_id: markform-192.8
id: is-01kg3xaa359esbg8qffm3ax8d8
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Unit tests: URL field parsing, serialization, validation"
type: is
updated_at: 2025-12-25T00:00:00.000Z
version: 1
---
Create/update tests:
- tests/unit/parse.test.ts: Test parseUrlField, parseUrlListField
- tests/unit/serialize.test.ts: Test URL field serialization round-trip
- tests/unit/validate.test.ts: Test URL format validation
- Test edge cases: empty values, invalid URLs, minItems/maxItems
