---
close_reason: null
closed_at: 2025-12-23T19:51:06.647Z
created_at: 2025-12-23T19:24:13.039Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.161Z
    original_id: markform-82
id: is-01kg3xaa3eqktqs38xgnj6851x
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "CLI apply: implement --dry-run support"
type: is
updated_at: 2025-12-23T19:51:06.647Z
version: 1
---
The global --dry-run flag is documented but not implemented for the apply command. When --dry-run is passed, the command should output the patch result report without modifying the file. This was discovered during v0.1 validation testing.
