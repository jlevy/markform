---
close_reason: null
closed_at: 2025-12-29T03:29:41.138Z
created_at: 2025-12-29T02:38:44.775Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.056Z
    original_id: markform-431
id: is-01kg3x1bv89w9k55w03kkyev8p
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Add error case tests for unified field syntax
type: is
updated_at: 2025-12-29T03:29:41.138Z
version: 1
---
Add new unit tests for parser error cases.

**Tests to add in parse.test.ts:**
- `{% field %}` without `kind` produces ParseError
- `{% field kind="invalid" %}` produces ParseError with valid kinds list
- Each legacy tag produces ParseError with migration hint:
  - `{% string-field %}` → error with `Use {% field kind="string" %}`
  - `{% number-field %}` → error with `Use {% field kind="number" %}`
  - (all 11 legacy tags)

**Location:** packages/markform/tests/unit/engine/parse.test.ts
