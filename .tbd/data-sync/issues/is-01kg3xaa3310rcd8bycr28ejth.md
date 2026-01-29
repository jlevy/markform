---
close_reason: null
closed_at: 2025-12-24T05:34:32.903Z
created_at: 2025-12-23T22:15:04.132Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.135Z
    original_id: markform-123
id: is-01kg3xaa3310rcd8bycr28ejth
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "TEST-001: Add unit tests for doc block and validation edge cases"
type: is
updated_at: 2025-12-24T05:34:32.903Z
version: 1
---
Add unit tests for edge cases identified in architecture review.

**Test cases:**
- Doc block uniqueness with defaulted `kind`
- `process=false` emission tests (emits when value contains `{%`, doesn't emit otherwise)
- Patch structural validation rejects unknown option IDs
- Patch batch rejection is transactional (all or nothing)

**Files:**
- packages/markform/tests/unit/

**Linked:** Blocks markform-110 (Review coverage reports and improve test coverage)
