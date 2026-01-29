---
close_reason: null
closed_at: 2025-12-25T00:00:00.000Z
created_at: 2025-12-24T23:24:40.108Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.627Z
    original_id: markform-192.5
id: is-01kg3xaa352h5v0nf6edcp8z4a
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Patches: Add SetUrlPatch and SetUrlListPatch types"
type: is
updated_at: 2025-12-25T00:00:00.000Z
version: 1
---
Update coreTypes.ts patch section:
- SetUrlPatch: { op: 'set_url', fieldId, value: string | null }
- SetUrlListPatch: { op: 'set_url_list', fieldId, items: string[] }
- Add to Patch union type
- Add Zod schemas: SetUrlPatchSchema, SetUrlListPatchSchema
- Update PatchSchema discriminated union
