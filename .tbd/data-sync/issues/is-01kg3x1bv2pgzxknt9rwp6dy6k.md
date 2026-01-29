---
close_reason: null
closed_at: 2025-12-25T00:00:00.000Z
created_at: 2025-12-24T23:24:26.871Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.480Z
    original_id: markform-192.2
id: is-01kg3x1bv2pgzxknt9rwp6dy6k
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Parser: Add parsing for url-field and url-list tags"
type: is
updated_at: 2025-12-25T00:00:00.000Z
version: 1
---
Update parse.ts:
- parseUrlField(): Parse url-field tag, extract fence value
- parseUrlListField(): Parse url-list tag with minItems/maxItems/uniqueItems
- Update parseField() switch to handle 'url-field' and 'url-list'
- URL value extraction from fence content (same as string-field)
