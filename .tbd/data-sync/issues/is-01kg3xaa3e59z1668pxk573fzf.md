---
close_reason: null
closed_at: 2025-12-23T19:23:22.199Z
created_at: 2025-12-23T19:21:44.824Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.117Z
    original_id: markform-79
id: is-01kg3xaa3e59z1668pxk573fzf
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Make 'required' field explicit in export schema
type: is
updated_at: 2025-12-23T19:23:22.199Z
version: 1
---
Currently the export command omits the 'required' field when it's false/undefined, relying on implicit 'absence = optional' semantics. For a schema export consumed by external systems, this should be explicit.

**Current behavior:**
- Fields with required=true → output has "required": true
- Fields without required → output has no required key (implicit false)

**Desired behavior:**
- Always output "required": true or "required": false explicitly

**Files to update:**
1. Architecture doc - clarify export schema includes explicit required boolean
2. export.ts - change to always emit required: field.required ?? false
