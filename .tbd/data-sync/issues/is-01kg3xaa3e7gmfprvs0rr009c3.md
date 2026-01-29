---
close_reason: null
closed_at: 2025-12-23T19:51:06.647Z
created_at: 2025-12-23T19:24:13.608Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.166Z
    original_id: markform-83
id: is-01kg3xaa3e7gmfprvs0rr009c3
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "CLI export: add --markdown flag to include canonical markdown"
type: is
updated_at: 2025-12-23T19:51:06.647Z
version: 1
---
The export command outputs schema and values JSON but not the canonical markdown. Add a --markdown flag to optionally include the markdown in the output. This aligns with the markform_get_markdown tool in the AI SDK integration. Discovered during v0.1 validation testing.
