---
close_reason: null
closed_at: 2026-01-02T23:47:01.767Z
created_at: 2026-01-02T07:16:51.536Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.474Z
    original_id: markform-514
id: is-01kg3x1bva0men2bdt68p00m2b
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Tryscript CLI testing: Phase 1 - Setup"
type: is
updated_at: 2026-01-02T23:47:01.767Z
version: 1
---
Set up tryscript infrastructure for CLI end-to-end testing.

Tasks:
- Create `tryscript.config.ts` with patterns for VERSION, PATH, HASH, DATE, TIME
- Create `tests/cli/` directory
- Add npm scripts: test:tryscript, test:tryscript:update
- Create minimal `commands.tryscript.md` with 5 commands (--help, --version, inspect, status, validate)
- Verify `pnpm test:tryscript` works

Reference: docs/project/specs/active/plan-2026-01-02-tryscript-cli-testing.md
