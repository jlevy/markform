---
close_reason: null
closed_at: 2026-01-05T22:10:17.420Z
created_at: 2026-01-03T20:33:27.802Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.595Z
    original_id: markform-550
id: is-01kg3x1bveks2ykpar6nxhmm2x
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: Add array-to-checkboxes coercion for LLM tolerance
type: is
updated_at: 2026-01-05T22:10:17.420Z
version: 1
---
LLMs consistently send checkbox patches in array format (like multi_select) instead of the required object format. This wastes 1 turn + 4-8K tokens per form. Root cause: pattern confusion between multi_select arrays and checkbox objects. Recommended fix: coerce arrays to objects with mode-appropriate defaults.

**Spec:** docs/project/specs/active/plan-2026-01-03-array-to-checkboxes-coercion.md

**Files to modify:**
- valueCoercion.ts: coerceToCheckboxes()
- apply.ts: normalizePatch()
- coreTypes.ts: add 'array_to_checkboxes' coercion type
- prompts.ts: add clarifying note
- markform-spec.md: add to coercion table
- markform-apis.md: document behavior
