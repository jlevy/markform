---
close_reason: null
closed_at: 2026-01-02T23:47:01.767Z
created_at: 2026-01-02T07:17:04.571Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.490Z
    original_id: markform-517
id: is-01kg3x1bva91p7g0a1d0hw95rq
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "Tryscript CLI testing: Phase 4 - CI integration"
type: is
updated_at: 2026-01-02T23:47:01.767Z
version: 1
---
Integrate tryscript tests into CI pipeline.

Tasks:
- Add tryscript to CI workflow (.github/workflows/ci.yml)
- Document test update process in development.md
- Consider c8 coverage integration for subprocess coverage
- Ensure CI fails on unexpected golden changes

Reference: docs/project/specs/active/plan-2026-01-02-tryscript-cli-testing.md
