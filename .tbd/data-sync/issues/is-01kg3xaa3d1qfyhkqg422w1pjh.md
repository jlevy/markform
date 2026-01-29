---
close_reason: null
closed_at: 2026-01-05T22:10:44.456Z
created_at: 2026-01-03T21:22:56.207Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.866Z
    original_id: markform-560
id: is-01kg3xaa3d1qfyhkqg422w1pjh
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "[527-3] Configure and generate golden session test"
type: is
updated_at: 2026-01-05T22:10:44.456Z
version: 1
---
Phase 2: Configure golden session

- Add coercion-test to scripts/regen-golden-sessions.ts
- Run pnpm test:golden:regen to generate session file
- Verify session captures all coercion warnings
- Verify wire format shows coerced values (not originals)

Part of markform-551 implementation.
