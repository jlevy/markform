---
close_reason: null
closed_at: 2025-12-25T00:00:00.000Z
created_at: 2025-12-24T23:24:35.142Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.621Z
    original_id: markform-192.4
id: is-01kg3xaa357nzt8vhk6dtyp8pe
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Validator: Add URL format validation"
type: is
updated_at: 2025-12-25T00:00:00.000Z
version: 1
---
Update validate.ts:
- URL_PATTERN: Regex for http/https URLs
- validateUrlField(): Check URL format
- validateUrlListField(): Check minItems, maxItems, uniqueItems, format for each item
- Update field validation switch to handle url and url_list kinds
