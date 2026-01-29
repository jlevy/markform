---
close_reason: null
closed_at: 2025-12-29T23:42:26.937Z
created_at: 2025-12-29T07:53:48.148Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.292Z
    original_id: markform-444
id: is-01kg3xaa3b2fjwvvg35gkmfnf8
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 3: JSON Schema Golden Tests & Integration"
type: is
updated_at: 2025-12-29T23:42:26.937Z
version: 1
---
Add golden tests for schema output.

**Tasks:**
- [ ] Add dev dependencies: ajv, ajv-formats
- [ ] Create tests/golden/schemaRunner.ts with test utilities
- [ ] Create tests/golden/schemaGolden.test.ts
- [ ] Generate initial snapshots: simple.schema.json, movie-research-basic.schema.json
- [ ] Create scripts/regen-schema-snapshots.ts for regeneration
- [ ] Export formToJsonSchema from index.ts

**Ref:** markform-432
