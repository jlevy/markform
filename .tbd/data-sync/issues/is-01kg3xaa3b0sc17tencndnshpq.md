---
close_reason: null
closed_at: 2025-12-29T04:31:32.413Z
created_at: 2025-12-29T04:28:45.804Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.239Z
    original_id: markform-434
id: is-01kg3xaa3b0sc17tencndnshpq
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 1: Move DOCS.md and SPEC.md to docs/"
type: is
updated_at: 2025-12-29T04:31:32.413Z
version: 1
---
Move documentation files to canonical locations with consistent naming.

**Tasks:**
- Move packages/markform/DOCS.md → docs/markform-reference.md
- Move root SPEC.md → docs/markform-spec.md
- Update .gitignore to ignore packages/markform/markform-*.md (build artifacts)
- Update packages/markform/package.json:
  - Update `files` array to use markform-*.md names
  - Update `copy-docs` script to copy with consistent names
- Delete original packages/markform/DOCS.md (now generated)

**Ref:** markform-433
