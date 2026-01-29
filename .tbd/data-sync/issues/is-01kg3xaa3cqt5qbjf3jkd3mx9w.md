---
close_reason: null
closed_at: 2026-01-02T05:56:19.652Z
created_at: 2026-01-02T05:52:55.802Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.667Z
    original_id: markform-509
id: is-01kg3xaa3cqt5qbjf3jkd3mx9w
kind: bug
labels: []
parent_id: null
priority: 1
status: closed
title: "Incorrect error message for checkboxes: says 'booleans' but expects string values"
type: is
updated_at: 2026-01-02T05:56:19.652Z
version: 1
---
In apply.ts:161, the error message for set_checkboxes validation says:
  'values must be an object mapping option IDs to booleans'

But the actual expected type is CheckboxValue which is a STRING union:
  'todo' | 'done' | 'incomplete' | 'active' | 'na' | 'unfilled' | 'yes' | 'no'

This misleads LLMs into trying formats like {product_sales: true} when they should use {product_sales: 'done'}.

Evidence from user logs:
- Turn 5 failed: LLM tried wrong format
- Turn 6 succeeded: product_sales:'done' (string value)  
- Turn 8 failed again: LLM reverted to wrong format

Fix: Update error message to say 'values must be an object mapping option IDs to checkbox state strings (todo/done/yes/no/etc)'
