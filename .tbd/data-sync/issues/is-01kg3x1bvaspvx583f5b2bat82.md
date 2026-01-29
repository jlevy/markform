---
close_reason: null
closed_at: 2026-01-02T05:56:19.652Z
created_at: 2026-01-02T05:52:59.685Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.457Z
    original_id: markform-511
id: is-01kg3x1bvaspvx583f5b2bat82
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: Allow boolean true/false as synonyms for checkbox string values
type: is
updated_at: 2026-01-02T05:56:19.652Z
version: 1
---
Currently checkboxes require string values like 'done'/'todo' or 'yes'/'no'.

LLMs naturally think of checkboxes as boolean values and often try:
  {product_sales: true} instead of {product_sales: 'done'}

Proposal: Allow boolean true/false as synonyms for string values with automatic coercion:
- For simple/multi mode: true → 'done', false → 'todo'
- For explicit mode: true → 'yes', false → 'no'

This could be implemented in valueCoercion.ts alongside existing coercion logic.

Benefits:
- More intuitive API for LLMs
- Backwards compatible (existing string values still work)
- Aligns with how humans think about checkboxes

This is a spec change but improves the developer/LLM experience significantly.
