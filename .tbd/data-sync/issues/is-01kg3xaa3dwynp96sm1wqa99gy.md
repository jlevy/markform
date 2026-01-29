---
close_reason: Implemented best-effort patch application with value coercion
closed_at: 2026-01-03T06:22:49.637Z
created_at: 2026-01-03T06:01:57.698Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.782Z
    original_id: markform-544
id: is-01kg3xaa3dwynp96sm1wqa99gy
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 2: Coercion logic in normalizePatch()"
type: is
updated_at: 2026-01-03T06:34:13.184Z
version: 1
---
Extend normalizePatch() in apply.ts:

- Refactor to return NormalizationResult with optional warning
- Add string → string_list coercion
- Add URL string → url_list coercion  
- Add option ID → multi_select array coercion
- Update boolean → checkbox coercion to use new warning structure

Parent: markform-542
