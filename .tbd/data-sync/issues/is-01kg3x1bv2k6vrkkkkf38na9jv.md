---
close_reason: null
closed_at: 2025-12-25T00:00:00.000Z
created_at: 2025-12-24T23:25:08.328Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.468Z
    original_id: markform-192.10
id: is-01kg3x1bv2k6vrkkkkf38na9jv
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Golden test: E2E session test for startup-deep-research form"
type: is
updated_at: 2025-12-25T00:00:00.000Z
version: 1
---
Create golden session test:
- tests/golden/sessions/startup-deep-research.session.yaml
- Test mock agent filling the startup research form
- Verify URL validation catches invalid URLs
- Verify round-trip serialization preserves URLs
- Test that url-list items are properly stored and retrieved
