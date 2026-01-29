---
close_reason: null
closed_at: 2025-12-23T20:22:22.996Z
created_at: 2025-12-23T20:13:50.426Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.992Z
    original_id: markform-91
id: is-01kg3x1bvgg80xgsygt01p8fa5
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "CLI export: default to markdown output only"
type: is
updated_at: 2025-12-23T20:22:22.996Z
version: 1
---
Change export command to default to markdown output only.

**Current behavior:**
- Outputs JSON with schema + values + optional markdown
- Console format shows formatted text export

**Desired behavior:**
- Default output is canonical markdown only (serialize output)
- Remove text format display (covered by inspect now)
- Keep --format=json option for machine-readable schema/values
- With --compact, output compact JSON

**Implementation:**
- Change default output to just serialize(form) markdown
- JSON format still returns { schema, values, markdown }
- Remove formatConsoleExport text formatting (or simplify greatly)
