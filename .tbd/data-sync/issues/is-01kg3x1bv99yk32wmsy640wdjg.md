---
close_reason: null
closed_at: 2025-12-30T00:18:01.496Z
created_at: 2025-12-29T23:58:21.716Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.198Z
    original_id: markform-465
id: is-01kg3x1bv99yk32wmsy640wdjg
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Parse run_mode from frontmatter
type: is
updated_at: 2025-12-30T00:18:01.496Z
version: 1
---
Update parser to read `run_mode` from frontmatter YAML.

**Implementation:**
- Update frontmatter parsing in parse.ts to extract `run_mode`
- Convert snake_case YAML key to camelCase TypeScript property
- Handle missing/undefined gracefully (optional field)

**Files:**
- packages/markform/src/engine/parse.ts

**Tests:**
- Parse form with run_mode: research → metadata.runMode === 'research'
- Parse form without run_mode → metadata.runMode === undefined
- Parse form with invalid run_mode → parse error

**Ref:** markform-462
