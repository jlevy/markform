---
close_reason: null
closed_at: 2025-12-23T15:44:45.585Z
created_at: 2025-12-23T15:39:18.678Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.853Z
    original_id: markform-70
id: is-01kg3x1bvf2j9ja8b06dqbkcs9
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "CLI-REVIEW: Audit CLI commands against typescript-cli-tool-rules.md"
type: is
updated_at: 2025-12-23T16:17:36.825Z
version: 1
---
## Problem
Phase 2 CLI commands were implemented before the speculate-update merge brought in updated `typescript-cli-tool-rules.md` best practices.

## Scope
Review all CLI implementation files against the rules:
- `packages/markform/src/cli/cli.ts`
- `packages/markform/src/cli/lib/shared.ts`
- `packages/markform/src/cli/lib/formatting.ts`
- `packages/markform/src/cli/commands/inspect.ts`
- `packages/markform/src/cli/commands/export.ts`
- `packages/markform/src/cli/commands/serve.ts`

## Rules to Verify (from docs/general/agent-rules/typescript-cli-tool-rules.md)

### Color and Output Formatting
- [x] Uses picocolors (aliased as pc) for all colors
- [ ] No hardcoded ANSI escape codes
- [x] Has shared color utilities in formatting.ts

### Commander.js Patterns
- [x] Uses Commander.js
- [ ] Has colored help wrapper (withColoredHelp)
- [x] Has CommandContext with dryRun, verbose, quiet
- [ ] Has logDryRun helper with details support
- [x] Supports --dry-run, --verbose, --quiet global options

### Progress and Feedback
- [ ] Consider using @clack/prompts for interactive UI (spinners, prompts)
- [ ] Consistent emoji usage (✅, ❌, ⚠️, ⏰, 🧪)

### Timing and Performance
- [ ] Display timing for long operations (⏰ emoji)

### Script Structure
- [x] TypeScript files
- [x] Handles errors gracefully with exit code 1

### Documentation
- [x] File-level comments describing purpose
- [x] Help text on commands and options

## Files to Reference
- docs/general/agent-rules/typescript-cli-tool-rules.md
