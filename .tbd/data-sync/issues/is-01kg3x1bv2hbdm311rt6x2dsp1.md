---
close_reason: null
closed_at: 2025-12-26T23:51:38.495Z
created_at: 2025-12-24T20:56:02.645Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.405Z
    original_id: markform-184.4
id: is-01kg3x1bv2hbdm311rt6x2dsp1
kind: task
labels: []
parent_id: null
priority: 4
status: closed
title: "Spec/Code: findFieldById is not truly O(1) - still iterates groups"
type: is
updated_at: 2025-12-26T23:51:38.495Z
version: 1
---
The spec (lines 590, 678) claims findFieldById uses idIndex for O(1) lookup. But values.ts:59-75 first checks idIndex (O(1)) then still iterates all groups/fields to find the Field object (O(n)). Either extend idIndex to store Field references directly, add a fieldsById map to ParsedForm, or update the spec to clarify the O(1)+O(n) behavior. Low priority since forms are typically small.
