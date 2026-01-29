---
close_reason: null
closed_at: 2025-12-25T00:00:00.000Z
created_at: 2025-12-24T23:24:45.154Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.501Z
    original_id: markform-192.6
id: is-01kg3x1bv2z653pm2gakx828cn
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Apply: Handle applying URL patches in applyPatch()"
type: is
updated_at: 2025-12-25T00:00:00.000Z
version: 1
---
Update apply.ts (or wherever applyPatch is):
- Handle 'set_url' patch: validate field kind is 'url', set value
- Handle 'set_url_list' patch: validate field kind is 'url_list', set items
- URL format validation on apply (before accepting value)
