---
close_reason: null
closed_at: 2025-12-29T08:07:36.577Z
created_at: 2025-12-29T04:05:01.653Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.229Z
    original_id: markform-432
id: is-01kg3xaa3b2h6wn0yvbfhqdr6h
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: "Spec: JSON Schema Export"
type: is
updated_at: 2025-12-29T08:07:36.577Z
version: 1
---
Add ability to export form structure as JSON Schema.

**Spec:** docs/project/specs/active/plan-2025-12-28-json-schema-export.md

**Summary:**
- New `markform schema <file>` CLI command
- Engine API `formToJsonSchema(form, options)`
- Map all 11 field kinds to JSON Schema equivalents
- Include x-markform extension properties for Markform metadata
- Support --pure flag for standard JSON Schema output

**Status:** Not started
