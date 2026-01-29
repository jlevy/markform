---
close_reason: null
closed_at: 2025-12-24T02:54:59.199Z
created_at: 2025-12-24T02:07:43.023Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.171Z
    original_id: markform-149.4
id: is-01kg3x1bv1mw0hq970hzfbg4jy
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 4: Update fill command and harness for role-based filling"
type: is
updated_at: 2025-12-24T02:54:59.199Z
version: 1
---
## Goal
Add CLI flags and integrate role filtering into the harness.

## CLI Changes (fill.ts)
- Add `--roles <roles>` option (comma-separated or '*')
- Add `--mode <mode>` option ('continue' | 'overwrite')
- Add `--dry-run` option
- Update `--interactive` to default to USER_ROLE
- Show warning when `--roles=*` in non-interactive mode

## Harness Changes (harness.ts)
- Add `targetRoles?: string[]` to HarnessConfig
- Add `fillMode?: FillMode` to HarnessConfig
- Update step() to filter issues by role
- Update step() to respect blocking checkpoints

## LiveAgent Changes (liveAgent.ts)
- Update `buildContextPrompt()` to include role_instructions
- Compose instructions from: role defaults → form instructions → role instructions

## Files
- packages/markform/src/cli/commands/fill.ts
- packages/markform/src/harness/harness.ts
- packages/markform/src/harness/liveAgent.ts

## Tests
- Test --roles flag parsing
- Test --mode=continue skips filled fields
- Test blocking checkpoint prevents filling subsequent fields
