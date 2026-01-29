---
close_reason: null
closed_at: 2025-12-23T23:08:46.410Z
created_at: 2025-12-23T23:03:26.931Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.213Z
    original_id: markform-137
id: is-01kg3xaa336qyrzyt6z46md3nq
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "ROLE-009: Role instructions merging and AI SDK integration"
type: is
updated_at: 2025-12-23T23:08:46.410Z
version: 1
---
## Problem
1. The spec says role_instructions are passed to the agent but doesn't specify how they combine with global instructions
2. AI SDK tools don't expose role filtering capabilities

## Why It Matters
- Prompt composition order affects agent behavior
- AI SDK tools should support role-aware filling
- Agents need to know which role they're filling for

## Recommended Fix
1. Define explicit prompt composition order and precedence:
   - base form instructions → role_instructions[role] → per-field instructions → system defaults
2. Add test that correct role_instructions text is present in agent prompt
3. Allow passing `targetRoles` and `mode` through AI SDK tools
4. Add tests for AI SDK tool behavior with roles and blocking

## Files to Update
- docs/project/specs/active/plan-2025-12-23-role-system.md (add Prompt Composition section)
- Architecture section: extend AI SDK tool parameters
