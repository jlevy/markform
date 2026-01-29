---
close_reason: null
closed_at: 2025-12-25T00:00:00.000Z
created_at: 2025-12-24T23:24:31.089Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.616Z
    original_id: markform-192.3
id: is-01kg3xaa35fc3jd3r53e2wtgrk
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Serializer: Add serialization for url-field and url-list"
type: is
updated_at: 2025-12-25T00:00:00.000Z
version: 1
---
Update serialize.ts:
- serializeUrlField(): Serialize url-field tag with fence value
- serializeUrlListField(): Serialize url-list tag with items in fence
- Update serializeField() switch to handle url and url_list kinds
