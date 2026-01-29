---
close_reason: null
closed_at: 2025-12-31T20:29:30.185Z
created_at: 2025-12-31T20:09:21.804Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.513Z
    original_id: markform-484
id: is-01kg3xaa3b2py4y2h7fxtpm4dc
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 3: Add coverage badge to README"
type: is
updated_at: 2025-12-31T20:29:30.185Z
version: 1
---
Add visible coverage badge to README:

- Add coverage-badges-action@v1.4.6 to workflow (main branch only)
- Configure badge output (gist or repo branch)
- Update README with badge markdown
- Verify badge updates after main branch push

Files to modify:
- .github/workflows/ci.yml
- README.md

Ref: docs/project/specs/active/plan-2025-12-31-code-coverage-implementation.md
