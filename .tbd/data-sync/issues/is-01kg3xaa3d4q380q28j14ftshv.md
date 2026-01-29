---
close_reason: null
closed_at: null
created_at: 2026-01-03T21:22:05.118Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.845Z
    original_id: markform-556
id: is-01kg3xaa3d4q380q28j14ftshv
kind: task
labels: []
parent_id: null
priority: 2
status: in_progress
title: "[526-5] Update prompts to clarify checkboxes format"
type: is
updated_at: 2026-01-03T21:32:58.854Z
version: 1
---
Phase 3: Prompt improvements

- Update guideline #9 in DEFAULT_SYSTEM_PROMPT to emphasize object format
- Update PATCH_FORMATS.checkboxes with explicit contrast note
- Add note: checkboxes use { key: 'state' } NOT ['key1', 'key2']

Shared between markform-550 and markform-551.
