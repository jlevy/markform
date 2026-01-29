---
close_reason: null
closed_at: 2025-12-23T23:08:46.410Z
created_at: 2025-12-23T23:02:50.578Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.191Z
    original_id: markform-133
id: is-01kg3xaa33zxyc5e7achcavj9p
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "ROLE-005: CLI safety for user-role fields"
type: is
updated_at: 2025-12-23T23:08:46.410Z
version: 1
---
## Problem
Non-interactive fills could target `user` role fields unintentionally, causing poor UX. The spec doesn't protect against accidentally filling user fields with an agent.

## Why It Matters
- User-role fields are meant for human input
- Accidentally filling them with agent data defeats the purpose of roles
- No safeguard in current design

## Recommended Fix
1. Default behavior: non-interactive fill skips user role fields unless `--include-user-role` is explicitly provided
2. Interactive mode defaults to `user` role; allow override with `--roles`
3. Error/warn if `--interactive` + `--roles` includes roles not supported by interactive UI
4. Add high-visibility warning on `--roles=*` when interactive=false
5. Document these safeguards in CLI Interface section

## Files to Update
- docs/project/specs/active/plan-2025-12-23-role-system.md (CLI Interface section)
- Add acceptance criteria for safety guards
