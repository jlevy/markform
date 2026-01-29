---
close_reason: null
closed_at: 2025-12-31T20:27:38.112Z
created_at: 2025-12-31T20:08:59.719Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.288Z
    original_id: markform-482
id: is-01kg3x1bv943fdfkjz9ddv1g19
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 1: Update vitest.config.ts for coverage"
type: is
updated_at: 2025-12-31T20:27:38.112Z
version: 1
---
Update coverage configuration to be production-ready:

- Add json-summary reporter (required for PR comments)
- Add reportOnFailure: true (generate reports even when thresholds fail)
- Lower thresholds to realistic starting points (50/49/50/50)
- Update exclude patterns for completeness
- Test locally with pnpm test:coverage
- Verify coverage/coverage-summary.json is generated

Files to modify:
- packages/markform/vitest.config.ts

Ref: docs/project/specs/active/plan-2025-12-31-code-coverage-implementation.md
