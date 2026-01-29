---
close_reason: null
closed_at: 2025-12-23T15:02:24.951Z
created_at: 2025-12-23T07:19:41.512Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.685Z
    original_id: markform-1hn
id: is-01kg3xaa35ntwb2kdj43pbx929
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: 1.3 Canonical Serialization (engine/serialize.ts)
type: is
updated_at: 2025-12-23T15:03:22.034Z
version: 1
---
Implement serialize(form: ParsedForm, opts?): string
- Frontmatter generation with computed summaries
- Tag serialization with alphabetical attributes
- Value fence generation
- Option list serialization with markers
- Doc block placement
- Round-trip tests: parse -> serialize -> parse -> compare
