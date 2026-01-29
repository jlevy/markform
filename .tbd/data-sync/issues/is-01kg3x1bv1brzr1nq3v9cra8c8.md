---
close_reason: null
closed_at: 2025-12-24T05:32:44.188Z
created_at: 2025-12-24T01:39:39.100Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.142Z
    original_id: markform-147
id: is-01kg3x1bv1brzr1nq3v9cra8c8
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: Connect form instructions to live agent prompt composition
type: is
updated_at: 2025-12-24T05:32:44.188Z
version: 1
---
## Problem

The `buildContextPrompt()` function in `liveAgent.ts` doesn't use:
1. Form-level doc blocks with `kind="instructions"`
2. Frontmatter `role_instructions` (planned in role-system spec)
3. Per-field instruction attributes

Currently it just builds a static prompt from issues.

## Solution

Update `buildContextPrompt()` to compose instructions from multiple sources in this order:

1. **Base form instructions** - Doc blocks with `ref` matching form ID and `kind="instructions"`
2. **Role-specific instructions** - From `role_instructions[targetRole]` in frontmatter
3. **Per-field instructions** - From field `instructions` attributes (for fields being filled)
4. **System defaults** - `DEFAULT_ROLE_INSTRUCTIONS[targetRole]` or `DEFAULT_SYSTEM_PROMPT`

Later instructions augment (not replace) earlier ones.

## Dependencies

- **markform-XXX**: Role system implementation (for `role_instructions` frontmatter)

## Files to Modify

- `packages/markform/src/harness/liveAgent.ts` - Update `buildContextPrompt()`
- `packages/markform/src/engine/types.ts` - May need `FormMetadata` type with `roleInstructions`
- `packages/markform/src/settings.ts` - Add `DEFAULT_ROLE_INSTRUCTIONS`

## Spec Reference

Defined in role-system spec lines 401-413 (Role Instructions in Agent Prompts).
