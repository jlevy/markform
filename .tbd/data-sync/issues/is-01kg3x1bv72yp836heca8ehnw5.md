---
close_reason: null
closed_at: 2025-12-29T04:05:00.322Z
created_at: 2025-12-28T10:59:22.899Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.761Z
    original_id: markform-372
id: is-01kg3x1bv72yp836heca8ehnw5
kind: epic
labels: []
parent_id: null
priority: 1
status: closed
title: Formalize field kind vs data type terminology across spec/docs/code
type: is
updated_at: 2025-12-29T04:05:00.322Z
version: 1
---
Implement the terminology formalization described in docs/project/specs/active/plan-2025-12-28-kind-vs-type-terminology.md.

Spec updates (normative):
- Update SPEC.md to add the new Type System section (terminology + data type taxonomy + field kind taxonomy + kind→type mapping table).
- Replace ambiguous uses of "field type" with "field kind" throughout SPEC.md where appropriate.

Docs/code consistency:
- Update packages/markform/DOCS.md and README.md to use "field kind" vs "data type" consistently.
- Update code/test comments in packages/markform/src and packages/markform/tests accordingly.
