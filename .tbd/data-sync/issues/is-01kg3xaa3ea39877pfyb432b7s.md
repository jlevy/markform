---
close_reason: null
closed_at: 2025-12-23T20:46:55.446Z
created_at: 2025-12-23T20:45:22.791Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.253Z
    original_id: markform-97
id: is-01kg3xaa3ea39877pfyb432b7s
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Change default serve port to flag with 3344 default
type: is
updated_at: 2025-12-23T20:46:55.446Z
version: 1
---
Add a --port flag to the serve command to configure the port, defaulting to 3344 (a non-standard port to avoid conflicts).

Current behavior: hardcoded port
New behavior: markform serve --port=3344 (default if not specified)
