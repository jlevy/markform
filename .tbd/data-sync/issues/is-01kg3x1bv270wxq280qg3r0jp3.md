---
close_reason: null
closed_at: 2025-12-25T07:49:50.466Z
created_at: 2025-12-25T07:36:07.048Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.582Z
    original_id: markform-201
id: is-01kg3x1bv270wxq280qg3r0jp3
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: "Simplify fill command: replace --agent flag with --mock"
type: is
updated_at: 2025-12-25T07:49:50.466Z
version: 1
---
## Summary
The `--agent=live|mock` flag on the `fill` command is confusing. Simplify by defaulting to live and adding a `--mock` boolean flag instead.

## Current Behavior
```bash
pnpm markform fill form.md --agent=live --model=openai/gpt-4o
pnpm markform fill form.md --agent=mock --mock-source=filled.form.md
```

## New Behavior
```bash
pnpm markform fill form.md --model=openai/gpt-4o           # live is default
pnpm markform fill form.md --mock --mock-source=filled.form.md
```

## Changes Required

### Code Changes
1. `packages/markform/src/cli/commands/fill.ts` - Replace `--agent` option with `--mock` boolean flag
2. Update logic to default to live agent when `--mock` is not specified

### Documentation Updates
Search and update all references to `--agent=live` or `--agent=mock`:
- README.md
- docs/*.md files
- Example comments
- Any CLI help text

### No Backward Compatibility
- This is a breaking change but acceptable per user direction
- No deprecation warnings needed

## Acceptance Criteria
- [ ] `--mock` flag replaces `--agent` option
- [ ] Default behavior (no flag) uses live agent
- [ ] `--mock` requires `--mock-source`
- [ ] All docs and examples updated
- [ ] Tests pass
