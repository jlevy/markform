---
close_reason: null
closed_at: 2025-12-25T00:00:00.000Z
created_at: 2025-12-24T23:24:54.501Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.514Z
    original_id: markform-192.8
id: is-01kg3x1bv2k9ff3zr8ha2ftm26
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
