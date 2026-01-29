---
close_reason: null
closed_at: 2025-12-23T23:08:46.410Z
created_at: 2025-12-23T23:04:04.076Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.112Z
    original_id: markform-141
id: is-01kg3x1bv1bx0yg97hjb4x63ht
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "ROLE-013: Additional test plan items for role system"
type: is
updated_at: 2025-12-23T23:08:46.410Z
version: 1
---
## Summary
Test plan additions beyond what's already listed in the spec.

## Overwrite Safety Tests
- [ ] Overwrite does not clear user-role checkpoints when roles exclude `user`
- [ ] With `roles=*` and `--force-overwrite-blocking` absent, checkpoint not cleared if not in targetRoles
- [ ] Overwrite that does not regress completion state

## Normalization and Validation Tests
- [ ] Roles normalization (case/whitespace trimming)
- [ ] Reject literal '*' role in frontmatter
- [ ] Role value constraints: non-empty, unique, lowercase pattern

## Prompt Composition Tests
- [ ] Ensures correct role_instructions precedence in agent prompt
- [ ] Base form instructions → role instructions → field instructions

## Serializer Stability Tests
- [ ] Golden snapshot for serialization of role and approvalMode defaults
- [ ] Round-trip preserves non-default values correctly

## Inspect UX Tests
- [ ] Blocked fields list includes 'blocked by' annotations
- [ ] --roles filter works correctly
- [ ] Shows role scoping in output

## Files to Update
- docs/project/specs/active/plan-2025-12-23-role-system.md (Phase 5: Tests section)
