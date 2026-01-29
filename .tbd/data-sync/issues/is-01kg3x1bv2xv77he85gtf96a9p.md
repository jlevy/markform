---
close_reason: null
closed_at: 2025-12-25T00:00:00.000Z
created_at: 2025-12-24T23:24:22.119Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.463Z
    original_id: markform-192.1
id: is-01kg3x1bv2xv77he85gtf96a9p
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Core types: Add UrlField, UrlListField, UrlValue, UrlListValue to coreTypes.ts"
type: is
updated_at: 2025-12-25T00:00:00.000Z
version: 1
---
Add to coreTypes.ts:
- FieldKind: add 'url' and 'url_list'
- UrlField interface (kind: 'url', base fields only)
- UrlListField interface (kind: 'url_list', minItems, maxItems, uniqueItems)
- UrlValue interface (kind: 'url', value: string | null)
- UrlListValue interface (kind: 'url_list', items: string[])
- Update Field and FieldValue union types
- Add Zod schemas for all new types
