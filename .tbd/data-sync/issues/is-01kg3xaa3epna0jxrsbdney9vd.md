---
close_reason: null
closed_at: 2025-12-23T21:05:37.028Z
created_at: 2025-12-23T20:49:59.493Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.264Z
    original_id: markform-99
id: is-01kg3xaa3epna0jxrsbdney9vd
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Remove hard-coded 'medium' priority default from serialize.ts
type: is
updated_at: 2025-12-23T21:05:37.028Z
version: 1
---
The serialize.ts has hard-coded logic like:

```ts
if (field.priority !== "medium") {
```

This embeds domain knowledge (default priority value) into generic serialization code.

**Problem:**
- Serialization shouldn't know about default values
- Makes it harder to change defaults later
- Violates separation of concerns

**Options:**
1. Move default to a constant in settings.ts and reference it
2. Have the schema define its own defaults, serialize only checks if value differs from schema default
3. Always serialize priority (simplest but more verbose output)

**Related:** markform-98 (settings.ts consolidation)
