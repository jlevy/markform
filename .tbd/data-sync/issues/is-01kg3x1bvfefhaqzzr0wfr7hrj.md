---
close_reason: null
closed_at: 2025-12-23T17:26:34.296Z
created_at: 2025-12-23T16:07:57.499Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.859Z
    original_id: markform-71
id: is-01kg3x1bvfefhaqzzr0wfr7hrj
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Migrate to ESM-only output (remove CJS dual-publish)
type: is
updated_at: 2025-12-23T17:32:58.453Z
version: 1
---
The build outputs both ESM and CJS formats (tsdown format: ["esm", "cjs"]). Node.js docs recommend single-format publishing to avoid the dual-package hazard. Since this is a new Node 24+ project with "type: module", migrating to ESM-only would eliminate the tsdown warning, follow Node.js best practices, and reduce package size. Changes needed: Update tsdown.config.ts format to ["esm"], update package.json exports to remove require/CJS paths.
